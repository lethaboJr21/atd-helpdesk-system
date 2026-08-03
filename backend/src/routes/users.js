const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const router = express.Router();
router.use(auth);

const COMPANY_DOMAIN = String(process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za")
  .trim()
  .toLowerCase();
const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 100;
const MAX_BULK_USERS = 200;
const ALLOWED_ROLES = ["user", "agent", "operator", "manager", "admin", "superadmin"];
const ALLOWED_PORTAL_STATUSES = ["active", "inactive"];
const ALLOWED_EMPLOYMENT_STATUSES = ["active", "resigned", "transferred", "contractor", "suspended"];
const ALLOWED_ACCOUNT_VIEWS = ["pending", "active", "deactivated", "archived", "external", "non-person", "all"];

const USER_SELECT = `
  id, name, email, role, status, approved, created_at, updated_at,
  microsoft_id, first_name, last_name, job_title, department,
  office_location, mobile_phone, business_phone, microsoft_account_enabled,
  microsoft_user_type, microsoft_created_at, last_microsoft_sync_at,
  microsoft_sync_status, employee_number, manager_name, site,
  employment_status, start_date, termination_date, alternative_email,
  last_login_at, archived_at, archived_by, archive_reason, account_type,
  deactivated_at, deactivated_by, deactivation_reason
`;

function normalizeValue(value) { return String(value || "").trim().toLowerCase(); }
function normalizeRole(value) {
  const normalized = normalizeValue(value);
  return ALLOWED_ROLES.includes(normalized) ? normalized : null;
}
function normalizePortalStatus(value) {
  const normalized = normalizeValue(value);
  return ALLOWED_PORTAL_STATUSES.includes(normalized) ? normalized : null;
}
function normalizeEmploymentStatus(value) {
  const normalized = normalizeValue(value);
  return ALLOWED_EMPLOYMENT_STATUSES.includes(normalized) ? normalized : null;
}
function normalizeEmail(value) { return normalizeValue(value); }
function nullableText(value) { const normalized = String(value ?? "").trim(); return normalized || null; }
function nullableDate(value) { return value ? String(value) : null; }
function isSuperadmin(request) { return request.user?.role === "superadmin"; }
function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

async function getUserById(userId, database = pool) {
  const result = await database.query(`SELECT ${USER_SELECT} FROM users WHERE id = $1 LIMIT 1`, [userId]);
  return result.rows[0] || null;
}

async function writeAudit(database, request, targetUserId, action, oldValue, newValue, details = {}) {
  try {
    await database.query(
      `INSERT INTO administration_audit_log
        (actor_user_id, target_user_id, action, old_value, new_value, details)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
      [request.user.id, targetUserId || null, action,
       oldValue == null ? null : JSON.stringify(oldValue),
       newValue == null ? null : JSON.stringify(newValue),
       JSON.stringify(details)]
    );
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }
}

function canManageTargetUser(request, response, targetUser) {
  if (!targetUser) {
    response.status(404).json({ error: "User not found" });
    return false;
  }
  if (targetUser.role === "superadmin" && !isSuperadmin(request)) {
    response.status(403).json({ error: "Only a superadministrator can modify a superadministrator account." });
    return false;
  }
  return true;
}

function canAssignRole(request, response, requestedRole) {
  if (requestedRole === "superadmin" && !isSuperadmin(request)) {
    response.status(403).json({ error: "Only a superadministrator can assign the superadministrator role." });
    return false;
  }
  return true;
}

async function activeSuperadminCount(database = pool) {
  const result = await database.query(
    `SELECT COUNT(*)::integer AS count FROM users
      WHERE role='superadmin' AND approved=TRUE AND status='active'
        AND archived_at IS NULL AND deactivated_at IS NULL
        AND account_type='person'`
  );
  return result.rows[0].count;
}

function addAccountViewConditions({ view, whereConditions, queryParameters, parameterIndex }) {
  switch (view) {
    case "pending":
      whereConditions.push("archived_at IS NULL", "approved = FALSE", "role = 'pending'");
      break;
    case "active":
      whereConditions.push("archived_at IS NULL", "approved = TRUE", "status = 'active'", "last_login_at IS NOT NULL", "account_type = 'person'");
      break;
    case "deactivated":
      whereConditions.push("archived_at IS NULL", "approved = TRUE", "account_type = 'person'", "(status='inactive' OR last_login_at IS NULL OR microsoft_account_enabled=FALSE OR deactivated_at IS NOT NULL)");
      break;
    case "archived": whereConditions.push("archived_at IS NOT NULL"); break;
    case "external":
      whereConditions.push(`LOWER(email) NOT LIKE $${parameterIndex}`);
      queryParameters.push(`%@${COMPANY_DOMAIN}`);
      parameterIndex += 1;
      break;
    case "non-person": whereConditions.push("account_type <> 'person'"); break;
    case "all": break;
    default: throw Object.assign(new Error("Invalid account view"), { status: 400 });
  }
  return parameterIndex;
}

router.get("/", allowRoles("manager", "admin", "superadmin"), async (request, response) => {
  const {
    accountView = "all", includeExternal = "false", includeArchived = "false",
    role, approved, status, department, employmentStatus, microsoftEnabled,
    search, limit = DEFAULT_PAGE_SIZE, offset = 0,
  } = request.query;
  const normalizedView = normalizeValue(accountView || "all");
  if (!ALLOWED_ACCOUNT_VIEWS.includes(normalizedView)) {
    return response.status(400).json({ error: "Invalid account view" });
  }
  const whereConditions = [];
  const queryParameters = [];
  let parameterIndex = 1;
  try {
    parameterIndex = addAccountViewConditions({ view: normalizedView, whereConditions, queryParameters, parameterIndex });
    if (includeExternal !== "true" && !["pending", "external", "all"].includes(normalizedView)) {
      whereConditions.push(`LOWER(email) LIKE $${parameterIndex}`);
      queryParameters.push(`%@${COMPANY_DOMAIN}`);
      parameterIndex += 1;
    }
    if (includeArchived !== "true" && !["archived", "all"].includes(normalizedView) && !whereConditions.includes("archived_at IS NULL")) {
      whereConditions.push("archived_at IS NULL");
    }
    if (role) {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) return response.status(400).json({ error: "Invalid role filter" });
      whereConditions.push(`role = $${parameterIndex++}`);
      queryParameters.push(normalizedRole);
    }
    if (["true", "false"].includes(approved)) {
      whereConditions.push(`approved = $${parameterIndex++}`);
      queryParameters.push(approved === "true");
    }
    if (status) {
      const normalizedStatus = normalizePortalStatus(status);
      if (!normalizedStatus) return response.status(400).json({ error: "Invalid portal status filter" });
      whereConditions.push(`status = $${parameterIndex++}`);
      queryParameters.push(normalizedStatus);
    }
    if (department) {
      whereConditions.push(`department = $${parameterIndex++}`);
      queryParameters.push(department);
    }
    if (employmentStatus) {
      const normalizedEmploymentStatus = normalizeEmploymentStatus(employmentStatus);
      if (!normalizedEmploymentStatus) return response.status(400).json({ error: "Invalid employment status filter" });
      whereConditions.push(`employment_status = $${parameterIndex++}`);
      queryParameters.push(normalizedEmploymentStatus);
    }
    if (["true", "false"].includes(microsoftEnabled)) {
      whereConditions.push(`microsoft_account_enabled = $${parameterIndex++}`);
      queryParameters.push(microsoftEnabled === "true");
    }
    if (search) {
      whereConditions.push(`(name ILIKE $${parameterIndex} OR email ILIKE $${parameterIndex}
        OR COALESCE(employee_number,'') ILIKE $${parameterIndex}
        OR COALESCE(job_title,'') ILIKE $${parameterIndex}
        OR COALESCE(department,'') ILIKE $${parameterIndex}
        OR COALESCE(manager_name,'') ILIKE $${parameterIndex}
        OR COALESCE(site,'') ILIKE $${parameterIndex})`);
      queryParameters.push(`%${search}%`);
      parameterIndex += 1;
    }
    const safeLimit = Math.min(Math.max(parsePositiveInteger(limit, DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
    const safeOffset = parsePositiveInteger(offset, 0);
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT ${USER_SELECT},
         CASE WHEN archived_at IS NOT NULL THEN 'archived'
          WHEN account_type <> 'person' THEN 'non_person'
          WHEN approved=FALSE AND role='pending' THEN 'pending'
          WHEN approved=TRUE AND status='active' AND last_login_at IS NOT NULL THEN 'active'
          WHEN microsoft_account_enabled=FALSE THEN 'microsoft_disabled'
          WHEN approved=TRUE AND last_login_at IS NULL THEN 'never_signed_in'
          WHEN approved=TRUE AND status='inactive' THEN 'deactivated' ELSE 'other' END AS account_state
       FROM users ${whereClause}
       ORDER BY name ASC, email ASC
       LIMIT $${parameterIndex} OFFSET $${parameterIndex + 1}`,
      [...queryParameters, safeLimit, safeOffset]
    );
    return response.json(result.rows);
  } catch (error) {
    console.error("Fetch users failed:", error);
    return response.status(error.status || 500).json({ error: error.status ? error.message : "Failed to fetch users" });
  }
});

