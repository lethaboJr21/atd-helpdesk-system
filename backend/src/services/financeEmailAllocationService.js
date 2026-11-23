const pool = require("../db/pool");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const CATEGORIES = new Set(["reminders", "allocations", "escalations"]);

async function auditOptOut(userId, action, category) {
  try {
    await pool.query(
      `INSERT INTO finance_governance_actions(record_type,record_id,action,actor_user_id,detail)
       VALUES('email_opt_out',$1::bigint,$2,$1::bigint,$3::jsonb)`,
      [userId, action, JSON.stringify({category})]
    );
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) console.warn("Email opt-out audit failed:", error.message);
  }
}

async function createAllocationRule({financeFunction, officeCode, workItemType, recipientUserIds, createdBy}) {
  if (!createdBy) throw fail(400, "ALLOCATION_RULE_FIELDS_REQUIRED", "A creating user is required.");
  const recipients = Array.from(new Set((recipientUserIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0)));
  if (!recipients.length) throw fail(400, "ALLOCATION_RECIPIENTS_REQUIRED", "At least one recipient user ID is required.");
  const result = await pool.query(
    `INSERT INTO finance_email_allocation_rules(finance_function,office_code,work_item_type,recipient_user_ids,active,created_by)
     VALUES($1,$2,$3,$4::bigint[],TRUE,$5::bigint) RETURNING *`,
    [financeFunction ?? null, officeCode ?? null, workItemType ?? null, recipients, createdBy]
  );
  return result.rows[0];
}

