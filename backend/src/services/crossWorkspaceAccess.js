const pool = require("../db/pool");
const config = require("../config");
const cron = require("node-cron");
const { normaliseWorkspaceCode } = require("./workspaceCodeRegistry");

class ExceptionExpiryRequiredError extends Error {
  constructor(message) {
    super(message);
    this.code = "EXCEPTION_EXPIRY_REQUIRED";
    this.name = "ExceptionExpiryRequiredError";
  }
}

class ExceptionExpiryTooFarError extends Error {
  constructor(message) {
    super(message);
    this.code = "EXCEPTION_EXPIRY_TOO_FAR";
    this.name = "ExceptionExpiryTooFarError";
  }
}

class AuditLogFailureError extends Error {
  constructor(message) {
    super(message);
    this.code = "AUDIT_LOG_FAILURE";
    this.name = "AuditLogFailureError";
  }
}

class CrossWorkspaceAccessDeniedError extends Error {
  constructor(message) {
    super(message);
    this.code = "CROSS_WORKSPACE_ACCESS_DENIED";
    this.name = "CrossWorkspaceAccessDeniedError";
  }
}

const MAX_DAYS = config.crossWorkspaceExceptionMaxDays || 90;

async function checkException(userId, targetWorkspace) {
  if (!userId || !targetWorkspace) {
    return { allowed: false, reason: "CROSS_WORKSPACE_ACCESS_DENIED" };
  }

  const canonicalTarget = normaliseWorkspaceCode(targetWorkspace) || targetWorkspace;

  try {
    const res = await pool.query(
      `SELECT id, grantor_user_id, grantee_user_id, target_workspace,
              expires_at, revoked_at, reason, created_at
       FROM cross_workspace_access_exceptions
       WHERE grantee_user_id = $1
         AND target_workspace = $2
         AND expires_at > NOW()
         AND revoked_at IS NULL
       ORDER BY expires_at DESC
       LIMIT 1`,
      [userId, canonicalTarget]
    );

    if (res.rows.length > 0) {
      return {
        allowed: true,
        exception: res.rows[0],
        reason: res.rows[0].reason,
      };
    }

    const expiredRes = await pool.query(
      `SELECT 1 FROM cross_workspace_access_exceptions
       WHERE grantee_user_id = $1
         AND target_workspace = $2
         AND expires_at <= NOW()
         AND revoked_at IS NULL
       LIMIT 1`,
      [userId, canonicalTarget]
    );

    if (expiredRes.rows.length > 0) {
      return { allowed: false, reason: "CROSS_WORKSPACE_EXCEPTION_EXPIRED" };
    }

    const revokedRes = await pool.query(
      `SELECT 1 FROM cross_workspace_access_exceptions
       WHERE grantee_user_id = $1
         AND target_workspace = $2
         AND revoked_at IS NOT NULL
       LIMIT 1`,
      [userId, canonicalTarget]
    );

    if (revokedRes.rows.length > 0) {
      return { allowed: false, reason: "CROSS_WORKSPACE_EXCEPTION_REVOKED" };
    }

    return { allowed: false, reason: "CROSS_WORKSPACE_ACCESS_DENIED" };
  } catch (err) {
    return { allowed: false, reason: "CROSS_WORKSPACE_ACCESS_DENIED", error: err.message };
  }
}

async function grantException(grantorId, granteeId, targetWorkspace, expiresAt, reason) {
  if (!expiresAt) {
    throw new ExceptionExpiryRequiredError("expiresAt is required for cross-workspace exception");
  }

  const canonicalTarget = normaliseWorkspaceCode(targetWorkspace) || targetWorkspace;
  const expiry = new Date(expiresAt);
  const maxExpiry = new Date(Date.now() + MAX_DAYS * 24 * 60 * 60 * 1000);

  if (expiry > maxExpiry) {
    throw new ExceptionExpiryTooFarError(
      `Exception expiry exceeds maximum of ${MAX_DAYS} days from now`
    );
  }

  if (expiry <= new Date()) {
    throw new ExceptionExpiryRequiredError("expiresAt must be in the future");
  }

  if (!reason || String(reason).trim() === "") {
    throw new ExceptionExpiryRequiredError("reason is required for cross-workspace exception");
  }

  const res = await pool.query(
    `INSERT INTO cross_workspace_access_exceptions
       (grantor_user_id, grantee_user_id, target_workspace, expires_at, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, grantor_user_id, grantee_user_id, target_workspace,
               expires_at, revoked_at, reason, created_at`,
    [grantorId, granteeId, canonicalTarget, expiry.toISOString(), reason]
  );

  return res.rows[0];
}

