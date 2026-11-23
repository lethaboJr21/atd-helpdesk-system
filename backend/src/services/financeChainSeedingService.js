const pool = require("../db/pool");
const workflow = require("./financeJournalWorkflowService");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const SCOPE_KEYS = new Set(["all_finance", "ap_office", "cfo"]);

async function resolveNamedPerson({personKey, person_variants, email_hint}) {
  const variants = (Array.isArray(person_variants) ? person_variants : [])
    .map(v => String(v || "").trim().toLowerCase())
    .filter(v => v !== "");
  const emailHint = email_hint != null && String(email_hint).trim() !== "" ? String(email_hint).trim() : null;
  if (variants.length === 0 && emailHint == null) {
    throw fail(422, "SEED_PERSON_UNRESOLVED", `Named person '${personKey}' has no name variants or email hint to resolve against active accounts.`);
  }
  const rows = (await pool.query(
    `SELECT id, name, email FROM users
     WHERE status='active' AND archived_at IS NULL AND approved=TRUE
       AND (LOWER(name) = ANY($1::text[]) OR LOWER(email) = LOWER($2))`,
    [variants, emailHint]
  )).rows;
  if (rows.length === 0) {
    throw fail(422, "SEED_PERSON_UNRESOLVED", `Named person '${personKey}' (variants: ${variants.join(", ") || "none"}${emailHint ? `; email: ${emailHint}` : ""}) matched no active approved user account.`);
  }
  if (rows.length > 1) {
    const candidates = rows.map(r => `${r.name} <${r.email}> (#${r.id})`).join("; ");
    throw fail(422, "SEED_PERSON_AMBIGUOUS", `Named person '${personKey}' matched multiple active accounts: ${candidates}.`);
  }
  return rows[0];
}

async function resolveFinalApprover({officeCode, financeFunction, requiresCfoSignOff}) {
  const scopeKey = requiresCfoSignOff
    ? "cfo"
    : (String(officeCode || "").trim().toUpperCase() === "AP" ? "ap_office" : "all_finance");
  const row = (await pool.query(
    `SELECT id, person_key, person_variants, email_hint, approver_user_id FROM finance_final_approvers WHERE scope_key=$1 AND active=TRUE LIMIT 1`,
    [scopeKey]
  )).rows[0];
  if (!row) return {approverUserId: null, scopeKey, configured: false};
  if (row.approver_user_id != null) return {approverUserId: row.approver_user_id, scopeKey, configured: true, personKey: row.person_key};
  try {
    const person = await resolveNamedPerson({personKey: row.person_key, person_variants: row.person_variants, email_hint: row.email_hint});
    return {approverUserId: person.id, scopeKey, configured: true, personKey: row.person_key};
  } catch (error) {
    return {approverUserId: null, scopeKey, configured: false, personKey: row.person_key};
  }
}

async function functionOfficeCode(financeFunction) {
  try {
    const rows = (await pool.query(
      `SELECT DISTINCT office_code FROM finance_employee_responsibilities WHERE finance_function=$1 AND active=TRUE AND office_code IS NOT NULL ORDER BY office_code`,
      [financeFunction]
    )).rows;
    if (rows.length === 0) return null;
    return rows.every(r => String(r.office_code).trim().toUpperCase() === "AP") ? "AP" : null;
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return null;
    throw error;
  }
}

