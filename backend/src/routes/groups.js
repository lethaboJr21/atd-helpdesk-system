const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");

router.use(auth);

/**
 * ✅ GET /api/groups
 *
 * Returns all support groups with their approved members.
 * Used by Ticket Workspace for:
 * - Support Group dropdown
 * - Assignee dropdown based on selected group
 */
router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        g.id,
        g.name,
        g.description,

        COUNT(u.id)::int AS member_count,

        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
            ORDER BY u.name ASC
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS members

      FROM support_groups g

      LEFT JOIN support_group_members gm
        ON gm.group_id = g.id

      LEFT JOIN users u
        ON u.id = gm.user_id
        AND u.approved = TRUE
        AND u.role IN (
          'agent',
          'operator',
          'manager',
          'admin',
          'superadmin'
        )

      GROUP BY
        g.id,
        g.name,
        g.description

      ORDER BY
        g.name ASC
    `);

    return res.json(rows);
  } catch (err) {
    console.error("Fetch groups error:", err.message);
    return res.status(500).json({
      error: "Failed to fetch groups",
    });
  }
});

module.exports = router;