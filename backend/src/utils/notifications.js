const pool = require("../db/pool");

/**
 * ✅ Creates an in-app notification.
 * Used by signup, approval, production logs, helpdesk tickets, etc.
 */
async function createNotification({
  message,
  type = "info",
  targetRole = null,
  userId = null,
}) {
  try {
    const { rows } = await pool.query(
      `
      INSERT INTO notifications (
        message,
        type,
        target_role,
        user_id,
        is_read
      )
      VALUES ($1, $2, $3, $4, false)
      RETURNING *
      `,
      [message, type, targetRole, userId]
    );

    return rows[0];
  } catch (err) {
    console.error("Notification create failed:", err.message);
    return null;
  }
}

module.exports = {
  createNotification,
};