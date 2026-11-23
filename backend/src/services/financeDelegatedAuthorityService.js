const pool = require("../db/pool");
const config = require("../config");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const MANAGER_LEVELS = new Set(["manager", "workspace_manager", "security_admin", "director", "executive"]);

async function grantDelegation({delegatorUserId, delegateUserId, scope, expiresAt, reason}) {
  if (!delegatorUserId || !delegateUserId || !scope) throw fail(400, "DELEGATION_FIELDS_REQUIRED", "Delegator, delegate and scope are required.");
  if (String(delegatorUserId) === String(delegateUserId)) throw fail(400, "DELEGATION_TO_SELF_PROHIBITED", "Users cannot delegate authority to themselves.");
  if (!reason || !String(reason).trim()) throw fail(400, "DELEGATION_REASON_REQUIRED", "A delegation reason is required.");
  if (!expiresAt) throw fail(400, "DELEGATION_EXPIRY_REQUIRED", "A delegation expiry is required.");
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime())) throw fail(400, "DELEGATION_EXPIRY_INVALID", "The delegation expiry is not a valid date.");
  if (expiry.getTime() <= Date.now()) throw fail(400, "DELEGATION_EXPIRY_INVALID", "The delegation expiry must be in the future.");
  const maxDays = config.financeAdvanced?.delegationMaxDays ?? 30;
  if (expiry.getTime() > Date.now() + maxDays * 86400000) throw fail(400, "DELEGATION_EXPIRY_TOO_FAR", `Delegations cannot expire more than ${maxDays} days ahead.`);
  const delegator = (await pool.query(
    `SELECT u.id,u.status,u.archived_at,fr.is_finance_manager,p.access_level FROM users u
     LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=u.id AND fr.active=TRUE
     LEFT JOIN finance_approved_positions p ON p.position_key=LOWER(TRIM(COALESCE(u.job_title,''))) AND p.active=TRUE
     WHERE u.id=$1::bigint`,
    [delegatorUserId]
  )).rows[0];
  if (!delegator) throw fail(404, "DELEGATOR_NOT_FOUND", "Delegator not found.");
  if (!delegator.is_finance_manager && !MANAGER_LEVELS.has(delegator.access_level)) {
    throw fail(403, "DELEGATION_SCOPE_EXCEEDS_AUTHORITY", "The delegator does not possess the authority being delegated.");
  }
  const delegate = (await pool.query(`SELECT id,status,archived_at FROM users WHERE id=$1::bigint`, [delegateUserId])).rows[0];
  if (!delegate) throw fail(404, "DELEGATE_NOT_FOUND", "Delegate not found.");
  if (delegate.archived_at) throw fail(400, "USER_ARCHIVED", "The delegate account is archived.");
  if (delegate.status !== "active") throw fail(400, "USER_INACTIVE", "The delegate account is not active.");
  try {
    const result = await pool.query(
      `INSERT INTO finance_delegated_authority(delegator_user_id,delegate_user_id,scope,expires_at,reason)
       VALUES($1::bigint,$2::bigint,$3,$4,$5) RETURNING *`,
      [delegatorUserId, delegateUserId, scope, expiry.toISOString(), String(reason).trim()]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23514") throw fail(400, "DELEGATION_EXPIRY_TOO_FAR", `Delegations cannot expire more than ${maxDays} days ahead.`);
    throw error;
  }
}

async function revokeDelegation(delegationId, revokedBy, revocationReason) {
  const existing = (await pool.query(`SELECT id,revoked_at FROM finance_delegated_authority WHERE id=$1::bigint`, [delegationId])).rows[0];
  if (!existing) throw fail(404, "DELEGATION_NOT_FOUND", "Delegation not found.");
  if (existing.revoked_at) throw fail(409, "DELEGATION_ALREADY_REVOKED", "This delegation has already been revoked.");
  const result = await pool.query(
    `UPDATE finance_delegated_authority SET revoked_at=NOW(),revoked_by=$2::bigint,revocation_reason=$3 WHERE id=$1::bigint RETURNING *`,
    [delegationId, revokedBy, revocationReason ?? null]
  );
  return result.rows[0];
}

