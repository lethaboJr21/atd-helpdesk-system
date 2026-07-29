const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const router = express.Router();

router.use(auth);

const COMPANY_DOMAIN = String(
  process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za"
).toLowerCase();

const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 100;
const MAX_BULK_USERS = 200;

const ALLOWED_ROLES = [
  "user",
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
];

const ALLOWED_PORTAL_STATUSES = [
  "active",
  "inactive",
];

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

function normalizeRole(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  return ALLOWED_ROLES.includes(normalizedValue)
    ? normalizedValue
    : null;
}

function normalizePortalStatus(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  return ALLOWED_PORTAL_STATUSES.includes(normalizedValue)
    ? normalizedValue
    : null;
}

function normalizeEmploymentStatus(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  return ALLOWED_EMPLOYMENT_STATUSES.includes(normalizedValue)
    ? normalizedValue
    : null;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function nullableText(value) {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || null;
}

function nullableDate(value) {
  return value ? String(value) : null;
}

function isCompanyEmail(email) {
  return email.endsWith(`@${COMPANY_DOMAIN}`);
}

function isSuperadmin(request) {
  return request.user?.role === "superadmin";
}

function parsePositiveInteger(value, fallbackValue) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return fallbackValue;
  }

  return parsedValue;
}

async function getUserById(userId) {
  const result = await pool.query(
    `
    SELECT ${USER_SELECT}
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

function canManageTargetUser(request, response, targetUser) {
  if (!targetUser) {
    response.status(404).json({
      error: "User not found",
    });
    return false;
  }

  if (
    targetUser.role === "superadmin" &&
    !isSuperadmin(request)
  ) {
    response.status(403).json({
      error: "Only a superadmin can modify a superadmin account.",
    });
    return false;
  }

  return true;
}

function canAssignRole(request, response, requestedRole) {
  if (
    ["admin", "superadmin"].includes(requestedRole) &&
    !isSuperadmin(request)
  ) {
    response.status(403).json({
      error: "Only a superadmin can assign admin or superadmin roles.",
    });
    return false;
  }

  return true;
}

router.get(
  "/",
  allowRoles("manager", "admin", "superadmin"),
  async (request, response) => {
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
      limit = DEFAULT_PAGE_SIZE,
      offset = 0,
    } = request.query;

    const whereConditions = [];
    const queryParameters = [];
    let parameterIndex = 1;

    if (includeExternal !== "true") {
      whereConditions.push(
        `LOWER(email) LIKE $${parameterIndex}`
      );
      queryParameters.push(`%@${COMPANY_DOMAIN}`);
      parameterIndex += 1;
    }

    if (includeArchived !== "true") {
      whereConditions.push("archived_at IS NULL");
    }

    if (role) {
      const normalizedRole = normalizeRole(role);

      if (!normalizedRole) {
        return response.status(400).json({
          error: "Invalid role filter",
        });
      }

      whereConditions.push(
        `role = $${parameterIndex}`
      );
      queryParameters.push(normalizedRole);
      parameterIndex += 1;
    }

    if (approved === "true" || approved === "false") {
      whereConditions.push(
        `approved = $${parameterIndex}`
      );
      queryParameters.push(approved === "true");
      parameterIndex += 1;
    }

    if (status) {
      const normalizedStatus = normalizePortalStatus(status);

      if (!normalizedStatus) {
        return response.status(400).json({
          error: "Invalid portal status filter",
        });
      }

      whereConditions.push(
        `status = $${parameterIndex}`
      );
      queryParameters.push(normalizedStatus);
      parameterIndex += 1;
    }

    if (department) {
      whereConditions.push(
        `department = $${parameterIndex}`
      );
      queryParameters.push(department);
      parameterIndex += 1;
    }

    if (employmentStatus) {
      const normalizedEmploymentStatus =
        normalizeEmploymentStatus(employmentStatus);

      if (!normalizedEmploymentStatus) {
        return response.status(400).json({
          error: "Invalid employment status filter",
        });
      }

      whereConditions.push(
        `employment_status = $${parameterIndex}`
      );
      queryParameters.push(normalizedEmploymentStatus);
      parameterIndex += 1;
    }

    if (
      microsoftEnabled === "true" ||
      microsoftEnabled === "false"
    ) {
      whereConditions.push(
        `microsoft_account_enabled = $${parameterIndex}`
      );
      queryParameters.push(microsoftEnabled === "true");
      parameterIndex += 1;
    }

    if (search) {
      whereConditions.push(
        `
        (
          name ILIKE $${parameterIndex}
          OR email ILIKE $${parameterIndex}
          OR COALESCE(employee_number, '') ILIKE $${parameterIndex}
          OR COALESCE(job_title, '') ILIKE $${parameterIndex}
          OR COALESCE(department, '') ILIKE $${parameterIndex}
          OR COALESCE(manager_name, '') ILIKE $${parameterIndex}
          OR COALESCE(site, '') ILIKE $${parameterIndex}
        )
        `
      );
      queryParameters.push(`%${search}%`);
      parameterIndex += 1;
    }

    const safeLimit = Math.min(
      Math.max(
        parsePositiveInteger(limit, DEFAULT_PAGE_SIZE),
        1
      ),
      MAX_PAGE_SIZE
    );

    const safeOffset = parsePositiveInteger(offset, 0);

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

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
        LIMIT $${parameterIndex}
        OFFSET $${parameterIndex + 1}
        `,
        [
          ...queryParameters,
          safeLimit,
          safeOffset,
        ]
      );

      return response.json(result.rows);
    } catch (error) {
      console.error("Fetch users failed:", error);
      return response.status(500).json({
        error: "Failed to fetch users",
      });
    }
  }
);

