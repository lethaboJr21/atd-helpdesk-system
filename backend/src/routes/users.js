const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

router.use(auth);

const COMPANY_DOMAIN = String(
  process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za"
).toLowerCase();

const ALLOWED_ROLES = [
  "user",
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
];

const ALLOWED_STATUSES = ["active", "inactive"];
const ALLOWED_EMPLOYMENT_STATUSES = [
  "active",
  "resigned",
  "transferred",
  "contractor",
  "suspended",
];

const USER_SELECT = `
  id,
  name,
  email,
  role,
  status,
  approved,
  created_at,
  updated_at,
  microsoft_id,
  first_name,
  last_name,
  job_title,
  department,
  office_location,
  mobile_phone,
  business_phone,
  microsoft_account_enabled,
  microsoft_user_type,
  microsoft_created_at,
  last_microsoft_sync_at,
  microsoft_sync_status,
  employee_number,
  manager_name,
  site,
  employment_status,
  start_date,
  termination_date,
  alternative_email,
  last_login_at,
  archived_at,
  archived_by,
  archive_reason
`;

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ALLOWED_ROLES.includes(value) ? value : null;
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return ALLOWED_STATUSES.includes(value) ? value : null;
}

function normalizeEmploymentStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return ALLOWED_EMPLOYMENT_STATUSES.includes(value) ? value : null;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function nullableText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function nullableDate(value) {
  return value ? String(value) : null;
}

function isCompanyEmail(email) {
  return email.endsWith(`@${COMPANY_DOMAIN}`);
}

function isSuperadmin(req) {
  return req.user?.role === "superadmin";
}

async function getUserById(id) {
  const result = await pool.query(
    `SELECT ${USER_SELECT} FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

function ensureCanManageTarget(req, res, targetUser) {
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return false;
  }

  if (targetUser.role === "superadmin" && !isSuperadmin(req)) {
    res.status(403).json({
      error: "Only a superadmin can modify another superadmin account.",
    });
    return false;
  }

  return true;
}

/**
 * GET /api/users
 * Searchable and filterable user-management list.
 */
router.get(
  "/",
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    const {
      includeExternal = "false",
      includeArchived = "false",
      role,
      approved,
      status,
      department,
      employmentStatus,
      microsoftEnabled,
      search,
      limit = 500,
      offset = 0,
    } = req.query;

    const where = [];
    const params = [];
    let i = 1;

    if (includeExternal !== "true") {
      where.push(`LOWER(email) LIKE $${i++}`);
      params.push(`%@${COMPANY_DOMAIN}`);
    }

    if (includeArchived !== "true") {
      where.push("archived_at IS NULL");
    }

    if (role) {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) {
        return res.status(400).json({ error: "Invalid role filter" });
      }
      where.push(`LOWER(role) = $${i++}`);
      params.push(normalizedRole);
    }

    if (approved === "true" || approved === "false") {
      where.push(`approved = $${i++}`);
      params.push(approved === "true");
    }

    if (status) {
      const normalizedStatus = normalizeStatus(status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: "Invalid status filter" });
      }
      where.push(`LOWER(status) = $${i++}`);
      params.push(normalizedStatus);
    }

    if (department) {
      where.push(`department = $${i++}`);
      params.push(department);
    }

    if (employmentStatus) {
      const normalizedEmployment = normalizeEmploymentStatus(employmentStatus);
      if (!normalizedEmployment) {
        return res.status(400).json({
          error: "Invalid employment status filter",
        });
      }
      where.push(`LOWER(employment_status) = $${i++}`);
      params.push(normalizedEmployment);
    }

    if (microsoftEnabled === "true" || microsoftEnabled === "false") {
      where.push(`microsoft_account_enabled = $${i++}`);
      params.push(microsoftEnabled === "true");
    }

    if (search) {
      where.push(`
        (
          name ILIKE $${i}
          OR email ILIKE $${i}
          OR COALESCE(employee_number, '') ILIKE $${i}
          OR COALESCE(job_title, '') ILIKE $${i}
          OR COALESCE(department, '') ILIKE $${i}
          OR COALESCE(manager_name, '') ILIKE $${i}
          OR COALESCE(site, '') ILIKE $${i}
        )
      `);
      params.push(`%${search}%`);
      i += 1;
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 1000);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    try {
      const result = await pool.query(
        `
        SELECT ${USER_SELECT}
        FROM users
        ${whereClause}
        ORDER BY
          archived_at NULLS FIRST,
          approved ASC,
          name ASC,
          email ASC
        LIMIT $${i} OFFSET $${i + 1}
        `,
        [...params, safeLimit, safeOffset]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("Fetch users failed:", err);
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

/** GET /api/users/meta */
router.get(
  "/meta",
  allowRoles("superadmin", "admin", "manager"),
  async (_req, res) => {
    try {
      const [summaryResult, departmentsResult] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::integer AS total,
            COUNT(*) FILTER (WHERE status = 'active' AND archived_at IS NULL)::integer AS active,
            COUNT(*) FILTER (WHERE approved = FALSE AND archived_at IS NULL)::integer AS pending,
            COUNT(*) FILTER (WHERE role = 'agent' AND archived_at IS NULL)::integer AS agents,
            COUNT(*) FILTER (WHERE microsoft_account_enabled = FALSE AND archived_at IS NULL)::integer AS microsoft_disabled,
            COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::integer AS archived
          FROM users
        `),
        pool.query(`
          SELECT DISTINCT department
          FROM users
          WHERE department IS NOT NULL
            AND TRIM(department) <> ''
          ORDER BY department
        `),
      ]);

      return res.json({
        summary: summaryResult.rows[0],
        departments: departmentsResult.rows.map((row) => row.department),
        roles: ALLOWED_ROLES,
        statuses: ALLOWED_STATUSES,
        employmentStatuses: ALLOWED_EMPLOYMENT_STATUSES,
      });
    } catch (err) {
      console.error("Fetch user metadata failed:", err);
      return res.status(500).json({ error: "Failed to fetch user metadata" });
    }
  }
);

