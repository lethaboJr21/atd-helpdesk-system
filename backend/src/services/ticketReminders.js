const cron = require("node-cron");

const pool = require("../db/pool");
const { sendEmail } = require("./email");

function startTicketReminderJob() {
  cron.schedule("0 8 * * 1-5", async () => {
    console.log("Running morning ticket reminder job...");

    try {
      const result = await pool.query(`
        SELECT
          u.id AS user_id,
          u.email,
          u.name,
          COUNT(t.id)::integer AS pending_count
        FROM tickets t
        JOIN users u ON u.id = t.assigned_to_user_id
        WHERE t.status NOT IN ('Resolved', 'Closed')
          AND u.approved = TRUE
          AND u.status = 'active'
          AND u.archived_at IS NULL
          AND u.account_type = 'person'
        GROUP BY u.id, u.email, u.name
        HAVING COUNT(t.id) > 0
      `);

      for (const row of result.rows) {
        await sendEmail({
          to: row.email,
          category: "reminder",
          subject: "Pending Helpdesk Tickets Reminder",
          text: `Good morning ${row.name || ""},\n\nYou currently have ${row.pending_count} pending helpdesk ticket(s) assigned to you.\n\nPlease log in to the ATD Helpdesk Portal to review and action them.\n\nRegards,\nATD Helpdesk`,
        });
      }
    } catch (error) {
      console.error("Ticket reminder job failed:", error.message);
    }
  });
}

module.exports = { startTicketReminderJob };
