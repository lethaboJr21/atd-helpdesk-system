const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");

router.use(auth);

// ✅ GET /api/notifications
// Returns notifications visible to current user by user_id, role, or global notifications.
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT *
      FROM notifications
      WHERE
        user_id = $1
        OR target_role = $2
        OR target_role IS NULL
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.user.id, req.user.role]
    );

    return res.json(rows);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    return res.status(500).json({
      error: "Failed to fetch notifications",
    });
  }
});

// ✅ PATCH /api/notifications/read-all
// Marks all visible notifications as read.
router.patch("/read-all", async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE
        user_id = $1
        OR target_role = $2
        OR target_role IS NULL
      `,
      [req.user.id, req.user.role]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Mark notifications read error:", err);
    return res.status(500).json({
      error: "Failed to mark notifications read",
    });
  }
});

// ✅ DELETE /api/notifications/clear
// Clears all visible notifications.
router.delete("/clear", async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM notifications
      WHERE
        user_id = $1
        OR target_role = $2
        OR target_role IS NULL
      `,
      [req.user.id, req.user.role]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Clear notifications error:", err);
    return res.status(500).json({
      error: "Failed to clear notifications",
    });
  }
});

module.exports = router;