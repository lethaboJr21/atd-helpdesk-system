const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");

// GET /api/notifications
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, user_id, message, type, is_read, created_at
      FROM notifications
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.user.id]
    );

    return res.json(rows);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
      RETURNING id, user_id, message, type, is_read, created_at
      `,
      [req.params.id, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Mark notification read error:", err);
    return res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", auth, async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE user_id = $1 OR user_id IS NULL
      `,
      [req.user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    return res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// DELETE /api/notifications/clear
router.delete("/clear", auth, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM notifications
      WHERE user_id = $1 OR user_id IS NULL
      `,
      [req.user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Clear notifications error:", err);
    return res.status(500).json({ error: "Failed to clear notifications" });
  }
});

module.exports = router;
``