const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");

router.use(auth);

let schemaReady = false;

async function ensureNotificationColumns() {
  if (schemaReady) return;

  await pool.query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS module VARCHAR(50) DEFAULT 'system';

    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS target_type VARCHAR(50);

    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS target_id INTEGER;

    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS target_url TEXT;

    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS attachment_count INTEGER DEFAULT 0;

    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

    UPDATE notifications
    SET module = COALESCE(module, 'system'),
        attachment_count = COALESCE(attachment_count, 0);
  `);

  schemaReady = true;
}

function visibleCondition(startIndex = 1) {
  return `
    (
      user_id = $${startIndex}
      OR target_role = $${startIndex + 1}
      OR target_role IS NULL
    )
  `;
}

// GET /api/notifications?module=helpdesk|production|admin|system
router.get("/", async (req, res) => {
  try {
    await ensureNotificationColumns();

    const { module } = req.query;

    const params = [req.user.id, req.user.role];
    const where = [visibleCondition(1)];

    if (module) {
      params.push(module);
      where.push(`module = $${params.length}`);
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        user_id,
        target_role,
        type,
        module,
        message,
        target_type,
        target_id,
        target_url,
        attachment_count,
        is_read,
        read_at,
        created_at
      FROM notifications
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT 50
      `,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    return res.status(500).json({
      error: "Failed to fetch notifications",
    });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  try {
    await ensureNotificationColumns();

    const { rows } = await pool.query(
      `
      UPDATE notifications
      SET
        is_read = true,
        read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND ${visibleCondition(2)}
      RETURNING *
      `,
      [req.params.id, req.user.id, req.user.role]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Mark notification read error:", err);
    return res.status(500).json({
      error: "Failed to mark notification read",
    });
  }
});

// PATCH /api/notifications/read-all?module=production
router.patch("/read-all", async (req, res) => {
  try {
    await ensureNotificationColumns();

    const { module } = req.query;

    const params = [req.user.id, req.user.role];
    const where = [visibleCondition(1)];

    if (module) {
      params.push(module);
      where.push(`module = $${params.length}`);
    }

    await pool.query(
      `
      UPDATE notifications
      SET
        is_read = true,
        read_at = COALESCE(read_at, NOW())
      WHERE ${where.join(" AND ")}
      `,
      params
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    return res.status(500).json({
      error: "Failed to mark notifications read",
    });
  }
});

// DELETE /api/notifications/clear?module=production
router.delete("/clear", async (req, res) => {
  try {
    await ensureNotificationColumns();

    const { module } = req.query;

    const params = [req.user.id, req.user.role];
    const where = [visibleCondition(1)];

    if (module) {
      params.push(module);
      where.push(`module = $${params.length}`);
    }

    await pool.query(
      `
      DELETE FROM notifications
      WHERE ${where.join(" AND ")}
      `,
      params
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