const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

router.use(auth);

const COMPANY_DOMAIN = "@atdalliance.co.za";
const ALLOWED_ROLES = [
  "user",
  "agent",
  "manager",
  "admin",
  "superadmin",
  "operator",
];

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ALLOWED_ROLES.includes(value) ? value : null;
}

/**
 * ✅ GET /api/users
 *
 * Admin user management list.
 * By default, only shows @atdalliance.co.za users.
 */
router.get(
  "/",
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    const { includeExternal = "false", role, approved, search } = req.query;

    const where = [];
    const params = [];
    let i = 1;

    /**
     * ✅ Default: only ATD Alliance domain users.
     * This prevents users from other companies/sub-branches appearing.
     */
    if (includeExternal !== "true") {
      where.push(`LOWER(email) LIKE $${i++}`);
      params.push(`%${COMPANY_DOMAIN}`);
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

    if (search) {
      where.push(`
        (
          name ILIKE $${i}
          OR email ILIKE $${i}
          OR role ILIKE $${i}
        )
      `);
      params.push(`%${search}%`);
      i++;
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    try {
      const result = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          role,
          approved,
          created_at,
          updated_at
        FROM users
        ${whereClause}
        ORDER BY
          approved ASC,
          name ASC,
          email ASC
        `,
        params
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("Fetch users failed:", err);
      return res.status(500).json({
        error: "Failed to fetch users",
      });
    }
  }
);

/**
 * ✅ PUT /api/users/:id/approve
 *
 * Approves a user and optionally sets their role.
 */
router.put(
  "/:id/approve",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    const { role = "user" } = req.body;

    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      const result = await pool.query(
        `
        UPDATE users
        SET
          approved = true,
          role = $1,
          updated_at = NOW()
        WHERE id = $2
          AND LOWER(email) LIKE $3
        RETURNING
          id,
          name,
          email,
          role,
          approved,
          created_at,
          updated_at
        `,
        [normalizedRole, req.params.id, `%${COMPANY_DOMAIN}`]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error:
            "User not found or user does not belong to @atdalliance.co.za",
        });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Approve user failed:", err);
      return res.status(500).json({
        error: "Failed to approve user",
      });
    }
  }
);

/**
 * ✅ PUT /api/users/:id/role
 *
 * Updates a user's role.
 */
router.put(
  "/:id/role",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    const { role } = req.body;

    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      const result = await pool.query(
        `
        UPDATE users
        SET
          role = $1,
          updated_at = NOW()
        WHERE id = $2
          AND LOWER(email) LIKE $3
        RETURNING
          id,
          name,
          email,
          role,
          approved,
          created_at,
          updated_at
        `,
        [normalizedRole, req.params.id, `%${COMPANY_DOMAIN}`]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error:
            "User not found or user does not belong to @atdalliance.co.za",
        });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Update user role failed:", err);
      return res.status(500).json({
        error: "Failed to update user role",
      });
    }
  }
);

/**
 * ✅ PUT /api/users/:id/deactivate
 *
 * Temporarily disables a user from accessing the portal by setting approved = false.
 */
router.put(
  "/:id/deactivate",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE users
        SET
          approved = false,
          updated_at = NOW()
        WHERE id = $1
          AND LOWER(email) LIKE $2
        RETURNING
          id,
          name,
          email,
          role,
          approved,
          created_at,
          updated_at
        `,
        [req.params.id, `%${COMPANY_DOMAIN}`]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error:
            "User not found or user does not belong to @atdalliance.co.za",
        });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Deactivate user failed:", err);
      return res.status(500).json({
        error: "Failed to deactivate user",
      });
    }
  }
);

/**
 * ✅ PUT /api/users/:id/reactivate
 *
 * Re-enables a deactivated user by setting approved = true.
 */
router.put(
  "/:id/reactivate",
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE users
        SET
          approved = true,
          updated_at = NOW()
        WHERE id = $1
          AND LOWER(email) LIKE $2
        RETURNING
          id,
          name,
          email,
          role,
          approved,
          created_at,
          updated_at
        `,
        [req.params.id, `%${COMPANY_DOMAIN}`]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error:
            "User not found or user does not belong to @atdalliance.co.za",
        });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Reactivate user failed:", err);
      return res.status(500).json({
        error: "Failed to reactivate user",
      });
    }
  }
);

module.exports = router;
