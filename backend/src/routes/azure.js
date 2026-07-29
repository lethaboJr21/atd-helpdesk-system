const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { getUsers } = require("../services/azureUsers");

const router = express.Router();

router.use(auth);

const COMPANY_DOMAIN = String(
  process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za"
).toLowerCase();

const AUTO_APPROVE_MICROSOFT_USERS =
  process.env.MICROSOFT_AUTO_APPROVE !== "false";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isCompanyEmail(email) {
  return email.endsWith(`@${COMPANY_DOMAIN}`);
}

function isMicrosoftAccountEnabled(microsoftUser) {
  return microsoftUser.accountEnabled !== false;
}

async function findExistingUser(email, microsoftId) {
  const result = await pool.query(
    `
    SELECT
      id,
      role,
      status,
      approved,
      archived_at,
      microsoft_id
    FROM users
    WHERE
      LOWER(email::text) = LOWER($1::text)
      OR (
        $2::text IS NOT NULL
        AND microsoft_id = $2::text
      )
    ORDER BY
      CASE
        WHEN LOWER(email::text) = LOWER($1::text) THEN 0
        ELSE 1
      END,
      id
    LIMIT 1
    `,
    [email, microsoftId || null]
  );

  return result.rows[0] || null;
}

async function updateExistingUser(userId, microsoftUser, email) {
  const accountEnabled = isMicrosoftAccountEnabled(microsoftUser);
  const shouldActivate =
    AUTO_APPROVE_MICROSOFT_USERS && accountEnabled;

  const result = await pool.query(
    `
    UPDATE users
    SET
      name = COALESCE(NULLIF($1, ''), name),
      email = $2,
      microsoft_id = $3,
      first_name = COALESCE(NULLIF($4, ''), first_name),
      last_name = COALESCE(NULLIF($5, ''), last_name),
      job_title = COALESCE(NULLIF($6, ''), job_title),
      department = COALESCE(NULLIF($7, ''), department),
      office_location = COALESCE(NULLIF($8, ''), office_location),
      mobile_phone = COALESCE(NULLIF($9, ''), mobile_phone),
      business_phone = COALESCE(NULLIF($10, ''), business_phone),
      microsoft_account_enabled = $11,
      microsoft_user_type = $12,
      microsoft_created_at = $13,
      approved = CASE
        WHEN archived_at IS NOT NULL THEN approved
        WHEN $14 = TRUE THEN TRUE
        WHEN $11 = FALSE THEN FALSE
        ELSE approved
      END,
      status = CASE
        WHEN archived_at IS NOT NULL THEN status
        WHEN $11 = FALSE THEN 'inactive'
        WHEN $14 = TRUE THEN 'active'
        ELSE status
      END,
      role = CASE
        WHEN role = 'pending' AND $14 = TRUE THEN 'user'
        ELSE role
      END,
      last_microsoft_sync_at = NOW(),
      microsoft_sync_status = 'synced',
      updated_at = NOW()
    WHERE id = $15
    RETURNING
      id,
      email,
      role,
      status,
      approved,
      archived_at,
      microsoft_account_enabled
    `,
    [
      microsoftUser.name || email,
      email,
      microsoftUser.microsoftId || null,
      microsoftUser.firstName || null,
      microsoftUser.lastName || null,
      microsoftUser.jobTitle || null,
      microsoftUser.department || null,
      microsoftUser.officeLocation || null,
      microsoftUser.mobilePhone || null,
      microsoftUser.businessPhone || null,
      accountEnabled,
      microsoftUser.userType || "Member",
      microsoftUser.microsoftCreatedAt || null,
      shouldActivate,
      userId,
    ]
  );

  return result.rows[0];
}