router.get("/meta", allowRoles("manager", "admin", "superadmin"), async (request, response) => {
  try {
    const [summaryResult, departmentsResult] = await Promise.all([
      // Counts must match the list filters for each view (domain + archived rules).
      pool.query(`SELECT COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE approved=TRUE AND status='active' AND last_login_at IS NOT NULL AND archived_at IS NULL AND account_type='person' AND LOWER(email) LIKE $1)::integer AS active,
        COUNT(*) FILTER (WHERE approved=FALSE AND role='pending' AND archived_at IS NULL)::integer AS pending,
        COUNT(*) FILTER (WHERE approved=TRUE AND archived_at IS NULL AND account_type='person' AND LOWER(email) LIKE $1 AND (status='inactive' OR last_login_at IS NULL OR microsoft_account_enabled=FALSE OR deactivated_at IS NOT NULL))::integer AS deactivated,
        COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::integer AS archived,
        COUNT(*) FILTER (WHERE LOWER(email) NOT LIKE $1 AND archived_at IS NULL)::integer AS external,
        COUNT(*) FILTER (WHERE account_type <> 'person' AND archived_at IS NULL AND LOWER(email) LIKE $1)::integer AS non_person
        FROM users`, [`%@${COMPANY_DOMAIN}`]),
      pool.query("SELECT DISTINCT department FROM users WHERE COALESCE(TRIM(department),'') <> '' ORDER BY department"),
    ]);
    return response.json({
      summary: summaryResult.rows[0],
      departments: departmentsResult.rows.map((row) => row.department),
      roles: ALLOWED_ROLES,
      assignableRoles: isSuperadmin(request) ? ALLOWED_ROLES : ALLOWED_ROLES.filter((role) => role !== "superadmin"),
      portalStatuses: ALLOWED_PORTAL_STATUSES,
      employmentStatuses: ALLOWED_EMPLOYMENT_STATUSES,
      accountViews: ALLOWED_ACCOUNT_VIEWS,
    });
  } catch (error) {
    console.error("Fetch user metadata failed:", error);
    return response.status(500).json({ error: "Failed to fetch user metadata" });
  }
});