router.get(
  "/meta",
  allowRoles("manager", "admin", "superadmin"),
  async (_request, response) => {
    try {
      const [summaryResult, departmentsResult] =
        await Promise.all([
          pool.query(
            `
            SELECT
              COUNT(*)::integer AS total,
              COUNT(*) FILTER (
                WHERE status = 'active'
                  AND archived_at IS NULL
              )::integer AS active,
              COUNT(*) FILTER (
                WHERE approved = FALSE
                  AND archived_at IS NULL
              )::integer AS pending,
              COUNT(*) FILTER (
                WHERE role = 'agent'
                  AND archived_at IS NULL
              )::integer AS agents,
              COUNT(*) FILTER (
                WHERE microsoft_account_enabled = FALSE
                  AND archived_at IS NULL
              )::integer AS microsoft_disabled,
              COUNT(*) FILTER (
                WHERE archived_at IS NOT NULL
              )::integer AS archived,
              COUNT(*) FILTER (
                WHERE microsoft_id IS NOT NULL
                  AND COALESCE(TRIM(department), '') = ''
              )::integer AS missing_department,
              COUNT(*) FILTER (
                WHERE microsoft_id IS NOT NULL
                  AND COALESCE(TRIM(job_title), '') = ''
              )::integer AS missing_job_title
            FROM users
            `
          ),
          pool.query(
            `
            SELECT DISTINCT department
            FROM users
            WHERE COALESCE(TRIM(department), '') <> ''
            ORDER BY department
            `
          ),
        ]);

      return response.json({
        summary: summaryResult.rows[0],
        departments: departmentsResult.rows.map(
          (row) => row.department
        ),
        roles: ALLOWED_ROLES,
        portalStatuses: ALLOWED_PORTAL_STATUSES,
        employmentStatuses: ALLOWED_EMPLOYMENT_STATUSES,
      });
    } catch (error) {
      console.error("Fetch user metadata failed:", error);
      return response.status(500).json({
        error: "Failed to fetch user metadata",
      });
    }
  }
);

router.get(
  "/:id/employee-preview",
  allowRoles("manager", "admin", "superadmin"),
  async (request, response) => {
    try {
      const targetUser = await getUserById(request.params.id);

      if (!targetUser) {
        return response.status(404).json({
          error: "User not found",
        });
      }

      const ticketCountResult = await pool.query(
        `
        SELECT COUNT(*)::integer AS count
        FROM tickets
        WHERE requester_id = $1
        `,
        [targetUser.id]
      );

      return response.json({
        user: targetUser,
        summary: {
          ticketCount: ticketCountResult.rows[0].count,
          assetCount: null,
        },
        access: {
          employee_dashboard: true,
          report_incident: true,
          request_service: true,
          my_tickets: true,
          my_assets: true,
          knowledge: true,
          notifications: true,
          operations_dashboard: false,
          user_management: false,
          all_assets: false,
          production_operations: false,
          admin_settings: false,
        },
      });
    } catch (error) {
      console.error("Employee access preview failed:", error);
      return response.status(500).json({
        error: "Failed to build the employee access preview",
      });
    }
  }
);

