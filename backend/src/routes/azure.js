const express = require("express");
const router = express.Router();

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { getUsers } = require("../services/azureUsers");

router.use(auth);

const COMPANY_DOMAIN = String(
  process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za"
).toLowerCase();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isCompanyEmail(email) {
  return email.endsWith(`@${COMPANY_DOMAIN}`);
}

async function updateExistingUser(userId, microsoftUser) {
  const result = await pool.query(
    `
    UPDATE users
    SET
      name = $1,
      microsoft_id = $2,
      first_name = $3,
      last_name = $4,
      job_title = $5,
      department = $6,
      office_location = $7,
      mobile_phone = $8,
      business_phone = $9,
      microsoft_account_enabled = $10,
      microsoft_user_type = $11,
      microsoft_created_at = $12,
      last_microsoft_sync_at = NOW(),
      microsoft_sync_status = 'synced',
      updated_at = NOW()
    WHERE id = $13
    RETURNING id
    `,
    [
      microsoftUser.name,
      microsoftUser.microsoftId || null,
      microsoftUser.firstName || null,
      microsoftUser.lastName || null,
      microsoftUser.jobTitle || null,
      microsoftUser.department || null,
      microsoftUser.officeLocation || null,
      microsoftUser.mobilePhone || null,
      microsoftUser.businessPhone || null,
      microsoftUser.accountEnabled !== false,
      microsoftUser.userType || "Member",
      microsoftUser.microsoftCreatedAt || null,
      userId,
    ]
  );

  return result.rows[0];
}

async function createUser(microsoftUser, email) {
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
      $1, $2, NULL, 'user', TRUE, 'active',
      $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, NOW(), 'synced'
    )
    RETURNING id
    `,
    [
      microsoftUser.name,
      email,
      microsoftUser.microsoftId || null,
      microsoftUser.firstName || null,
      microsoftUser.lastName || null,
      microsoftUser.jobTitle || null,
      microsoftUser.department || null,
      microsoftUser.officeLocation || null,
      microsoftUser.mobilePhone || null,
      microsoftUser.businessPhone || null,
      microsoftUser.accountEnabled !== false,
      microsoftUser.userType || "Member",
      microsoftUser.microsoftCreatedAt || null,
    ]
  );

  return result.rows[0];
}

/**
 * GET /api/azure/users
 * Preview users returned by Microsoft Graph. Does not modify PostgreSQL.
 */
router.get(
  "/users",
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    try {
      const users = await getUsers({
        includeGuests: req.query.includeGuests === "true",
        includeDisabled: req.query.includeDisabled !== "false",
      });

      return res.json({
        count: users.length,
        users,
      });
    } catch (err) {
      console.error("Microsoft users fetch failed:", {
        message: err.message,
        status: err.response?.status,
        graphError: err.response?.data,
      });

      return res.status(500).json({
        error: "Failed to retrieve Microsoft 365 users.",
        details:
          process.env.NODE_ENV === "development"
            ? err.response?.data || err.message
            : undefined,
      });
    }
  }
);

/**
 * POST /api/azure/sync
 * Synchronizes all ATD company users returned by Microsoft Graph.
 * Each user is handled independently so one bad record cannot abort the batch.
 */
router.post(
  "/sync",
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    try {
      const microsoftUsers = await getUsers({
        includeGuests: false,
        includeDisabled: req.body?.includeDisabled !== false,
      });

      const summary = {
        retrieved: microsoftUsers.length,
        created: 0,
        updated: 0,
        skipped: 0,
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
          const existingResult = await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
               OR ($2::text IS NOT NULL AND microsoft_id = $2)
            ORDER BY
              CASE WHEN LOWER(email) = LOWER($1) THEN 0 ELSE 1 END
            LIMIT 1
            `,
            [email, microsoftUser.microsoftId || null]
          );

          const existingUser = existingResult.rows[0];

          if (existingUser) {
            await updateExistingUser(existingUser.id, microsoftUser);
            summary.updated += 1;
          } else {
            await createUser(microsoftUser, email);
            summary.created += 1;
          }
        } catch (userErr) {
          summary.failed += 1;

          if (summary.errors.length < 25) {
            summary.errors.push({
              email,
              message: userErr.message,
              code: userErr.code,
            });
          }

          console.error("Microsoft user sync row failed:", {
            email,
            message: userErr.message,
            code: userErr.code,
          });
        }
      }

      console.log("Microsoft 365 user sync completed:", summary);

      return res.json({
        message: "Microsoft 365 users synchronized successfully.",
        summary,
      });
    } catch (err) {
      console.error("Microsoft user sync failed:", {
        message: err.message,
        status: err.response?.status,
        graphError: err.response?.data,
      });

      return res.status(500).json({
        error: "Microsoft 365 user synchronization failed.",
        details:
          process.env.NODE_ENV === "development"
            ? err.response?.data || err.message
            : undefined,
      });
    }
  }
);

module.exports = router;