async function createUser(microsoftUser, email) {
  const accountEnabled = isMicrosoftAccountEnabled(microsoftUser);
  const approved =
    AUTO_APPROVE_MICROSOFT_USERS && accountEnabled;
  const status = approved ? "active" : "inactive";

  const result = await pool.query(
    `
    INSERT INTO users (
      name,
      email,
      password_hash,
      role,
      approved,
      status,
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
      microsoft_sync_status
    )
    VALUES (
      $1,
      $2,
      NULL,
      'user',
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      NOW(),
      'synced'
    )
    RETURNING
      id,
      email,
      role,
      status,
      approved,
      archived_at,
      microsoft_account_enabled
    `,
    [
      microsoftUser.name || email,
      email,
      approved,
      status,
      microsoftUser.microsoftId || null,
      microsoftUser.firstName || null,
      microsoftUser.lastName || null,
      microsoftUser.jobTitle || null,
      microsoftUser.department || null,
      microsoftUser.officeLocation || null,
      microsoftUser.mobilePhone || null,
      microsoftUser.businessPhone || null,
      accountEnabled,
      microsoftUser.userType || "Member",
      microsoftUser.microsoftCreatedAt || null,
    ]
  );

  return result.rows[0];
}

router.get(
  "/users",
  allowRoles("superadmin", "admin", "manager"),
  async (request, response) => {
    try {
      const users = await getUsers({
        includeGuests: request.query.includeGuests === "true",
        includeDisabled: request.query.includeDisabled !== "false",
      });

      return response.json({
        count: users.length,
        users,
      });
    } catch (error) {
      console.error("Microsoft users fetch failed:", {
        message: error.message,
        status: error.response?.status,
        graphError: error.response?.data,
      });

      return response.status(502).json({
        error: "Failed to retrieve Microsoft 365 users.",
        details:
          process.env.NODE_ENV === "development"
            ? error.response?.data || error.message
            : undefined,
      });
    }
  }
);

router.post(
  "/sync",
  allowRoles("superadmin", "admin", "manager"),
  async (request, response) => {
    try {
      const microsoftUsers = await getUsers({
        includeGuests: false,
        includeDisabled: request.body?.includeDisabled !== false,
      });

      const summary = {
        retrieved: microsoftUsers.length,
        created: 0,
        updated: 0,
        skipped: 0,
        archivedPreserved: 0,
        disabled: 0,
        failed: 0,
        errors: [],
      };

      for (const microsoftUser of microsoftUsers) {
        const email = normalizeEmail(microsoftUser.email);
        const name = String(microsoftUser.name || "").trim();

        if (!email || !name || !isCompanyEmail(email)) {
          summary.skipped += 1;
          continue;
        }

        try {
          const existingUser = await findExistingUser(
            email,
            microsoftUser.microsoftId
          );

          if (existingUser) {
            if (existingUser.archived_at) {
              summary.archivedPreserved += 1;
            }

            const updatedUser = await updateExistingUser(
              existingUser.id,
              microsoftUser,
              email
            );

            if (updatedUser.microsoft_account_enabled === false) {
              summary.disabled += 1;
            }

            summary.updated += 1;
          } else {
            const createdUser = await createUser(microsoftUser, email);

            if (createdUser.microsoft_account_enabled === false) {
              summary.disabled += 1;
            }

            summary.created += 1;
          }
        } catch (userError) {
          summary.failed += 1;

          if (summary.errors.length < 25) {
            summary.errors.push({
              email,
              message: userError.message,
              code: userError.code || null,
            });
          }

          console.error("Microsoft user sync row failed:", {
            email,
            message: userError.message,
            code: userError.code,
          });
        }
      }

      console.log("Microsoft 365 user sync completed:", summary);

      return response.json({
        message: "Microsoft 365 users synchronized successfully.",
        summary,
      });
    } catch (error) {
      console.error("Microsoft user sync failed:", {
        message: error.message,
        status: error.response?.status,
        graphError: error.response?.data,
      });

      return response.status(502).json({
        error: "Microsoft 365 user synchronization failed.",
        details:
          process.env.NODE_ENV === "development"
            ? error.response?.data || error.message
            : undefined,
      });
    }
  }
);

module.exports = router;