router.post(
  "/bulk",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    const requestedIds = Array.isArray(request.body.userIds)
      ? request.body.userIds
      : [];

    const userIds = Array.from(
      new Set(
        requestedIds
          .map(Number)
          .filter((userId) => Number.isInteger(userId))
      )
    ).slice(0, MAX_BULK_USERS);

    const action = String(request.body.action || "").trim();
    const value = request.body.value;

    if (userIds.length === 0) {
      return response.status(400).json({
        error: "Select at least one user",
      });
    }

    const result = {
      requested: userIds.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      results: [],
    };

    for (const userId of userIds) {
      try {
        const targetUser = await getUserById(userId);

        if (!targetUser) {
          result.skipped += 1;
          result.results.push({
            id: userId,
            status: "skipped",
            reason: "User not found",
          });
          continue;
        }

        if (
          targetUser.role === "superadmin" &&
          !isSuperadmin(request)
        ) {
          result.skipped += 1;
          result.results.push({
            id: userId,
            status: "skipped",
            reason: "Protected superadmin account",
          });
          continue;
        }

        const isOwnAccount =
          Number(request.user.id) === Number(userId);

        if (
          isOwnAccount &&
          ["deactivate", "archive"].includes(action)
        ) {
          result.skipped += 1;
          result.results.push({
            id: userId,
            status: "skipped",
            reason: "You cannot disable your own account",
          });
          continue;
        }

        let updateQuery;
        let updateParameters;

        switch (action) {
          case "approve":
          case "activate":
            updateQuery = `
              UPDATE users
              SET
                approved = TRUE,
                status = 'active',
                updated_at = NOW()
              WHERE id = $1
            `;
            updateParameters = [userId];
            break;

          case "deactivate":
            updateQuery = `
              UPDATE users
              SET
                approved = FALSE,
                status = 'inactive',
                updated_at = NOW()
              WHERE id = $1
            `;
            updateParameters = [userId];
            break;

          case "archive":
            updateQuery = `
              UPDATE users
              SET
                approved = FALSE,
                status = 'inactive',
                archived_at = NOW(),
                archived_by = $2,
                archive_reason = 'Bulk archive',
                updated_at = NOW()
              WHERE id = $1
            `;
            updateParameters = [
              userId,
              request.user.id,
            ];
            break;

          case "restore":
            updateQuery = `
              UPDATE users
              SET
                archived_at = NULL,
                archived_by = NULL,
                archive_reason = NULL,
                status = 'inactive',
                approved = FALSE,
                updated_at = NOW()
              WHERE id = $1
            `;
            updateParameters = [userId];
            break;

          case "set_role": {
            const requestedRole = normalizeRole(value);

            if (!requestedRole) {
              throw new Error("Invalid role");
            }

            if (
              ["admin", "superadmin"].includes(requestedRole) &&
              !isSuperadmin(request)
            ) {
              throw new Error("Protected role");
            }

            updateQuery = `
              UPDATE users
              SET
                role = $2,
                updated_at = NOW()
              WHERE id = $1
            `;
            updateParameters = [
              userId,
              requestedRole,
            ];
            break;
          }

          case "set_department":
            updateQuery = `
              UPDATE users
              SET
                department = $2,
                updated_at = NOW()
              WHERE id = $1
            `;
            updateParameters = [
              userId,
              nullableText(value),
            ];
            break;

          case "set_site":
            updateQuery = `
              UPDATE users
              SET
                site = $2,
                updated_at = NOW()
              WHERE id = $1
            `;
            updateParameters = [
              userId,
              nullableText(value),
            ];
            break;

          default:
            return response.status(400).json({
              error: "Unsupported bulk action",
            });
        }

        await pool.query(updateQuery, updateParameters);

        result.updated += 1;
        result.results.push({
          id: userId,
          status: "updated",
        });
      } catch (error) {
        result.failed += 1;
        result.results.push({
          id: userId,
          status: "failed",
          reason: error.message,
        });
      }
    }

    return response.json(result);
  }
);

