const router = require("express").Router();

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const {
  normalizeModule,
} = require("../services/notificationService");

router.use(auth);

let schemaReady = false;

async function ensureNotificationColumns() {
  if (schemaReady) {
    return;
  }

  await pool.query(
    `
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
    SET
      module = LOWER(COALESCE(module, 'system')),
      attachment_count = COALESCE(attachment_count, 0);
    `
  );

  schemaReady = true;
}

function buildVisibilityCondition(startIndex = 1) {
  return `
    (
      user_id = $${startIndex}
      OR (
        user_id IS NULL
        AND target_role = $${startIndex + 1}
      )
    )
  `;
}

router.get("/", async (request, response) => {
  try {
    await ensureNotificationColumns();

    const parameters = [
      request.user.id,
      request.user.role,
    ];

    const conditions = [
      buildVisibilityCondition(1),
    ];

    if (request.query.module) {
      parameters.push(
        normalizeModule(request.query.module)
      );

      conditions.push(
        `module = $${parameters.length}`
      );
    }

    const result = await pool.query(
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
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT 100
      `,
      parameters
    );

    return response.json(result.rows);
  } catch (error) {
    console.error("Fetch notifications failed:", error);
    return response.status(500).json({
      error: "Failed to fetch notifications",
    });
  }
});

router.patch("/read-all", async (request, response) => {
  try {
    await ensureNotificationColumns();

    const parameters = [
      request.user.id,
      request.user.role,
    ];

    const conditions = [
      buildVisibilityCondition(1),
    ];

    if (request.query.module) {
      parameters.push(
        normalizeModule(request.query.module)
      );

      conditions.push(
        `module = $${parameters.length}`
      );
    }

    const result = await pool.query(
      `
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = COALESCE(read_at, NOW())
      WHERE ${conditions.join(" AND ")}
      RETURNING id
      `,
      parameters
    );

    return response.json({
      ok: true,
      updated: result.rowCount,
    });
  } catch (error) {
    console.error("Mark all notifications read failed:", error);
    return response.status(500).json({
      error: "Failed to mark notifications as read",
    });
  }
});

router.delete("/clear", async (request, response) => {
  try {
    await ensureNotificationColumns();

    const parameters = [
      request.user.id,
      request.user.role,
    ];

    const conditions = [
      buildVisibilityCondition(1),
    ];

    if (request.query.module) {
      parameters.push(
        normalizeModule(request.query.module)
      );

      conditions.push(
        `module = $${parameters.length}`
      );
    }

    const result = await pool.query(
      `
      DELETE FROM notifications
      WHERE ${conditions.join(" AND ")}
      RETURNING id
      `,
      parameters
    );

    return response.json({
      ok: true,
      deleted: result.rowCount,
    });
  } catch (error) {
    console.error("Clear notifications failed:", error);
    return response.status(500).json({
      error: "Failed to clear notifications",
    });
  }
});

router.patch("/:id/read", async (request, response) => {
  try {
    await ensureNotificationColumns();

    const result = await pool.query(
      `
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND ${buildVisibilityCondition(2)}
      RETURNING *
      `,
      [
        request.params.id,
        request.user.id,
        request.user.role,
      ]
    );

    if (!result.rows[0]) {
      return response.status(404).json({
        error: "Notification not found",
      });
    }

    return response.json(result.rows[0]);
  } catch (error) {
    console.error("Mark notification read failed:", error);
    return response.status(500).json({
      error: "Failed to mark notification as read",
    });
  }
});

module.exports = router;