async function auditGovernance(recordType, recordId, action, reason, actorUserId, detail) {
  if (actorUserId == null) return;
  try {
    await pool.query(
      `INSERT INTO finance_governance_actions(record_type, record_id, action, actor_user_id, reason, detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
      [recordType, recordId, action, actorUserId, reason, JSON.stringify(detail)]
    );
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) console.warn("Finance governance audit failed:", error.message);
  }
}

async function upsertChainLevel({chainId, sequenceNumber, reviewerUserId, approverUserId, levelName, created, updated}) {
  const existing = (await pool.query(
    `SELECT id, reviewer_user_id, approver_user_id FROM finance_journal_workflow_levels WHERE chain_id=$1::bigint AND sequence_number=$2 AND active=TRUE LIMIT 1`,
    [chainId, sequenceNumber]
  )).rows[0];
  if (!existing) {
    await workflow.addWorkflowLevel({chainId, sequenceNumber, reviewerUserId: reviewerUserId ?? null, approverUserId: approverUserId ?? null, levelName});
    created.levels++;
    return {sequenceNumber, reviewerUserId: reviewerUserId ?? null, approverUserId: approverUserId ?? null, levelName, action: "created"};
  }
  if (reviewerUserId !== undefined) {
    if ((existing.reviewer_user_id ?? null) === (reviewerUserId ?? null)) {
      return {sequenceNumber, reviewerUserId: existing.reviewer_user_id ?? null, approverUserId: existing.approver_user_id ?? null, levelName, action: "unchanged"};
    }
    await pool.query(`UPDATE finance_journal_workflow_levels SET reviewer_user_id=$1::bigint WHERE id=$2::bigint`, [reviewerUserId ?? null, existing.id]);
    updated.levels++;
    return {sequenceNumber, reviewerUserId: reviewerUserId ?? null, approverUserId: existing.approver_user_id ?? null, levelName, action: "updated"};
  }
  if ((existing.approver_user_id ?? null) === (approverUserId ?? null)) {
    return {sequenceNumber, reviewerUserId: existing.reviewer_user_id ?? null, approverUserId: existing.approver_user_id ?? null, levelName, action: "unchanged"};
  }
  await pool.query(`UPDATE finance_journal_workflow_levels SET approver_user_id=$1::bigint WHERE id=$2::bigint`, [approverUserId ?? null, existing.id]);
  updated.levels++;
  return {sequenceNumber, reviewerUserId: existing.reviewer_user_id ?? null, approverUserId: approverUserId ?? null, levelName, action: "updated"};
}

async function seedApprovalChains({confidentialityLevel = "Internal", includeCfoLevel = false, dryRun = false, actorUserId} = {}) {
  const mappings = (await pool.query(
    `SELECT id, finance_function, person_key, person_variants, email_hint, reviewer_user_id FROM finance_function_reviewer_mappings WHERE active=TRUE ORDER BY id`
  )).rows;
  const approverRows = (await pool.query(
    `SELECT id, scope_key, person_key, person_variants, email_hint, approver_user_id FROM finance_final_approvers WHERE active=TRUE ORDER BY id`
  )).rows;

  const resolved = {};
  const resolvedByMappingId = new Map();
  for (const mapping of mappings) {
    const person = await resolveNamedPerson({personKey: mapping.person_key, person_variants: mapping.person_variants, email_hint: mapping.email_hint});
    resolved[mapping.person_key] = person.id;
    resolvedByMappingId.set(mapping.id, person.id);
  }
  const resolvedApprovers = {};
  for (const row of approverRows) {
    const person = await resolveNamedPerson({personKey: row.person_key, person_variants: row.person_variants, email_hint: row.email_hint});
    resolved[row.person_key] = person.id;
    resolvedApprovers[row.scope_key] = person.id;
  }

  const plans = [];
  for (const mapping of mappings) {
    const reviewerUserId = resolvedByMappingId.get(mapping.id);
    const officeCode = await functionOfficeCode(mapping.finance_function);
    const scopeKey = String(officeCode || "").trim().toUpperCase() === "AP" ? "ap_office" : "all_finance";
    plans.push({mapping, reviewerUserId, scopeKey, finalApproverUserId: resolvedApprovers[scopeKey] ?? null});
  }
  const cfoApproverUserId = resolvedApprovers["cfo"] ?? null;

  if (dryRun) {
    const chains = [];
    let wouldCreateChains = 0, wouldAddLevels = 0, wouldUpdateLevels = 0;
    for (const plan of plans) {
      const chain = await workflow.getWorkflowChain({financeFunction: plan.mapping.finance_function, workItemType: "journal", confidentialityLevel});
      const existingLevels = chain ? chain.levels : [];
      const levelReport = [];
      const plannedLevels = [{sequenceNumber: 1, reviewerUserId: plan.reviewerUserId, levelName: "First-Level Review"}];
      if (plan.finalApproverUserId != null) plannedLevels.push({sequenceNumber: 2, approverUserId: plan.finalApproverUserId, levelName: "Final Approval"});
      if (includeCfoLevel && cfoApproverUserId != null) plannedLevels.push({sequenceNumber: 3, approverUserId: cfoApproverUserId, levelName: "CFO Sign-Off"});
      for (const planned of plannedLevels) {
        const existing = existingLevels.find(l => Number(l.sequence_number) === planned.sequenceNumber);
        if (!existing) {
          wouldAddLevels++;
          levelReport.push({...planned, action: "create"});
        } else {
          const same = planned.reviewerUserId !== undefined
            ? (existing.reviewer_user_id ?? null) === (planned.reviewerUserId ?? null)
            : (existing.approver_user_id ?? null) === (planned.approverUserId ?? null);
          if (!same) wouldUpdateLevels++;
          levelReport.push({...planned, action: same ? "unchanged" : "update"});
        }
      }
      if (!chain) wouldCreateChains++;
      chains.push({financeFunction: plan.mapping.finance_function, chainId: chain ? chain.id : null, wouldCreate: !chain, levels: levelReport});
    }
    let wouldUpdateMappings = 0, wouldUpdateApprovers = 0;
    for (const mapping of mappings) if ((mapping.reviewer_user_id ?? null) !== resolvedByMappingId.get(mapping.id)) wouldUpdateMappings++;
    for (const row of approverRows) if ((row.approver_user_id ?? null) !== resolvedApprovers[row.scope_key]) wouldUpdateApprovers++;
    return {resolved, chains, created: {chains: wouldCreateChains, levels: wouldAddLevels}, updated: {mappings: wouldUpdateMappings, approvers: wouldUpdateApprovers, levels: wouldUpdateLevels}, warnings: [], dryRun: true};
  }

  let effectiveActorUserId = actorUserId ?? null;
  if (effectiveActorUserId == null) {
    const actor = (await pool.query(
      `SELECT id FROM users WHERE role='superadmin' AND status='active' AND archived_at IS NULL AND approved=TRUE ORDER BY id LIMIT 1`
    )).rows[0];
    effectiveActorUserId = actor?.id ?? null;
  }

  const client = await pool.connect();
  const auditEvents = [];
  let mappingsUpdated = 0, approversUpdated = 0;
  try {
    await client.query("BEGIN");
    for (const mapping of mappings) {
      const userId = resolvedByMappingId.get(mapping.id);
      if ((mapping.reviewer_user_id ?? null) !== userId) {
        await client.query(`UPDATE finance_function_reviewer_mappings SET reviewer_user_id=$1::bigint, updated_at=NOW() WHERE id=$2::bigint`, [userId, mapping.id]);
        mappingsUpdated++;
        auditEvents.push(["reviewer_mapping", mapping.id, "chain_seeding", {finance_function: mapping.finance_function, person_key: mapping.person_key, previous_reviewer_user_id: mapping.reviewer_user_id ?? null, new_reviewer_user_id: userId}]);
      }
    }
    for (const row of approverRows) {
      const userId = resolvedApprovers[row.scope_key];
      if ((row.approver_user_id ?? null) !== userId) {
        await client.query(`UPDATE finance_final_approvers SET approver_user_id=$1::bigint, updated_at=NOW() WHERE id=$2::bigint`, [userId, row.id]);
        approversUpdated++;
        auditEvents.push(["final_approver", row.id, "chain_seeding", {scope_key: row.scope_key, person_key: row.person_key, previous_approver_user_id: row.approver_user_id ?? null, new_approver_user_id: userId}]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  for (const [recordType, recordId, action, detail] of auditEvents) {
    await auditGovernance(recordType, recordId, action, "seed_approval_chains", effectiveActorUserId, detail);
  }

  const chains = [];
  const created = {chains: 0, levels: 0};
  const updated = {mappings: mappingsUpdated, approvers: approversUpdated, levels: 0};
  const warnings = [];
  for (const plan of plans) {
    let chain = await workflow.getWorkflowChain({financeFunction: plan.mapping.finance_function, workItemType: "journal", confidentialityLevel});
    if (!chain) {
      if (effectiveActorUserId == null) throw fail(400, "SEED_ACTOR_REQUIRED", "An actor user is required to create workflow chains; no active superadmin was found.");
      chain = await workflow.createWorkflowChain({financeFunction: plan.mapping.finance_function, workItemType: "journal", confidentialityLevel, createdBy: effectiveActorUserId});
      created.chains++;
    }
    const levels = [];
    levels.push(await upsertChainLevel({chainId: chain.id, sequenceNumber: 1, reviewerUserId: plan.reviewerUserId, levelName: "First-Level Review", created, updated}));
    if (plan.finalApproverUserId == null) {
      warnings.push(`FINAL_APPROVER_UNCONFIGURED:${plan.scopeKey}:${plan.mapping.finance_function}`);
    } else {
      levels.push(await upsertChainLevel({chainId: chain.id, sequenceNumber: 2, approverUserId: plan.finalApproverUserId, levelName: "Final Approval", created, updated}));
    }
    if (includeCfoLevel) {
      if (cfoApproverUserId == null) {
        warnings.push("FINAL_APPROVER_UNCONFIGURED:cfo");
      } else {
        levels.push(await upsertChainLevel({chainId: chain.id, sequenceNumber: 3, approverUserId: cfoApproverUserId, levelName: "CFO Sign-Off", created, updated}));
      }
    }
    chains.push({financeFunction: plan.mapping.finance_function, chainId: chain.id, levels});
  }
  return {resolved, chains, created, updated, warnings, dryRun: false};
}

async function updateReviewerMapping({financeFunction, personVariants, emailHint, updatedBy}) {
  if (!financeFunction || !Array.isArray(personVariants) || personVariants.length === 0 || personVariants.some(v => String(v ?? "").trim() === "")) {
    throw fail(400, "REVIEWER_MAPPING_FIELDS_REQUIRED", "A finance function and a non-empty personVariants array are required.");
  }
  const current = (await pool.query(
    `SELECT * FROM finance_function_reviewer_mappings WHERE finance_function=$1 AND active=TRUE LIMIT 1`,
    [financeFunction]
  )).rows[0];
  if (!current) throw fail(404, "REVIEWER_MAPPING_NOT_FOUND", `No active reviewer mapping exists for '${financeFunction}'.`);
  const variants = personVariants.map(v => String(v).trim());
  const email = emailHint != null && String(emailHint).trim() !== "" ? String(emailHint).trim() : null;
  const person = await resolveNamedPerson({personKey: current.person_key, person_variants: variants, email_hint: email});
  const result = (await pool.query(
    `UPDATE finance_function_reviewer_mappings SET person_variants=$1::text[], email_hint=$2, reviewer_user_id=$3::bigint, updated_at=NOW() WHERE id=$4::bigint RETURNING *`,
    [variants, email, person.id, current.id]
  )).rows[0];
  await auditGovernance("reviewer_mapping", current.id, "reviewer_mapping_update", "reconfiguration", updatedBy, {
    finance_function: financeFunction,
    previous_person_variants: current.person_variants,
    new_person_variants: variants,
    previous_email_hint: current.email_hint ?? null,
    new_email_hint: email,
    previous_reviewer_user_id: current.reviewer_user_id ?? null,
    new_reviewer_user_id: person.id
  });
  return {...result, resolved: true};
}

async function updateFinalApprover({scopeKey, personVariants, emailHint, updatedBy}) {
  if (!SCOPE_KEYS.has(scopeKey) || !Array.isArray(personVariants) || personVariants.length === 0 || personVariants.some(v => String(v ?? "").trim() === "")) {
    throw fail(400, "FINAL_APPROVER_FIELDS_REQUIRED", "A scope key (all_finance, ap_office or cfo) and a non-empty personVariants array are required.");
  }
  const current = (await pool.query(
    `SELECT * FROM finance_final_approvers WHERE scope_key=$1 AND active=TRUE LIMIT 1`,
    [scopeKey]
  )).rows[0];
  if (!current) throw fail(404, "FINAL_APPROVER_NOT_FOUND", `No active final approver is configured for scope '${scopeKey}'.`);
  const variants = personVariants.map(v => String(v).trim());
  const email = emailHint != null && String(emailHint).trim() !== "" ? String(emailHint).trim() : null;
  const person = await resolveNamedPerson({personKey: current.person_key, person_variants: variants, email_hint: email});
  const result = (await pool.query(
    `UPDATE finance_final_approvers SET person_variants=$1::text[], email_hint=$2, approver_user_id=$3::bigint, updated_at=NOW() WHERE id=$4::bigint RETURNING *`,
    [variants, email, person.id, current.id]
  )).rows[0];
  await auditGovernance("final_approver", current.id, "final_approver_update", "reconfiguration", updatedBy, {
    scope_key: scopeKey,
    previous_person_variants: current.person_variants,
    new_person_variants: variants,
    previous_email_hint: current.email_hint ?? null,
    new_email_hint: email,
    previous_approver_user_id: current.approver_user_id ?? null,
    new_approver_user_id: person.id
  });
  return {...result, resolved: true};
}

async function getReviewerMappings() {
  try {
    const rows = (await pool.query(
      `SELECT m.id, m.finance_function, m.person_key, m.person_variants, m.email_hint, m.reviewer_user_id, m.active, m.updated_at, u.name AS reviewer_name, u.email AS reviewer_email
       FROM finance_function_reviewer_mappings m LEFT JOIN users u ON u.id=m.reviewer_user_id
       WHERE m.active=TRUE ORDER BY m.id`
    )).rows;
    return rows.map(row => ({...row, resolved: row.reviewer_user_id != null}));
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return [];
    throw error;
  }
}

async function getFinalApprovers() {
  try {
    const rows = (await pool.query(
      `SELECT f.id, f.scope_key, f.person_key, f.person_variants, f.email_hint, f.approver_user_id, f.active, f.updated_at, u.name AS approver_name, u.email AS approver_email
       FROM finance_final_approvers f LEFT JOIN users u ON u.id=f.approver_user_id
       WHERE f.active=TRUE ORDER BY f.scope_key`
    )).rows;
    return rows.map(row => ({...row, resolved: row.approver_user_id != null}));
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return [];
    throw error;
  }
}

module.exports = {
  resolveNamedPerson,
  resolveFinalApprover,
  seedApprovalChains,
  updateReviewerMapping,
  updateFinalApprover,
  getReviewerMappings,
  getFinalApprovers
};