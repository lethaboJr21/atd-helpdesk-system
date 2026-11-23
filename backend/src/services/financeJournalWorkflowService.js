const pool = require("../db/pool");
const { sendEmail } = require("./email");
const { checkSeparationOfDuties } = require("./financeApprovalRouting");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

const STATE_MACHINE = {
  draft: ["submitted"],
  submitted: ["under_review", "rejected", "returned"],
  under_review: ["under_review", "approved", "rejected", "returned"],
  approved: ["published"],
  rejected: [],
  returned: ["submitted"],
  published: []
};

const CONFIDENTIALITY = ["Internal","Finance Restricted","Confidential","CFO Restricted","Boardroom Restricted","Payment Restricted","Employee Financial Information","Supplier Banking Information"];

function assertTransition(fromStatus, toStatus) {
  if (!(STATE_MACHINE[String(fromStatus || "").toLowerCase()] || []).includes(toStatus)) {
    throw fail(409, "JOURNAL_INVALID_TRANSITION", `Journals cannot move from '${fromStatus}' to '${toStatus}'.`);
  }
}

async function createWorkflowChain({financeFunction, workItemType, confidentialityLevel, createdBy}) {
  if (!financeFunction || !createdBy) throw fail(400, "WORKFLOW_CHAIN_FIELDS_REQUIRED", "Finance function and createdBy are required.");
  try {
    const result = await pool.query(
      `INSERT INTO finance_journal_workflow_chains(finance_function,work_item_type,confidentiality_level,active,created_by)
       VALUES($1,$2,$3,TRUE,$4::bigint) RETURNING *`,
      [financeFunction, workItemType || "journal", confidentialityLevel || "Internal", createdBy]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") throw fail(409, "WORKFLOW_CHAIN_DUPLICATE", "An active chain already exists for this function, work item type and confidentiality level.");
    throw error;
  }
}

async function addWorkflowLevel({chainId, sequenceNumber, reviewerUserId, approverUserId, backupApproverUserId, levelName}) {
  if (!chainId || !Number.isInteger(Number(sequenceNumber)) || Number(sequenceNumber) < 1) throw fail(400, "WORKFLOW_LEVEL_FIELDS_REQUIRED", "Chain and a positive integer sequence number are required.");
  try {
    const result = await pool.query(
      `INSERT INTO finance_journal_workflow_levels(chain_id,sequence_number,reviewer_user_id,approver_user_id,backup_approver_user_id,level_name,active)
       VALUES($1::bigint,$2,$3::bigint,$4::bigint,$5::bigint,$6,TRUE) RETURNING *`,
      [chainId, Number(sequenceNumber), reviewerUserId ?? null, approverUserId ?? null, backupApproverUserId ?? null, levelName ?? null]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") throw fail(409, "WORKFLOW_LEVEL_DUPLICATE", "A level with this sequence number already exists in the chain.");
    throw error;
  }
}

async function getWorkflowChain({financeFunction, workItemType, confidentialityLevel}) {
  const chain = (await pool.query(
    `SELECT * FROM finance_journal_workflow_chains WHERE finance_function=$1 AND work_item_type=$2 AND confidentiality_level=$3 AND active=TRUE LIMIT 1`,
    [financeFunction, workItemType || "journal", confidentialityLevel || "Internal"]
  )).rows[0];
  if (!chain) return null;
  const levels = (await pool.query(
    `SELECT l.*,u.name approver_name,b.name backup_approver_name,r.name reviewer_name FROM finance_journal_workflow_levels l
     LEFT JOIN users u ON u.id=l.approver_user_id LEFT JOIN users b ON u.id=l.backup_approver_user_id LEFT JOIN users r ON u.id=l.reviewer_user_id
     WHERE l.chain_id=$1::bigint AND l.active=TRUE ORDER BY l.sequence_number`,
    [chain.id]
  )).rows;
  return {...chain, levels};
}

async function chainApproversCleared(chainId, confidentialityLevel) {
  const requested = CONFIDENTIALITY.indexOf(confidentialityLevel || "Internal");
  if (requested <= 0) return true;
  const approvers = (await pool.query(
    `SELECT DISTINCT approver_user_id FROM finance_journal_workflow_levels WHERE chain_id=$1::bigint AND active=TRUE AND approver_user_id IS NOT NULL`,
    [chainId]
  )).rows;
  for (const row of approvers) {
    const clearance = (await pool.query(
      `SELECT p.max_confidentiality FROM finance_approved_positions p JOIN users u ON p.position_key=LOWER(TRIM(COALESCE(u.job_title,''))) WHERE u.id=$1::bigint AND p.active=TRUE LIMIT 1`,
      [row.approver_user_id]
    )).rows[0];
    if (CONFIDENTIALITY.indexOf(clearance?.max_confidentiality || "Internal") < requested) return false;
  }
  return true;
}

async function resolveJournalChain(journal, confidentialityLevel = "Internal") {
  const responsibility = (await pool.query(
    `SELECT finance_function FROM finance_employee_responsibilities WHERE user_id=$1::bigint AND active=TRUE LIMIT 1`,
    [journal.preparer_user_id]
  )).rows[0];
  if (!responsibility?.finance_function) return {chain: null, fallback: "governed_review_queue", reason: "no_finance_function"};
  const chain = await getWorkflowChain({financeFunction: responsibility.finance_function, workItemType: "journal", confidentialityLevel});
  if (!chain) return {chain: null, fallback: "governed_review_queue", reason: "no_matching_chain"};
  const cleared = await chainApproversCleared(chain.id, confidentialityLevel);
  if (!cleared) return {chain: null, fallback: "governed_review_queue", reason: "APPROVER_CLEARANCE_INSUFFICIENT"};
  return {chain};
}

async function notifyUser(userId, subject, text) {
  try {
    const user = (await pool.query(`SELECT email,name FROM users WHERE id=$1::bigint`, [userId])).rows[0];
    if (!user?.email) return;
    await sendEmail({
      to: user.email,
      category: "finance_journal_workflow",
      subject,
      text,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(text)}</p></div>`
    });
  } catch (error) {
    console.warn("Journal workflow notification failed:", error.message);
  }
}

async function lastApprovedLevel(client, journalId) {
  const result = await client.query(
    `SELECT COALESCE(MAX(a.approval_level),0) AS last_level FROM finance_journal_workflow_audits a
     WHERE a.journal_id=$1::bigint AND a.action='approve'
       AND a.created_at > (SELECT COALESCE(MAX(created_at),'1970-01-01'::timestamptz) FROM finance_journal_workflow_audits WHERE journal_id=$1::bigint AND action IN ('submit','resubmit'))`,
    [journalId]
  );
  return Number(result.rows[0].last_level);
}

async function approverAuthorised(levelRow, approverUserId, delegationId) {
  if (levelRow.approver_user_id != null && Number(levelRow.approver_user_id) === Number(approverUserId)) {
    return {authorised: true, delegationId: null};
  }
  if (levelRow.backup_approver_user_id != null && Number(levelRow.backup_approver_user_id) === Number(approverUserId)) {
    const primary = levelRow.approver_user_id != null
      ? (await pool.query(`SELECT status,archived_at FROM users WHERE id=$1::bigint`, [levelRow.approver_user_id])).rows[0]
      : null;
    if (!primary || primary.status !== "active" || primary.archived_at) {
      return {authorised: true, delegationId: null, viaBackup: true};
    }
  }
  if (levelRow.approver_user_id != null) {
    const delegation = (await pool.query(
      `SELECT id FROM finance_delegated_authority WHERE delegator_user_id=$1::bigint AND delegate_user_id=$2::bigint AND scope IN ('journal_approval','all_actions') AND revoked_at IS NULL AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
      [levelRow.approver_user_id, approverUserId]
    )).rows[0];
    if (delegation && (delegationId == null || Number(delegationId) === Number(delegation.id))) {
      return {authorised: true, delegationId: delegation.id, viaDelegation: true};
    }
  }
  return {authorised: false, delegationId: null};
}

async function submitJournal({journalId, submitterUserId}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const journal = (await client.query(`SELECT id,journal_reference,status,preparer_user_id,description FROM finance_journals WHERE id=$1::bigint FOR UPDATE`, [journalId])).rows[0];
    if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
    if (journal.status !== "draft") throw fail(409, "JOURNAL_ALREADY_SUBMITTED", "Only draft journals can be submitted.");
    const chainResolution = await resolveJournalChain(journal);
    await client.query(`UPDATE finance_journals SET status='submitted',submitted_at=NOW(),updated_by=$2::bigint,updated_at=NOW() WHERE id=$1::bigint`, [journalId, submitterUserId]);
    await client.query(
      `INSERT INTO finance_journal_workflow_audits(journal_id,previous_status,new_status,approval_level,actor_user_id,action,reason)
       VALUES($1::bigint,$2,'submitted',NULL,$3::bigint,'submit',$4)`,
      [journalId, journal.status, submitterUserId, chainResolution.chain ? `chain:${chainResolution.chain.id}` : `fallback:${chainResolution.fallback}`]
    );
    await client.query("COMMIT");
    if (chainResolution.chain?.levels?.length) {
      const first = chainResolution.chain.levels[0];
      const target = first.reviewer_user_id || first.approver_user_id;
      if (target) await notifyUser(target, `[${journal.journal_reference}] Journal submitted for review`, `Journal '${journal.description}' has been submitted and awaits level ${first.sequence_number} review.`);
    }
    return {journalId, status: "submitted", chain: chainResolution.chain, fallback: chainResolution.fallback || null, reason: chainResolution.reason || null};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function approveLevel({journalId, approverUserId, level, reason, delegationId}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const journal = (await client.query(`SELECT id,journal_reference,status,preparer_user_id,description FROM finance_journals WHERE id=$1::bigint FOR UPDATE`, [journalId])).rows[0];
    if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
    if (!["submitted", "under_review"].includes(journal.status)) throw fail(409, "JOURNAL_INVALID_TRANSITION", `Journals in status '${journal.status}' cannot be approved.`);
    const chainResolution = await resolveJournalChain(journal);
    const chain = chainResolution.chain;
    if (!chain) throw fail(409, "WORKFLOW_CHAIN_NOT_CONFIGURED", `No active approval chain is configured for this journal (${chainResolution.reason}).`);
    const levelRow = chain.levels.find(l => Number(l.sequence_number) === Number(level));
    if (!levelRow) throw fail(404, "APPROVAL_LEVEL_NOT_FOUND", `Approval level ${level} is not configured for this chain.`);
    const previous = await lastApprovedLevel(client, journalId);
    if (Number(level) <= previous) throw fail(409, "APPROVAL_ALREADY_COMPLETED", `Level ${level} has already been approved for this journal.`);
    if (Number(level) !== previous + 1) throw fail(409, "APPROVAL_LEVEL_SEQUENCE_VIOLATION", `Level ${previous + 1} must be approved before level ${level}.`);
    const sod = await checkSeparationOfDuties({preparerUserId: journal.preparer_user_id, approverUserId});
    if (!sod.valid) throw fail(409, "SEPARATION_OF_DUTIES_VIOLATION", "The preparer cannot approve their own journal.");
    const authorisation = await approverAuthorised(levelRow, approverUserId, delegationId);
    if (!authorisation.authorised) throw fail(403, "APPROVER_NOT_AUTHORISED", "You are not the configured approver or an active delegate for this level.");
    const maxLevel = Math.max(...chain.levels.map(l => Number(l.sequence_number)));
    const isLast = Number(level) === maxLevel;
    const newStatus = isLast ? "approved" : "under_review";
    assertTransition(journal.status, newStatus);
    if (isLast) {
      await client.query(`UPDATE finance_journals SET status='approved',approved_at=NOW(),approver_user_id=$2::bigint,updated_by=$2::bigint,updated_at=NOW() WHERE id=$1::bigint`, [journalId, approverUserId]);
    } else {
      await client.query(`UPDATE finance_journals SET status='under_review',updated_by=$2::bigint,updated_at=NOW() WHERE id=$1::bigint`, [journalId, approverUserId]);
    }
    await client.query(
      `INSERT INTO finance_journal_workflow_audits(journal_id,previous_status,new_status,approval_level,actor_user_id,action,reason,delegation_id)
       VALUES($1::bigint,$2,$3,$4,$5::bigint,'approve',$6,$7::bigint)`,
      [journalId, journal.status, newStatus, Number(level), approverUserId, reason ?? null, authorisation.delegationId ?? null]
    );
    await client.query("COMMIT");
    if (!isLast) {
      const next = chain.levels.find(l => Number(l.sequence_number) === Number(level) + 1);
      const target = next?.reviewer_user_id || next?.approver_user_id;
      if (target) await notifyUser(target, `[${journal.journal_reference}] Journal ready for level ${next.sequence_number}`, `Journal '${journal.description}' has been approved at level ${level} and awaits level ${next.sequence_number}.`);
    } else {
      await notifyUser(journal.preparer_user_id, `[${journal.journal_reference}] Journal approved`, `Your journal has been approved at all levels and is ready for publishing.`);
    }
    return {journalId, status: newStatus, approvedLevel: Number(level), maxLevel, isLast, viaDelegation: Boolean(authorisation.viaDelegation), viaBackup: Boolean(authorisation.viaBackup)};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function rejectJournal({journalId, rejectorUserId, level, reason}) {
  if (!reason) throw fail(400, "REJECTION_REASON_REQUIRED", "A rejection reason is required.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const journal = (await client.query(`SELECT id,journal_reference,status,preparer_user_id,description FROM finance_journals WHERE id=$1::bigint FOR UPDATE`, [journalId])).rows[0];
    if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
    if (!["submitted", "under_review"].includes(journal.status)) throw fail(409, "JOURNAL_INVALID_TRANSITION", `Journals in status '${journal.status}' cannot be rejected.`);
    assertTransition(journal.status, "rejected");
    await client.query(`UPDATE finance_journals SET status='rejected',rejection_reason=$2,updated_by=$3::bigint,updated_at=NOW() WHERE id=$1::bigint`, [journalId, reason, rejectorUserId]);
    await client.query(
      `INSERT INTO finance_journal_workflow_audits(journal_id,previous_status,new_status,approval_level,actor_user_id,action,reason)
       VALUES($1::bigint,$2,'rejected',$3,$4::bigint,'reject',$5)`,
      [journalId, journal.status, level ?? null, rejectorUserId, reason]
    );
    await client.query("COMMIT");
    await notifyUser(journal.preparer_user_id, `[${journal.journal_reference}] Journal rejected`, `Your journal was rejected at level ${level ?? "review"}. Reason: ${reason}`);
    return {journalId, status: "rejected", level: level ?? null};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function returnJournal({journalId, returnerUserId, level, reason}) {
  if (!reason) throw fail(400, "RETURN_REASON_REQUIRED", "A return reason is required.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const journal = (await client.query(`SELECT id,journal_reference,status,preparer_user_id,description FROM finance_journals WHERE id=$1::bigint FOR UPDATE`, [journalId])).rows[0];
    if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
    if (!["submitted", "under_review"].includes(journal.status)) throw fail(409, "JOURNAL_INVALID_TRANSITION", `Journals in status '${journal.status}' cannot be returned.`);
    assertTransition(journal.status, "returned");
    await client.query(`UPDATE finance_journals SET status='returned',return_reason=$2,updated_by=$3::bigint,updated_at=NOW() WHERE id=$1::bigint`, [journalId, reason, returnerUserId]);
    await client.query(
      `INSERT INTO finance_journal_workflow_audits(journal_id,previous_status,new_status,approval_level,actor_user_id,action,reason)
       VALUES($1::bigint,$2,'returned',$3,$4::bigint,'return',$5)`,
      [journalId, journal.status, level ?? null, returnerUserId, reason]
    );
    await client.query("COMMIT");
    await notifyUser(journal.preparer_user_id, `[${journal.journal_reference}] Journal returned for correction`, `Your journal was returned at level ${level ?? "review"}. Feedback: ${reason}`);
    return {journalId, status: "returned", level: level ?? null};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function resubmitJournal({journalId, submitterUserId}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const journal = (await client.query(`SELECT id,journal_reference,status,preparer_user_id,description FROM finance_journals WHERE id=$1::bigint FOR UPDATE`, [journalId])).rows[0];
    if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
    if (journal.status !== "returned") throw fail(409, "JOURNAL_INVALID_TRANSITION", "Only returned journals can be resubmitted.");
    assertTransition(journal.status, "submitted");
    const chainResolution = await resolveJournalChain(journal);
    await client.query(`UPDATE finance_journals SET status='submitted',submitted_at=NOW(),updated_by=$2::bigint,updated_at=NOW() WHERE id=$1::bigint`, [journalId, submitterUserId]);
    await client.query(
      `INSERT INTO finance_journal_workflow_audits(journal_id,previous_status,new_status,approval_level,actor_user_id,action,reason)
       VALUES($1::bigint,$2,'submitted',NULL,$3::bigint,'resubmit',$4)`,
      [journalId, journal.status, submitterUserId, chainResolution.chain ? `chain:${chainResolution.chain.id}` : `fallback:${chainResolution.fallback}`]
    );
    await client.query("COMMIT");
    if (chainResolution.chain?.levels?.length) {
      const first = chainResolution.chain.levels[0];
      const target = first.reviewer_user_id || first.approver_user_id;
      if (target) await notifyUser(target, `[${journal.journal_reference}] Journal resubmitted`, `Journal '${journal.description}' has been resubmitted and restarts at level ${first.sequence_number}.`);
    }
    return {journalId, status: "submitted", chain: chainResolution.chain, fallback: chainResolution.fallback || null};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function publishJournal({journalId, publisherUserId}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const journal = (await client.query(`SELECT id,journal_reference,status,preparer_user_id,description FROM finance_journals WHERE id=$1::bigint FOR UPDATE`, [journalId])).rows[0];
    if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
    if (journal.status !== "approved") throw fail(409, "JOURNAL_INVALID_TRANSITION", "Only approved journals can be published.");
    const chainResolution = await resolveJournalChain(journal);
    const chain = chainResolution.chain;
    if (chain) {
      const maxLevel = Math.max(...chain.levels.map(l => Number(l.sequence_number)));
      const approved = await lastApprovedLevel(client, journalId);
      if (approved < maxLevel) throw fail(409, "APPROVAL_INCOMPLETE", `All ${maxLevel} approval levels must be completed before publishing (completed: ${approved}).`);
    }
    assertTransition(journal.status, "published");
    await client.query(`UPDATE finance_journals SET status='published',posted_at=NOW(),updated_by=$2::bigint,updated_at=NOW() WHERE id=$1::bigint`, [journalId, publisherUserId]);
    await client.query(
      `INSERT INTO finance_journal_workflow_audits(journal_id,previous_status,new_status,approval_level,actor_user_id,action,reason)
       VALUES($1::bigint,$2,'published',NULL,$3::bigint,'publish',NULL)`,
      [journalId, journal.status, publisherUserId]
    );
    await client.query("COMMIT");
    await notifyUser(journal.preparer_user_id, `[${journal.journal_reference}] Journal published`, `Your journal has been published and is locked from further edits.`);
    return {journalId, status: "published"};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function resolveActiveApprover({journalId, level}) {
  const journal = (await pool.query(`SELECT id,preparer_user_id FROM finance_journals WHERE id=$1::bigint`, [journalId])).rows[0];
  if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
  const chainResolution = await resolveJournalChain(journal);
  if (!chainResolution.chain) return {approver: null, fallback: chainResolution.fallback, reason: chainResolution.reason};
  const levelRow = chainResolution.chain.levels.find(l => Number(l.sequence_number) === Number(level));
  if (!levelRow) throw fail(404, "APPROVAL_LEVEL_NOT_FOUND", `Approval level ${level} is not configured for this chain.`);
  const primary = levelRow.approver_user_id != null
    ? (await pool.query(`SELECT id,status,archived_at FROM users WHERE id=$1::bigint`, [levelRow.approver_user_id])).rows[0]
    : null;
  if (primary && primary.status === "active" && !primary.archived_at) {
    const sod = await checkSeparationOfDuties({preparerUserId: journal.preparer_user_id, approverUserId: primary.id});
    if (sod.valid) return {approver: {userId: primary.id, name: levelRow.approver_name}, level: levelRow};
  }
  const backup = levelRow.backup_approver_user_id != null
    ? (await pool.query(`SELECT id,status,archived_at FROM users WHERE id=$1::bigint`, [levelRow.backup_approver_user_id])).rows[0]
    : null;
  if (backup && backup.status === "active" && !backup.archived_at) {
    const sod = await checkSeparationOfDuties({preparerUserId: journal.preparer_user_id, approverUserId: backup.id});
    if (sod.valid) return {approver: {userId: backup.id, name: levelRow.backup_approver_name}, isBackup: true, originalApproverUnavailable: Boolean(primary), reason: primary ? "PRIMARY_UNAVAILABLE" : null, level: levelRow};
  }
  if (primary && primary.status === "active" && !primary.archived_at) {
    return {approver: null, fallback: "escalation_queue", reason: "SOD_VIOLATION", level: levelRow};
  }
  return {approver: null, fallback: "escalation_queue", reason: "PRIMARY_UNAVAILABLE", level: levelRow};
}

async function getWorkflowHistory(journalId) {
  const result = await pool.query(`SELECT * FROM finance_journal_workflow_audits WHERE journal_id=$1::bigint ORDER BY created_at`, [journalId]);
  return result.rows;
}

async function assertJournalEditable(journalId) {
  const journal = (await pool.query(`SELECT status FROM finance_journals WHERE id=$1::bigint`, [journalId])).rows[0];
  if (!journal) throw fail(404, "JOURNAL_NOT_FOUND", "Journal not found.");
  if (["submitted", "under_review", "published"].includes(journal.status)) {
    throw fail(409, "JOURNAL_LOCKED_UNDER_REVIEW", "This journal is locked while under review or published.");
  }
}

module.exports = {
  STATE_MACHINE,
  createWorkflowChain,
  addWorkflowLevel,
  getWorkflowChain,
  submitJournal,
  approveLevel,
  rejectJournal,
  returnJournal,
  resubmitJournal,
  publishJournal,
  resolveActiveApprover,
  getWorkflowHistory,
  assertJournalEditable
};