async function updateAllocationRule(id, patch, updatedBy) {
  if (!patch || !Object.keys(patch).length) throw fail(400, "ALLOCATION_RULE_PATCH_EMPTY", "No update fields provided.");
  const fields = [];
  const params = [];
  const map = { financeFunction: "finance_function", officeCode: "office_code", workItemType: "work_item_type", active: "active" };
  for (const [key, column] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      params.push(patch[key] ?? null);
      fields.push(`${column}=$${params.length}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "recipientUserIds")) {
    const recipients = Array.from(new Set((patch.recipientUserIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0)));
    if (!recipients.length) throw fail(400, "ALLOCATION_RECIPIENTS_REQUIRED", "At least one recipient user ID is required.");
    params.push(recipients);
    fields.push(`recipient_user_ids=$${params.length}::bigint[]`);
  }
  if (!fields.length) throw fail(400, "ALLOCATION_RULE_PATCH_EMPTY", "No update fields provided.");
  params.push(id);
  const result = await pool.query(
    `UPDATE finance_email_allocation_rules SET ${fields.join(",")} WHERE id=$${params.length}::bigint RETURNING *`,
    params
  );
  if (!result.rowCount) throw fail(404, "ALLOCATION_RULE_NOT_FOUND", "Allocation rule not found.");
  return result.rows[0];
}

async function deactivateAllocationRule(id, deactivatedBy) {
  const rule = (await pool.query(`SELECT * FROM finance_email_allocation_rules WHERE id=$1::bigint`, [id])).rows[0];
  if (!rule) throw fail(404, "ALLOCATION_RULE_NOT_FOUND", "Allocation rule not found.");
  await pool.query(`UPDATE finance_email_allocation_rules SET active=FALSE WHERE id=$1::bigint`, [id]);
  try {
    await pool.query(
      `UPDATE finance_task_reminders SET enabled=FALSE WHERE user_id=ANY($1::bigint[]) AND last_sent_at IS NULL`,
      [rule.recipient_user_ids || []]
    );
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) console.warn("Pending reminder cancellation failed:", error.message);
  }
  return {...rule, active: false};
}

async function getAllocationRules({activeOnly = true} = {}) {
  const result = await pool.query(
    `SELECT * FROM finance_email_allocation_rules ${activeOnly ? "WHERE active=TRUE" : ""} ORDER BY created_at DESC`
  );
  return result.rows;
}

async function resolveOnLeaveReplacement(userId) {
  const user = (await pool.query(`SELECT status FROM users WHERE id=$1::bigint`, [userId])).rows[0];
  if (!user || user.status !== "on_leave") return {userId, replaced: false};
  const backup = (await pool.query(
    `SELECT COALESCE(primary_backup_user_id,secondary_backup_user_id) AS backup_user_id FROM finance_employee_function_memberships
     WHERE user_id=$1::bigint AND active=TRUE AND COALESCE(primary_backup_user_id,secondary_backup_user_id) IS NOT NULL LIMIT 1`,
    [userId]
  )).rows[0];
  if (backup?.backup_user_id) return {userId: Number(backup.backup_user_id), replaced: true, originalUserId: Number(userId)};
  return {userId, replaced: false, onLeave: true};
}

async function resolveRecipients({financeFunction, officeCode, workItemType, assigneeUserId}) {
  try {
    const rules = (await pool.query(
      `SELECT id,recipient_user_ids FROM finance_email_allocation_rules
       WHERE active=TRUE AND (finance_function IS NULL OR finance_function=$1)
         AND (office_code IS NULL OR office_code=$2) AND (work_item_type IS NULL OR work_item_type=$3)`,
      [financeFunction ?? null, officeCode ?? null, workItemType ?? null]
    )).rows;
    if (!rules.length) {
      return {recipients: assigneeUserId != null ? [Number(assigneeUserId)] : [], fromRules: false};
    }
    const recipientSet = new Set();
    for (const rule of rules) for (const uid of rule.recipient_user_ids || []) recipientSet.add(Number(uid));
    if (recipientSet.size) {
      const optOuts = (await pool.query(
        `SELECT user_id FROM finance_email_opt_outs WHERE opted_back_in_at IS NULL AND category='allocations' AND user_id=ANY($1::bigint[])`,
        [Array.from(recipientSet)]
      )).rows.map(r => Number(r.user_id));
      for (const uid of optOuts) recipientSet.delete(uid);
    }
    const resolved = [];
    for (const uid of recipientSet) {
      const replacement = await resolveOnLeaveReplacement(uid);
      if (replacement.userId != null) resolved.push(Number(replacement.userId));
    }
    return {recipients: Array.from(new Set(resolved)), fromRules: true};
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) {
      return {recipients: assigneeUserId != null ? [Number(assigneeUserId)] : [], fromRules: false};
    }
    throw error;
  }
}

async function optOut({userId, category}) {
  if (!userId) throw fail(400, "OPT_OUT_USER_REQUIRED", "A user ID is required.");
  if (!CATEGORIES.has(category)) throw fail(400, "INVALID_OPT_OUT_CATEGORY", "Category must be reminders, allocations or escalations.");
  await pool.query(
    `INSERT INTO finance_email_opt_outs(user_id,category,opted_out_at) VALUES($1::bigint,$2,NOW())
     ON CONFLICT (user_id,category) WHERE opted_back_in_at IS NULL DO UPDATE SET opted_out_at=NOW()`,
    [userId, category]
  );
  await auditOptOut(userId, "opt_out", category);
  return {userId, category, optedOut: true};
}

async function optBackIn({userId, category}) {
  if (!userId) throw fail(400, "OPT_OUT_USER_REQUIRED", "A user ID is required.");
  if (!CATEGORIES.has(category)) throw fail(400, "INVALID_OPT_OUT_CATEGORY", "Category must be reminders, allocations or escalations.");
  const result = await pool.query(
    `UPDATE finance_email_opt_outs SET opted_back_in_at=NOW() WHERE user_id=$1::bigint AND category=$2 AND opted_back_in_at IS NULL`,
    [userId, category]
  );
  await auditOptOut(userId, "opt_back_in", category);
  return {userId, category, updated: result.rowCount};
}

async function shouldSendEmail({userId, category, itemPriority, isOverdue, isEscalation}) {
  if (userId == null) return true;
  try {
    const active = await pool.query(
      `SELECT 1 FROM finance_email_opt_outs WHERE user_id=$1::bigint AND category=$2 AND opted_back_in_at IS NULL LIMIT 1`,
      [userId, category]
    );
    if (!active.rowCount) return true;
    return Boolean(isOverdue) || Boolean(isEscalation) || String(itemPriority || "").toLowerCase() === "critical";
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return true;
    throw error;
  }
}

async function logDelivery({ruleId, recipientUserId, emailType, ticketId, delivered}) {
  const result = await pool.query(
    `INSERT INTO finance_email_delivery_log(rule_id,recipient_user_id,email_type,task_id,delivered,status)
     VALUES($1::bigint,$2::bigint,$3,$4::bigint,$5,$6) RETURNING *`,
    [ruleId ?? null, recipientUserId, emailType, ticketId ?? null, delivered !== false, delivered !== false ? "sent" : "skipped"]
  );
  return result.rows[0];
}

async function getDeliveryStats({since} = {}) {
  const result = await pool.query(
    `SELECT email_type,delivered,COUNT(*) AS count FROM finance_email_delivery_log ${since ? "WHERE sent_at >= $1" : ""} GROUP BY email_type,delivered`,
    since ? [since] : []
  );
  return result.rows;
}

module.exports = {
  createAllocationRule,
  updateAllocationRule,
  deactivateAllocationRule,
  getAllocationRules,
  resolveRecipients,
  optOut,
  optBackIn,
  shouldSendEmail,
  logDelivery,
  getDeliveryStats
};