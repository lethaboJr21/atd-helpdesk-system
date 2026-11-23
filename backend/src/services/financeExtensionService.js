const pool = require("../db/pool");
const config = require("../config");

const DEPENDENCY_TYPES = new Set(["internal", "external", "other"]);
function assertValidDependencyType(value) {
  if (value != null && !DEPENDENCY_TYPES.has(value)) {
    throw Object.assign(new Error("Dependency type must be internal, external or other."), { status: 400, code: "INVALID_DEPENDENCY_TYPE" });
  }
}

async function createExtensionRequest({workItemId, workItemType, requestedDueAt, reason, dependencyType, requestedBy}) {
  if (String(reason || "").trim().length < 5) throw Object.assign(new Error("A reason of at least 5 characters is required."), {status: 400});

  const tables = {ticket: "tickets", journal: "finance_journals", reconciliation: "finance_reconciliations", month_end: "finance_close_tasks"};
  const table = tables[workItemType];
  if (!table) throw Object.assign(new Error("Invalid work item type."), {status: 400});
  assertValidDependencyType(dependencyType);

  const current = (await pool.query(`SELECT due_at, original_due_at, effective_due_at FROM ${table} WHERE id=$1`, [workItemId])).rows[0];
  if (!current) throw Object.assign(new Error("Work item not found."), {status: 404});

  const originalDueAt = current.original_due_at || current.due_at;

  const result = await pool.query(
    `INSERT INTO finance_extension_requests(work_item_id,work_item_type,requested_due_at,reason,dependency_type,original_due_at,requested_by)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [workItemId, workItemType, requestedDueAt, reason.trim(), dependencyType || "internal", originalDueAt, requestedBy]
  );
  return result.rows[0];
}

async function decideOnExtension({extensionId, decision, approverUserId, rejectionReason, dependencyType}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ext = (await client.query("SELECT * FROM finance_extension_requests WHERE id=$1 FOR UPDATE", [extensionId])).rows[0];
    if (!ext) throw Object.assign(new Error("Extension request not found."), {status: 404});
    if (ext.status !== "pending") throw Object.assign(new Error("Extension request has already been decided."), {status: 409});

    let auditDetail = null;
    if (decision === "approved") {
      assertValidDependencyType(dependencyType);
      const previousDependencyType = ext.dependency_type ?? null;
      const effectiveDependencyType = dependencyType ?? previousDependencyType;
      if (dependencyType != null) {
        await client.query(`UPDATE finance_extension_requests SET dependency_type=$1 WHERE id=$2`, [dependencyType, extensionId]);
      }
      await client.query(
        `UPDATE finance_extension_requests SET status='approved',approver_user_id=$1,approved_due_at=$2,decided_at=NOW() WHERE id=$3`,
        [approverUserId, ext.requested_due_at, extensionId]
      );

      const tables = {ticket: "tickets", journal: "finance_journals", reconciliation: "finance_reconciliations", month_end: "finance_close_tasks"};
      const table = tables[ext.work_item_type];
      if (table) {
        await client.query(`UPDATE ${table} SET effective_due_at=$1,updated_at=NOW() WHERE id=$2`, [ext.requested_due_at, ext.work_item_id]);
      }
      auditDetail = {
        decision,
        previousDependencyType,
        dependencyType: effectiveDependencyType,
        appliedAddBackPct: effectiveDependencyType === "external" || effectiveDependencyType === "other" ? config.financeAdvanced.crossDepartmentAddBackPct : 100,
        approvedDueAt: ext.requested_due_at
      };
    } else if (decision === "rejected") {
      if (String(rejectionReason || "").trim().length < 5) throw Object.assign(new Error("A rejection reason is required."), {status: 400});
      await client.query(
        `UPDATE finance_extension_requests SET status='rejected',approver_user_id=$1,rejection_reason=$2,decided_at=NOW() WHERE id=$3`,
        [approverUserId, rejectionReason.trim(), extensionId]
      );
    } else {
      throw Object.assign(new Error("Invalid decision. Use 'approved' or 'rejected'."), {status: 400});
    }

    await client.query("COMMIT");
    if (auditDetail != null) {
      try {
        await pool.query(
          `INSERT INTO finance_governance_actions(record_type, record_id, action, actor_user_id, reason, detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
          ["extension_request", extensionId, "extension_decision", approverUserId, decision, JSON.stringify(auditDetail)]
        );
      } catch (error) {
        if (!["42P01", "42703"].includes(error.code)) console.warn("Extension decision governance audit failed:", error.message);
      }
    }
    return (await pool.query("SELECT * FROM finance_extension_requests WHERE id=$1", [extensionId])).rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getPendingExtensions({workItemId, workItemType}) {
  const clauses = [];
  const params = [];
  if (workItemId) { params.push(workItemId); clauses.push(`work_item_id=$${params.length}`); }
  if (workItemType) { params.push(workItemType); clauses.push(`work_item_type=$${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (await pool.query(`SELECT * FROM finance_extension_requests ${where} ORDER BY created_at DESC`, params)).rows;
}

module.exports = {createExtensionRequest, decideOnExtension, getPendingExtensions};