async function revokeException(exceptionId, managerId) {
  const res = await pool.query(
    `UPDATE cross_workspace_access_exceptions
     SET revoked_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING id, grantor_user_id, grantee_user_id, target_workspace,
               expires_at, revoked_at, reason, created_at`,
    [exceptionId]
  );

  if (res.rows.length === 0) {
    const existing = await pool.query(
      `SELECT id, revoked_at FROM cross_workspace_access_exceptions WHERE id = $1`,
      [exceptionId]
    );
    if (existing.rows.length === 0) {
      throw new CrossWorkspaceAccessDeniedError(`Exception ${exceptionId} not found`);
    }
    return existing.rows[0];
  }

  return res.rows[0];
}

async function logAccess(userId, sourceWorkspace, targetWorkspace, resourceType, resourceId, exceptionId, reason) {
  const canonicalSource = normaliseWorkspaceCode(sourceWorkspace) || sourceWorkspace;
  const canonicalTarget = normaliseWorkspaceCode(targetWorkspace) || targetWorkspace;

  try {
    await pool.query(
      `INSERT INTO cross_workspace_access_log
         (user_id, source_workspace, target_workspace, resource_type, resource_id, exception_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, canonicalSource, canonicalTarget, resourceType, resourceId || null, exceptionId || null, reason || null]
    );
  } catch (err) {
    throw new AuditLogFailureError(`Failed to log cross-workspace access: ${err.message}`);
  }
}

async function purgeExpiredExceptions() {
  const res = await pool.query(
    `UPDATE cross_workspace_access_exceptions
     SET revoked_at = NOW()
     WHERE expires_at < NOW()
       AND revoked_at IS NULL
     RETURNING id, grantee_user_id, target_workspace, expires_at`
  );

  return res.rows;
}

async function listExceptions(filters = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (filters.granteeUserId) {
    conditions.push(`grantee_user_id = $${paramIdx++}`);
    params.push(filters.granteeUserId);
  }
  if (filters.targetWorkspace) {
    const canonical = normaliseWorkspaceCode(filters.targetWorkspace) || filters.targetWorkspace;
    conditions.push(`target_workspace = $${paramIdx++}`);
    params.push(canonical);
  }
  if (filters.activeOnly) {
    conditions.push(`expires_at > NOW() AND revoked_at IS NULL`);
  }
  if (filters.grantorUserId) {
    conditions.push(`grantor_user_id = $${paramIdx++}`);
    params.push(filters.grantorUserId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 100;

  const res = await pool.query(
    `SELECT e.id, e.grantor_user_id, e.grantee_user_id, e.target_workspace,
            e.expires_at, e.revoked_at, e.reason, e.created_at,
            g.name AS grantor_name, gr.name AS grantee_name
     FROM cross_workspace_access_exceptions e
     LEFT JOIN users g ON g.id = e.grantor_user_id
     LEFT JOIN users gr ON gr.id = e.grantee_user_id
     ${whereClause}
     ORDER BY e.created_at DESC
     LIMIT ${limit}`,
    params
  );

  return res.rows;
}

async function getExceptionById(id) {
  const res = await pool.query(
    `SELECT e.id, e.grantor_user_id, e.grantee_user_id, e.target_workspace,
            e.expires_at, e.revoked_at, e.reason, e.created_at,
            g.name AS grantor_name, gr.name AS grantee_name
     FROM cross_workspace_access_exceptions e
     LEFT JOIN users g ON g.id = e.grantor_user_id
     LEFT JOIN users gr ON gr.id = e.grantee_user_id
     WHERE e.id = $1`,
    [id]
  );

  return res.rows.length > 0 ? res.rows[0] : null;
}

function startCrossWorkspacePurgeScheduler() {
  return cron.schedule("0 2 * * *", async () => {
    try {
      const purged = await purgeExpiredExceptions();
      if (purged.length > 0) {
        console.log(`Cross-workspace purge: ${purged.length} expired exceptions revoked.`);
      }
    } catch (e) {
      console.error("Cross-workspace purge scheduler failed:", e.message);
    }
  }, { timezone: "Africa/Johannesburg" });
}

module.exports = {
  checkException,
  grantException,
  revokeException,
  logAccess,
  purgeExpiredExceptions,
  listExceptions,
  getExceptionById,
  startCrossWorkspacePurgeScheduler,
  ExceptionExpiryRequiredError,
  ExceptionExpiryTooFarError,
  AuditLogFailureError,
  CrossWorkspaceAccessDeniedError,
};