router.post("/bulk", allowRoles("admin", "superadmin"), async (request, response) => {
  const userIds = Array.from(new Set((Array.isArray(request.body.userIds) ? request.body.userIds : [])
    .map(Number).filter(Number.isInteger))).slice(0, MAX_BULK_USERS);
  const action = String(request.body.action || "").trim();
  const value = request.body.value;
  if (!userIds.length) return response.status(400).json({ error: "Select at least one user" });
  const result = { requested: userIds.length, updated: 0, skipped: 0, failed: 0, results: [] };
  for (const userId of userIds) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const target = await getUserById(userId, client);
      if (!target) throw Object.assign(new Error("User not found"), { skip: true });
      if (target.role === "superadmin" && !isSuperadmin(request)) throw Object.assign(new Error("Protected superadministrator account"), { skip: true });
      if (Number(request.user.id) === userId && ["deactivate", "archive", "set_role"].includes(action)) throw Object.assign(new Error("You cannot remove your own access"), { skip: true });
      let sql; let params;
      if (["approve", "activate"].includes(action)) {
        sql = "UPDATE users SET approved=TRUE,status='active',role=CASE WHEN role='pending' THEN 'user' ELSE role END,deactivated_at=NULL,deactivated_by=NULL,deactivation_reason=NULL,updated_at=NOW() WHERE id=$1 AND archived_at IS NULL";
        params = [userId];
      } else if (action === "deactivate") {
        sql = "UPDATE users SET status='inactive',deactivated_at=NOW(),deactivated_by=$2,deactivation_reason='Bulk deactivation',updated_at=NOW() WHERE id=$1 AND archived_at IS NULL";
        params = [userId, request.user.id];
      } else if (action === "archive") {
        sql = "UPDATE users SET status='inactive',archived_at=NOW(),archived_by=$2,archive_reason='Bulk archive',updated_at=NOW() WHERE id=$1";
        params = [userId, request.user.id];
      } else if (action === "restore") {
        sql = "UPDATE users SET archived_at=NULL,archived_by=NULL,archive_reason=NULL,status='inactive',updated_at=NOW() WHERE id=$1";
        params = [userId];
      } else if (action === "set_role") {
        const requestedRole = normalizeRole(value);
        if (!requestedRole || !canAssignRole(request, { status: () => ({ json: () => {} }) }, requestedRole)) throw new Error("Role is not assignable");
        if (target.account_type !== "person" && requestedRole !== "user") throw new Error("Operational roles require a person account");
        sql = "UPDATE users SET role=$2,updated_at=NOW() WHERE id=$1";
        params = [userId, requestedRole];
      } else if (action === "set_department") {
        sql = "UPDATE users SET department=$2,updated_at=NOW() WHERE id=$1"; params = [userId, nullableText(value)];
      } else if (action === "set_site") {
        sql = "UPDATE users SET site=$2,updated_at=NOW() WHERE id=$1"; params = [userId, nullableText(value)];
      } else if (["enable_email", "disable_email"].includes(action)) {
        await client.query(`INSERT INTO user_email_preferences (user_id,email_enabled,updated_by,updated_at)
          VALUES ($1,$2,$3,NOW()) ON CONFLICT(user_id) DO UPDATE SET email_enabled=EXCLUDED.email_enabled,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
          [userId, action === "enable_email", request.user.id]);
      } else {
        return response.status(400).json({ error: "Unsupported bulk action" });
      }
      if (sql) await client.query(sql, params);
      await writeAudit(client, request, userId, `bulk_${action}`, target, { value });
      await client.query("COMMIT");
      result.updated += 1; result.results.push({ id: userId, status: "updated" });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error.skip) { result.skipped += 1; result.results.push({ id: userId, status: "skipped", reason: error.message }); }
      else { result.failed += 1; result.results.push({ id: userId, status: "failed", reason: error.message }); }
    } finally { client.release(); }
  }
  return response.json(result);
});

router.put("/:id/profile", allowRoles("admin", "superadmin"), async (request, response) => {
  try {
    const target = await getUserById(request.params.id);
    if (!canManageTargetUser(request, response, target)) return;
    const name = String(request.body.name ?? target.name).trim();
    const email = normalizeEmail(request.body.email ?? target.email);
    const employmentStatus = normalizeEmploymentStatus(request.body.employmentStatus || target.employment_status || "active");
    const accountType = normalizeValue(request.body.accountType || target.account_type || "person");
    if (!name || !email) return response.status(400).json({ error: "Name and email are required" });
    if (!employmentStatus) return response.status(400).json({ error: "Invalid employment status" });
    if (!["person", "shared", "service", "department", "automation", "generic"].includes(accountType)) return response.status(400).json({ error: "Invalid account type" });
    const result = await pool.query(`UPDATE users SET name=$1,email=$2,first_name=$3,last_name=$4,employee_number=$5,
      job_title=$6,department=$7,manager_name=$8,office_location=$9,site=$10,mobile_phone=$11,business_phone=$12,
      alternative_email=$13,employment_status=$14,start_date=$15,termination_date=$16,account_type=$17,updated_at=NOW()
      WHERE id=$18 RETURNING ${USER_SELECT}`,
      [name,email,nullableText(request.body.firstName),nullableText(request.body.lastName),nullableText(request.body.employeeNumber),
       nullableText(request.body.jobTitle),nullableText(request.body.department),nullableText(request.body.managerName),
       nullableText(request.body.officeLocation),nullableText(request.body.site),nullableText(request.body.mobilePhone),
       nullableText(request.body.businessPhone),nullableText(request.body.alternativeEmail),employmentStatus,
       nullableDate(request.body.startDate),nullableDate(request.body.terminationDate),accountType,request.params.id]);
    await writeAudit(pool, request, target.id, "user_profile_updated", target, result.rows[0]);
    return response.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") return response.status(409).json({ error: "Email or employee identity already exists" });
    console.error("Update user profile failed:", error);
    return response.status(500).json({ error: "Failed to update user profile" });
  }
});

router.put("/:id/approve", allowRoles("admin", "superadmin"), async (request, response) => {
  const requestedRole = normalizeRole(request.body.role || "user");
  if (!requestedRole || !canAssignRole(request, response, requestedRole)) return;
  try {
    const target = await getUserById(request.params.id);
    if (!canManageTargetUser(request, response, target)) return;
    if (target.archived_at) return response.status(409).json({ error: "Restore the archived account before approval." });
    if (target.account_type !== "person" && requestedRole !== "user") return response.status(400).json({ error: "Operational roles require a person account." });
    const result = await pool.query(`UPDATE users SET approved=TRUE,status='active',role=$1,deactivated_at=NULL,deactivated_by=NULL,deactivation_reason=NULL,updated_at=NOW() WHERE id=$2 RETURNING ${USER_SELECT}`, [requestedRole, target.id]);
    await writeAudit(pool, request, target.id, "user_approved", target, result.rows[0]);
    return response.json(result.rows[0]);
  } catch (error) {
    console.error("Approve user failed:", error);
    return response.status(500).json({ error: "Failed to approve user" });
  }
});

router.put("/:id/role", allowRoles("admin", "superadmin"), async (request, response) => {
  const requestedRole = normalizeRole(request.body.role);
  if (!requestedRole || !canAssignRole(request, response, requestedRole)) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await getUserById(request.params.id, client);
    if (!canManageTargetUser(request, response, target)) { await client.query("ROLLBACK"); return; }
    if (target.account_type !== "person" && requestedRole !== "user") {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "Operational roles require a person account." });
    }
    if (Number(request.user.id) === Number(target.id) && target.role !== requestedRole) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "You cannot change your own administrative role." });
    }
    if (target.role === "superadmin" && requestedRole !== "superadmin" && await activeSuperadminCount(client) <= 1) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "The final active superadministrator cannot be demoted." });
    }
    const result = await client.query(`UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2 RETURNING ${USER_SELECT}`, [requestedRole, target.id]);
    await writeAudit(client, request, target.id, "user_role_updated", { role: target.role }, { role: requestedRole });
    await client.query("COMMIT");
    return response.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Update user role failed:", error);
    return response.status(500).json({ error: "Failed to update user role" });
  } finally { client.release(); }
});

async function lifecycleAction(request, response, action) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await getUserById(request.params.id, client);
    if (!canManageTargetUser(request, response, target)) { await client.query("ROLLBACK"); return; }
    if (Number(request.user.id) === Number(target.id)) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: `You cannot ${action} your own account.` });
    }
    if (target.role === "superadmin" && await activeSuperadminCount(client) <= 1 && ["deactivate", "archive"].includes(action)) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "The final active superadministrator cannot be disabled." });
    }
    let result;
    if (action === "deactivate") result = await client.query(`UPDATE users SET status='inactive',deactivated_at=NOW(),deactivated_by=$1,deactivation_reason=$2,updated_at=NOW() WHERE id=$3 AND archived_at IS NULL RETURNING ${USER_SELECT}`, [request.user.id, nullableText(request.body.reason) || "Deactivated by administrator", target.id]);
    if (action === "reactivate") result = await client.query(`UPDATE users SET approved=TRUE,status='active',role=CASE WHEN role='pending' THEN 'user' ELSE role END,deactivated_at=NULL,deactivated_by=NULL,deactivation_reason=NULL,updated_at=NOW() WHERE id=$1 AND archived_at IS NULL RETURNING ${USER_SELECT}`, [target.id]);
    if (action === "archive") result = await client.query(`UPDATE users SET status='inactive',archived_at=NOW(),archived_by=$1,archive_reason=$2,updated_at=NOW() WHERE id=$3 RETURNING ${USER_SELECT}`, [request.user.id, nullableText(request.body.reason) || "Archived by administrator", target.id]);
    if (action === "restore") result = await client.query(`UPDATE users SET archived_at=NULL,archived_by=NULL,archive_reason=NULL,status='inactive',updated_at=NOW() WHERE id=$1 RETURNING ${USER_SELECT}`, [target.id]);
    await writeAudit(client, request, target.id, `user_${action}d`, target, result.rows[0]);
    await client.query("COMMIT");
    return response.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`${action} user failed:`, error);
    return response.status(500).json({ error: `Failed to ${action} user` });
  } finally { client.release(); }
}

router.put("/:id/deactivate", allowRoles("admin", "superadmin"), (req, res) => lifecycleAction(req, res, "deactivate"));
router.put("/:id/reactivate", allowRoles("admin", "superadmin"), (req, res) => lifecycleAction(req, res, "reactivate"));
router.put("/:id/archive", allowRoles("admin", "superadmin"), (req, res) => lifecycleAction(req, res, "archive"));
router.put("/:id/restore", allowRoles("admin", "superadmin"), (req, res) => lifecycleAction(req, res, "restore"));

router.delete("/:id", allowRoles("superadmin"), async (request, response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (Number(request.user.id) === Number(request.params.id)) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "You cannot delete your own account." });
    }
    const target = await getUserById(request.params.id, client);
    if (!target) { await client.query("ROLLBACK"); return response.status(404).json({ error: "User not found" }); }
    if (!target.archived_at) { await client.query("ROLLBACK"); return response.status(409).json({ error: "Archive the account before permanent deletion." }); }
    if (target.role === "superadmin" && await activeSuperadminCount(client) <= 1) {
      await client.query("ROLLBACK");
      return response.status(400).json({ error: "The final superadministrator account cannot be deleted." });
    }
    await writeAudit(client, request, target.id, "user_permanently_deleted", target, null);
    await client.query("DELETE FROM users WHERE id=$1", [target.id]);
    await client.query("COMMIT");
    return response.json({ message: "User permanently deleted" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23503") return response.status(409).json({ error: "This user is linked to historical records and cannot be deleted. Keep the account archived." });
    console.error("Delete user failed:", error);
    return response.status(500).json({ error: "Failed to delete user" });
  } finally { client.release(); }
});

router.get("/:id/employee-preview", allowRoles("manager", "admin", "superadmin"), async (request, response) => {
  try {
    const target = await getUserById(request.params.id);
    if (!target) return response.status(404).json({ error: "User not found" });
    const ticketCount = await pool.query("SELECT COUNT(*)::integer AS count FROM tickets WHERE requester_id=$1", [target.id]);
    return response.json({ user: target, summary: { ticketCount: ticketCount.rows[0].count, assetCount: null }, access: request.user.features || {} });
  } catch (error) {
    console.error("Employee access preview failed:", error);
    return response.status(500).json({ error: "Failed to build employee access preview" });
  }
});

router.get("/:id", allowRoles("manager", "admin", "superadmin"), async (request, response) => {
  try {
    const user = await getUserById(request.params.id);
    if (!user) return response.status(404).json({ error: "User not found" });
    return response.json(user);
  } catch (error) {
    return response.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
