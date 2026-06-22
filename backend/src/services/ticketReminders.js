const cron = require("node-cron");
const pool = require("../db/pool");
const { sendEmail } = require("./email");

function startTicketReminderJob() {
  cron.schedule("0 8 * * 1-5", async () => {
    console.log("Running morning ticket reminder job...");

    try {
      const result = await pool.query(`
        SELECT
          u.email,
          u.name,
          COUNT(t.id) AS pending_count
        FROM tickets t
        JOIN users u ON u.id = t.assigned_to_user_id
        WHERE t.status NOT IN ('Resolved', 'Closed')
        GROUP BY u.email, u.name
        HAVING COUNT(t.id) > 0
      `);

      for (const row of result.rows) {
        await sendEmail({
          to: row.email,
          subject: "Pending Helpdesk Tickets Reminder",
          text: `Good morning ${row.name || ""},

You currently have ${row.pending_count} pending helpdesk ticket(s) assigned to you.

Please log in to the ATD Helpdesk Portal to review and action them.

Regards,
ATD Helpdesk`,
        });
      }
    } catch (err) {
      console.error("Ticket reminder job failed:", err.message);
    }
  });
}

module.exports = { startTicketReminderJob };