router.put(
  "/:id/profile",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    try {
      const targetUser = await getUserById(request.params.id);

      if (!canManageTargetUser(request, response, targetUser)) {
        return;
      }

      const name = String(
        request.body.name ?? targetUser.name
      ).trim();

      const email = normalizeEmail(
        request.body.email ?? targetUser.email
      );

      if (!name) {
        return response.status(400).json({
          error: "Name is required",
        });
      }

      if (!email || !isCompanyEmail(email)) {
        return response.status(400).json({
          error: `Email must belong to @${COMPANY_DOMAIN}`,
        });
      }

      const employmentStatus = normalizeEmploymentStatus(
        request.body.employmentStatus ||
          targetUser.employment_status ||
          "active"
      );

      if (!employmentStatus) {
        return response.status(400).json({
          error: "Invalid employment status",
        });
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
          nullableText(request.body.firstName),
          nullableText(request.body.lastName),
          nullableText(request.body.employeeNumber),
          nullableText(request.body.jobTitle),
          nullableText(request.body.department),
          nullableText(request.body.managerName),
          nullableText(request.body.officeLocation),
          nullableText(request.body.site),
          nullableText(request.body.mobilePhone),
          nullableText(request.body.businessPhone),
          nullableText(request.body.alternativeEmail),
          employmentStatus,
          nullableDate(request.body.startDate),
          nullableDate(request.body.terminationDate),
          request.params.id,
        ]
      );

      return response.json(result.rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        return response.status(409).json({
          error: "Email or employee identity already exists",
        });
      }

      console.error("Update user profile failed:", error);
      return response.status(500).json({
        error: "Failed to update user profile",
      });
    }
  }
);

router.put(
  "/:id/approve",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    const requestedRole = normalizeRole(
      request.body.role || "user"
    );

    if (!requestedRole) {
      return response.status(400).json({
        error: "Invalid role",
      });
    }

    if (!canAssignRole(request, response, requestedRole)) {
      return;
    }

    try {
      const targetUser = await getUserById(request.params.id);

      if (!canManageTargetUser(request, response, targetUser)) {
        return;
      }

      const result = await pool.query(
        `
        UPDATE users
        SET
          approved = TRUE,
          status = 'active',
          role = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING ${USER_SELECT}
        `,
        [
          requestedRole,
          request.params.id,
        ]
      );

      return response.json(result.rows[0]);
    } catch (error) {
      console.error("Approve user failed:", error);
      return response.status(500).json({
        error: "Failed to approve user",
      });
    }
  }
);

router.put(
  "/:id/role",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    const requestedRole = normalizeRole(request.body.role);

    if (!requestedRole) {
      return response.status(400).json({
        error: "Invalid role",
      });
    }

    if (!canAssignRole(request, response, requestedRole)) {
      return;
    }

    try {
      const targetUser = await getUserById(request.params.id);

      if (!canManageTargetUser(request, response, targetUser)) {
        return;
      }

      if (
        Number(request.user.id) === Number(request.params.id) &&
        targetUser.role === "superadmin" &&
        requestedRole !== "superadmin"
      ) {
        return response.status(400).json({
          error: "You cannot remove your own superadmin role.",
        });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET
          role = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING ${USER_SELECT}
        `,
        [
          requestedRole,
          request.params.id,
        ]
      );

      return response.json(result.rows[0]);
    } catch (error) {
      console.error("Update user role failed:", error);
      return response.status(500).json({
        error: "Failed to update user role",
      });
    }
  }
);

router.put(
  "/:id/deactivate",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    try {
      const targetUser = await getUserById(request.params.id);

      if (!canManageTargetUser(request, response, targetUser)) {
        return;
      }

      if (Number(request.user.id) === Number(request.params.id)) {
        return response.status(400).json({
          error: "You cannot deactivate your own account.",
        });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET
          approved = FALSE,
          status = 'inactive',
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_SELECT}
        `,
        [request.params.id]
      );

      return response.json(result.rows[0]);
    } catch (error) {
      console.error("Deactivate user failed:", error);
      return response.status(500).json({
        error: "Failed to deactivate user",
      });
    }
  }
);