async function checkDelegation(userId, scope) {
  const result = await pool.query(
    `SELECT * FROM finance_delegated_authority WHERE delegate_user_id=$1::bigint AND (scope=$2 OR scope='all_actions') AND revoked_at IS NULL AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
    [userId, scope]
  );
  return {hasDelegation: Boolean(result.rowCount), delegation: result.rows[0] || null};
}

async function getActiveDelegations({delegatorUserId, delegateUserId} = {}) {
  const clauses = [`revoked_at IS NULL`, `expires_at > NOW()`];
  const params = [];
  if (delegatorUserId != null) { params.push(delegatorUserId); clauses.push(`delegator_user_id=$${params.length}::bigint`); }
  if (delegateUserId != null) { params.push(delegateUserId); clauses.push(`delegate_user_id=$${params.length}::bigint`); }
  const result = await pool.query(
    `SELECT d.*,dg.name delegator_name,dl.name delegate_name FROM finance_delegated_authority d
     LEFT JOIN users dg ON dg.id=d.delegator_user_id LEFT JOIN users dl ON dl.id=d.delegate_user_id
     WHERE ${clauses.join(" AND ")} ORDER BY d.expires_at ASC`,
    params
  );
  return result.rows;
}

async function purgeExpiredDelegations() {
  const result = await pool.query(
    `UPDATE finance_delegated_authority SET revoked_at=NOW(),revocation_reason=COALESCE(revocation_reason,'expired') WHERE expires_at < NOW() AND revoked_at IS NULL`
  );
  return {purged: result.rowCount};
}

function assertWithinAuthority(financeAccess, subjectUserId) {
  const level = financeAccess?.accessLevel;
  if (["workspace_manager", "security_admin", "director", "executive"].includes(level)) return;
  const scope = (financeAccess?.reportingScope || []).map(String);
  if (scope.includes(String(subjectUserId))) return;
  throw fail(403, "AUTHORITY_SCOPE_EXCEEDED", "The subject employee is outside your reporting authority.");
}

function assertNotSelfRolePromotion(actorUserId, targetUserId, newRole) {
  const elevated = new Set(["manager", "workspace_manager", "director", "executive", "security_admin", "admin", "superadmin"]);
  if (String(actorUserId) === String(targetUserId) && elevated.has(String(newRole || "").toLowerCase())) {
    throw fail(403, "SELF_ROLE_PROMOTION_PROHIBITED", "Users cannot promote their own role.");
  }
}

async function recordHodOverride({hodUserId, targetType, targetId, originalValue, newValue, reason}) {
  const result = await pool.query(
    `INSERT INTO finance_governance_actions(record_type,record_id,action,actor_user_id,reason,detail)
     VALUES('hod_override',$1::bigint,'hod_override',$2::bigint,$3,$4::jsonb) RETURNING *`,
    [targetId, hodUserId, reason ?? null, JSON.stringify({target_type: targetType, original_value: originalValue, new_value: newValue})]
  );
  return result.rows[0];
}

async function recordRoleAssignment({actorUserId, targetUserId, previousRole, newRole, reason}) {
  const result = await pool.query(
    `INSERT INTO finance_governance_actions(record_type,record_id,action,actor_user_id,reason,detail)
     VALUES('role_assignment',$1::bigint,'role_change',$2::bigint,$3,$4::jsonb) RETURNING *`,
    [targetUserId, actorUserId, reason ?? null, JSON.stringify({previous_role: previousRole ?? null, new_role: newRole ?? null})]
  );
  return result.rows[0];
}

module.exports = {
  grantDelegation,
  revokeDelegation,
  checkDelegation,
  getActiveDelegations,
  purgeExpiredDelegations,
  assertWithinAuthority,
  assertNotSelfRolePromotion,
  recordHodOverride,
  recordRoleAssignment
};