/** GET /api/users/:id */
router.get(
  "/:id",
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json(user);
    } catch (err) {
      console.error("Fetch user failed:", err);
      return res.status(500).json({ error: "Failed to fetch user" });
    }
  }
);

/** PUT /api/users/:id/profile */
router.put(
  "/:id/profile",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const targetUser = await getUserById(req.params.id);
      if (!ensureCanManageTarget(req, res, targetUser)) return;

      const email = normalizeEmail(req.body.email ?? targetUser.email);
      const name = String(req.body.name ?? targetUser.name).trim();

      if (!name) return res.status(400).json({ error: "Name is required" });
      if (!email || !isCompanyEmail(email)) {
        return res.status(400).json({
          error: `Email must belong to @${COMPANY_DOMAIN}`,
        });
      }

      const employmentStatus =
        req.body.employmentStatus === undefined
          ? targetUser.employment_status
          : normalizeEmploymentStatus(req.body.employmentStatus);

      if (!employmentStatus) {
        return res.status(400).json({ error: "Invalid employment status" });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET
          name = $1,
          email = $2,
          first_name = $3,
          last_name = $4,
          employee_number = $5,
          job_title = $6,
          department = $7,
          manager_name = $8,
          office_location = $9,
          site = $10,
          mobile_phone = $11,
          business_phone = $12,
          alternative_email = $13,
          employment_status = $14,
          start_date = $15,
          termination_date = $16,
          updated_at = NOW()
        WHERE id = $17
        RETURNING ${USER_SELECT}
        `,
        [
          name,
          email,
          nullableText(req.body.firstName),
          nullableText(req.body.lastName),
          nullableText(req.body.employeeNumber),
          nullableText(req.body.jobTitle),
          nullableText(req.body.department),
          nullableText(req.body.managerName),
          nullableText(req.body.officeLocation),
          nullableText(req.body.site),
          nullableText(req.body.mobilePhone),
          nullableText(req.body.businessPhone),
          nullableText(req.body.alternativeEmail),
          employmentStatus,
          nullableDate(req.body.startDate),
          nullableDate(req.body.terminationDate),
          req.params.id,
        ]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Email or Microsoft ID already exists" });
      }
      console.error("Update user profile failed:", err);
      return res.status(500).json({ error: "Failed to update user profile" });
    }
  }
);

/** PUT /api/users/:id/approve */
router.put(
  "/:id/approve",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    const normalizedRole = normalizeRole(req.body.role || "user");
    if (!normalizedRole) return res.status(400).json({ error: "Invalid role" });

    try {
      const targetUser = await getUserById(req.params.id);
      if (!ensureCanManageTarget(req, res, targetUser)) return;

      if (["admin", "superadmin"].includes(normalizedRole) && !isSuperadmin(req)) {
        return res.status(403).json({
          error: "Only a superadmin can assign admin or superadmin roles.",
        });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET approved = TRUE, status = 'active', role = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING ${USER_SELECT}
        `,
        [normalizedRole, req.params.id]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Approve user failed:", err);
      return res.status(500).json({ error: "Failed to approve user" });
    }
  }
);