router.put(
  "/:id/reactivate",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    try {
      const targetUser = await getUserById(request.params.id);

      if (!canManageTargetUser(request, response, targetUser)) {
        return;
      }

      const result = await pool.query(
        `
        UPDATE users
        SET
          approved = TRUE,
          status = 'active',
          archived_at = NULL,
          archived_by = NULL,
          archive_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_SELECT}
        `,
        [request.params.id]
      );

      return response.json(result.rows[0]);
    } catch (error) {
      console.error("Reactivate user failed:", error);
      return response.status(500).json({
        error: "Failed to reactivate user",
      });
    }
  }
);

router.put(
  "/:id/archive",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    try {
      const targetUser = await getUserById(request.params.id);

      if (!canManageTargetUser(request, response, targetUser)) {
        return;
      }

      if (Number(request.user.id) === Number(request.params.id)) {
        return response.status(400).json({
          error: "You cannot archive your own account.",
        });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET
          approved = FALSE,
          status = 'inactive',
          archived_at = NOW(),
          archived_by = $1,
          archive_reason = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING ${USER_SELECT}
        `,
        [
          request.user.id,
          nullableText(request.body.reason),
          request.params.id,
        ]
      );

      return response.json(result.rows[0]);
    } catch (error) {
      console.error("Archive user failed:", error);
      return response.status(500).json({
        error: "Failed to archive user",
      });
    }
  }
);

router.put(
  "/:id/restore",
  allowRoles("admin", "superadmin"),
  async (request, response) => {
    try {
      const targetUser = await getUserById(request.params.id);

      if (!canManageTargetUser(request, response, targetUser)) {
        return;
      }

      const result = await pool.query(
        `
        UPDATE users
        SET
          archived_at = NULL,
          archived_by = NULL,
          archive_reason = NULL,
          status = 'inactive',
          approved = FALSE,
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${USER_SELECT}
        `,
        [request.params.id]
      );

      return response.json(result.rows[0]);
    } catch (error) {
      console.error("Restore user failed:", error);
      return response.status(500).json({
        error: "Failed to restore user",
      });
    }
  }
);

router.delete(
  "/:id",
  allowRoles("superadmin"),
  async (request, response) => {
    try {
      if (Number(request.user.id) === Number(request.params.id)) {
        return response.status(400).json({
          error: "You cannot delete your own account.",
        });
      }

      const targetUser = await getUserById(request.params.id);

      if (!targetUser) {
        return response.status(404).json({
          error: "User not found",
        });
      }

      if (targetUser.role === "superadmin") {
        const superadminCountResult = await pool.query(
          `
          SELECT COUNT(*)::integer AS count
          FROM users
          WHERE role = 'superadmin'
          `
        );

        if (superadminCountResult.rows[0].count <= 1) {
          return response.status(400).json({
            error: "The final superadmin account cannot be deleted.",
          });
        }
      }

      await pool.query(
        `
        DELETE FROM users
        WHERE id = $1
        `,
        [request.params.id]
      );

      return response.json({
        message: "User permanently deleted",
      });
    } catch (error) {
      if (error.code === "23503") {
        return response.status(409).json({
          error:
            "This user is linked to historical records and cannot be deleted. Archive the account instead.",
        });
      }

      console.error("Delete user failed:", error);
      return response.status(500).json({
        error: "Failed to delete user",
      });
    }
  }
);

router.get(
  "/:id",
  allowRoles("manager", "admin", "superadmin"),
  async (request, response) => {
    try {
      const user = await getUserById(request.params.id);

      if (!user) {
        return response.status(404).json({
          error: "User not found",
        });
      }

      return response.json(user);
    } catch (error) {
      console.error("Fetch user failed:", error);
      return response.status(500).json({
        error: "Failed to fetch user",
      });
    }
  }
);

module.exports = router;
