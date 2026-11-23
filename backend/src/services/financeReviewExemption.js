const pool = require("../db/pool");

async function grantExemption({workItemId, workItemType, reason, approverUserId}) {
  if (String(reason || "").trim().length < 5) throw Object.assign(new Error("A reason of at least 5 characters is required."), {status: 400});

  const existing = (await pool.query(
    `SELECT id FROM finance_review_exemptions WHERE work_item_id=$1 AND work_item_type=$2 AND revoked_at IS NULL`,
    [workItemId, workItemType]
  )).rows[0];
  if (existing) throw Object.assign(new Error("An active exemption already exists for this work item."), {status: 409});

  const result = await pool.query(
    `INSERT INTO finance_review_exemptions(work_item_id,work_item_type,reason,approver_user_id) VALUES($1,$2,$3,$4) RETURNING *`,
    [workItemId, workItemType, reason.trim(), approverUserId]
  );

  if (workItemType === 'ticket') {
    await pool.query(`UPDATE finance_ticket_operations SET review_state='exempt',updated_at=NOW() WHERE ticket_id=$1`, [workItemId]);
  } else {
    const tables = {journal: "finance_journals", reconciliation: "finance_reconciliations", month_end: "finance_close_tasks"};
    const table = tables[workItemType];
    if (table) {
      await pool.query(`UPDATE ${table} SET review_state='exempt',updated_at=NOW() WHERE id=$1`, [workItemId]);
    }
  }

  return result.rows[0];
}

async function revokeExemption({workItemId, workItemType, revocationReason, revokedBy}) {
  if (String(revocationReason || "").trim().length < 5) throw Object.assign(new Error("A revocation reason is at least 5 characters is required."), {status: 400});

  const result = await pool.query(
    `UPDATE finance_review_exemptions SET revoked_at=NOW(),revoked_by=$1,revocation_reason=$2
     WHERE work_item_id=$3 AND work_item_type=$4 AND revoked_at IS NULL RETURNING *`,
    [revokedBy, revocationReason.trim(), workItemId, workItemType]
  );
  if (!result.rowCount) throw Object.assign(new Error("No active exemption found for this work item."), {status: 404});

  if (workItemType === 'ticket') {
    await pool.query(`UPDATE finance_ticket_operations SET review_state='awaiting_review',updated_at=NOW() WHERE ticket_id=$1`, [workItemId]);
  } else {
    const tables = {journal: "finance_journals", reconciliation: "finance_reconciliations", month_end: "finance_close_tasks"};
    const table = tables[workItemType];
    if (table) {
      await pool.query(`UPDATE ${table} SET review_state='awaiting_review',updated_at=NOW() WHERE id=$1`, [workItemId]);
    }
  }

  return result.rows[0];
}

async function getActiveExemptions({workItemId, workItemType}) {
  const clauses = ["revoked_at IS NULL"];
  const params = [];
  if (workItemId) { params.push(workItemId); clauses.push(`work_item_id=$${params.length}`); }
  if (workItemType) { params.push(workItemType); clauses.push(`work_item_type=$${params.length}`); }
  return (await pool.query(`SELECT * FROM finance_review_exemptions WHERE ${clauses.join(" AND ")} ORDER BY granted_at DESC`, params)).rows;
}

module.exports = {grantExemption, revokeExemption, getActiveExemptions};