/** PUT /api/users/:id/role */
router.put(
  "/:id/role",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    const normalizedRole = normalizeRole(req.body.role);
    if (!normalizedRole) return res.status(400).json({ error: "Invalid role" });

    try {
      const targetUser = await getUserById(req.params.id);
      if (!ensureCanManageTarget(req, res, targetUser)) return;

      if (["admin", "superadmin"].includes(normalizedRole) && !isSuperadmin(req)) {
        return res.status(403).json({
          error: "Only a superadmin can assign admin or superadmin roles.",
        });
      }

      if (
        Number(req.user.id) === Number(req.params.id) &&
        targetUser.role === "superadmin" &&
        normalizedRole !== "superadmin"
      ) {
        return res.status(400).json({
          error: "You cannot remove your own superadmin role.",
        });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET role = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING ${USER_SELECT}
        `,
        [normalizedRole, req.params.id]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Update user role failed:", err);
      return res.status(500).json({ error: "Failed to update user role" });
    }
  }
);

/** PUT /api/users/:id/deactivate */
router.put(
  "/:id/deactivate",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const targetUser = await getUserById(req.params.id);
      if (!ensureCanManageTarget(req, res, targetUser)) return;

      if (Number(req.user.id) === Number(req.params.id)) {
        return res.status(400).json({ error: "You cannot deactivate your own account." });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET approved = FALSE, status = 'inactive', updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_SELECT}
        `,
        [req.params.id]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Deactivate user failed:", err);
      return res.status(500).json({ error: "Failed to deactivate user" });
    }
  }
);

/** PUT /api/users/:id/reactivate */
router.put(
  "/:id/reactivate",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const targetUser = await getUserById(req.params.id);
      if (!ensureCanManageTarget(req, res, targetUser)) return;

      const result = await pool.query(
        `
        UPDATE users
        SET approved = TRUE, status = 'active', archived_at = NULL,
            archived_by = NULL, archive_reason = NULL, updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_SELECT}
        `,
        [req.params.id]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Reactivate user failed:", err);
      return res.status(500).json({ error: "Failed to reactivate user" });
    }
  }
);

/** PUT /api/users/:id/archive */
router.put(
  "/:id/archive",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const targetUser = await getUserById(req.params.id);
      if (!ensureCanManageTarget(req, res, targetUser)) return;

      if (Number(req.user.id) === Number(req.params.id)) {
        return res.status(400).json({ error: "You cannot archive your own account." });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET approved = FALSE,
            status = 'inactive',
            archived_at = NOW(),
            archived_by = $1,
            archive_reason = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING ${USER_SELECT}
        `,
        [req.user.id, nullableText(req.body.reason), req.params.id]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Archive user failed:", err);
      return res.status(500).json({ error: "Failed to archive user" });
    }
  }
);

/** PUT /api/users/:id/restore */
router.put(
  "/:id/restore",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const targetUser = await getUserById(req.params.id);
      if (!ensureCanManageTarget(req, res, targetUser)) return;

      const result = await pool.query(
        `
        UPDATE users
        SET archived_at = NULL,
            archived_by = NULL,
            archive_reason = NULL,
            status = 'inactive',
            approved = FALSE,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_SELECT}
        `,
        [req.params.id]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Restore user failed:", err);
      return res.status(500).json({ error: "Failed to restore user" });
    }
  }
);

/** DELETE /api/users/:id — superadmin only */
router.delete(
  "/:id",
  allowRoles("superadmin"),
  async (req, res) => {
    try {
      if (Number(req.user.id) === Number(req.params.id)) {
        return res.status(400).json({ error: "You cannot delete your own account." });
      }

      const targetUser = await getUserById(req.params.id);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      if (targetUser.role === "superadmin") {
        const countResult = await pool.query(
          `SELECT COUNT(*)::integer AS count FROM users WHERE role = 'superadmin'`,
        );
        if (countResult.rows[0].count <= 1) {
          return res.status(400).json({
            error: "The final superadmin account cannot be deleted.",
          });
        }
      }

      await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
      return res.json({ message: "User permanently deleted" });
    } catch (err) {
      if (err.code === "23503") {
        return res.status(409).json({
          error:
            "This user is linked to historical records and cannot be deleted. Archive the account instead.",
        });
      }
      console.error("Delete user failed:", err);
      return res.status(500).json({ error: "Failed to delete user" });
    }
  }
);

module.exports = router;
