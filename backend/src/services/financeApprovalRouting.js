const pool = require("../db/pool");

async function resolveApprover({financeFunction, workItemType, valueThreshold, confidentialityLevel}) {
  const rules = (await pool.query(
    `SELECT r.*,u.name reviewer_name,a.name approver_name,b.name backup_approver_name
     FROM finance_approval_routing_rules r
     LEFT JOIN users u ON u.id=r.reviewer_user_id
     LEFT JOIN users a ON a.id=r.approver_user_id
     LEFT JOIN users b ON b.id=r.backup_approver_user_id
     WHERE r.finance_function=$1 AND r.active=TRUE
       AND ($2::text='any' OR r.work_item_type='any' OR r.work_item_type=$2)
       AND ($3::numeric IS NULL OR r.value_threshold_min IS NULL OR r.value_threshold_min<=$3)
       AND ($3::numeric IS NULL OR r.value_threshold_max IS NULL OR r.value_threshold_max>=$3)
       AND ($4::text IS NULL OR r.confidentiality_level=$4)
     ORDER BY r.confidentiality_level='Internal' DESC, r.value_threshold_min DESC NULLS LAST LIMIT 1`,
    [financeFunction, workItemType || "any", valueThreshold || null, confidentialityLevel || "Internal"]
  )).rows;

  if (!rules.length) {
    return {resolved: false, reason: "no_matching_rule", fallback: "governed_review_queue"};
  }

  const rule = rules[0];
  const reviewer = rule.reviewer_user_id ? {userId: rule.reviewer_user_id, name: rule.reviewer_name} : null;
  const approver = rule.approver_user_id ? {userId: rule.approver_user_id, name: rule.approver_name, policy: rule.approver_policy} : null;
  const backupApprover = rule.backup_approver_user_id ? {userId: rule.backup_approver_user_id, name: rule.backup_approver_name} : null;

  if (approver) {
    const active = (await pool.query("SELECT status,archived_at FROM users WHERE id=$1", [approver.userId])).rows[0];
    if (!active || active.status !== "active" || active.archived_at) {
      if (backupApprover) {
        return {resolved: true, rule, reviewer, approver: {...backupApprover, policy: rule.approver_policy, isBackup: true}, originalApproverUnavailable: true};
      }
      return {resolved: true, rule, reviewer, approver: null, fallback: "escalation_queue", reason: "primary_unavailable"};
    }
  }

  return {resolved: true, rule, reviewer, approver, backupApprover};
}

async function checkSeparationOfDuties({preparerUserId, approverUserId}) {
  if (!preparerUserId || !approverUserId) return {valid: true};
  if (String(preparerUserId) === String(approverUserId)) {
    return {valid: false, violation: "preparer_is_approver"};
  }
  return {valid: true};
}

async function resolveWithSeparationOfDuties({financeFunction, workItemType, valueThreshold, confidentialityLevel, preparerUserId}) {
  const result = await resolveApprover({financeFunction, workItemType, valueThreshold, confidentialityLevel});
  if (!result.resolved || !result.approver) return result;

  const sod = await checkSeparationOfDuties({preparerUserId, approverUserId: result.approver.userId});
  if (!sod.valid) {
    if (result.backupApprover && String(result.backupApprover.userId) !== String(preparerUserId)) {
      return {...result, approver: {...result.backupApprover, policy: result.rule.approver_policy, isBackup: true, sodRedirect: true}, originalApproverSodConflict: true};
    }
    return {...result, approver: null, fallback: "escalation_queue", sodViolation: true};
  }
  return result;
}

module.exports = {resolveApprover, checkSeparationOfDuties, resolveWithSeparationOfDuties};