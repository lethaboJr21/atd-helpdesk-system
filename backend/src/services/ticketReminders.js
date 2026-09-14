const cron = require("node-cron");
const pool = require("../db/pool");
const { sendEmail } = require("./email");

const PORTAL_URL = String(
  process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk"
).replace(/\/$/, "");

let jobRunning = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ticketAge(createdAt) {
  const milliseconds = Date.now() - new Date(createdAt).getTime();
  const hours = Math.max(0, Math.floor(milliseconds / 3600000));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function dueLabel(ticket) {
  if (!ticket.due_at) return "No due date";
  const due = new Date(ticket.due_at);
  return due < new Date()
    ? `OVERDUE - ${due.toLocaleString("en-ZA")}`
    : `Due ${due.toLocaleString("en-ZA")}`;
}

async function runTicketReminderJob() {
  if (jobRunning) {
    console.log("Morning ticket reminder skipped because the previous run is still active.");
    return { skipped: true };
  }

  jobRunning = true;
  try {
    const autoClosed=await pool.query(`UPDATE tickets SET status='Closed',closed_at=NOW(),updated_at=NOW() WHERE status='Resolved' AND resolved_at<=NOW()-INTERVAL '7 days' AND archived_at IS NULL RETURNING id`);
    for(const row of autoClosed.rows){await pool.query("INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value) VALUES($1,NULL,'auto_closed_after_7_days','Resolved','Closed')",[row.id]).catch(()=>{});}
    const result = await pool.query(`
      SELECT
        u.id AS user_id,
        u.email,
        u.name,
        t.id,
        t.ticket_ref,
        t.title,
        t.priority,
        t.status,
        t.created_at,
        t.due_at,
        COALESCE(g.name, t.external_group_name) AS group_name
      FROM tickets t
      JOIN users u ON u.id = t.assigned_to_user_id
      LEFT JOIN support_groups g ON g.id = t.assigned_group_id
      WHERE t.status NOT IN ('Resolved', 'Closed')
        AND u.approved = TRUE
        AND u.status = 'active'
        AND u.archived_at IS NULL
        AND u.deactivated_at IS NULL
        AND COALESCE(u.account_type, 'person') = 'person'
        AND COALESCE(u.microsoft_account_enabled, TRUE) = TRUE
        AND COALESCE(u.email, '') <> ''
      ORDER BY
        u.id,
        CASE t.priority
          WHEN 'Critical' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          ELSE 4
        END,
        t.due_at NULLS LAST,
        t.created_at
    `);

    const recipients = new Map();
    for (const row of result.rows) {
      if (!recipients.has(row.user_id)) {
        recipients.set(row.user_id, {
          name: row.name,
          email: row.email,
          tickets: [],
        });
      }
      recipients.get(row.user_id).tickets.push(row);
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const person of recipients.values()) {
      const htmlRows = person.tickets.map((ticket) => {
        const ticketUrl = `${PORTAL_URL}/tickets/${ticket.id}`;
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb"><a href="${ticketUrl}">${escapeHtml(ticket.ticket_ref || `TICKET-${ticket.id}`)}</a></td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(ticket.title)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(ticket.priority)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(ticket.status)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(ticket.group_name || "No group")}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${ticketAge(ticket.created_at)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(dueLabel(ticket))}</td>
        </tr>`;
      }).join("");

      const textRows = person.tickets.map((ticket) =>
        `${ticket.ticket_ref || `TICKET-${ticket.id}`} | ${ticket.title} | ${ticket.priority} | ${ticket.status} | ${ticketAge(ticket.created_at)} | ${dueLabel(ticket)} | ${PORTAL_URL}/tickets/${ticket.id}`
      ).join("\n");

      const queueUrl = `${PORTAL_URL}/tickets?assignment=mine&statuses=Open,Assigned,Pending,Investigating,Waiting%20Approval,Escalated`;
      const delivery = await sendEmail({
        to: person.email,
        category: "reminder",
        subject: `Pending Helpdesk Tickets - ${person.tickets.length} item(s)`,
        html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
          <p>Good morning ${escapeHtml(person.name || "")},</p>
          <p>You have <strong>${person.tickets.length}</strong> unresolved ticket(s) assigned to you.</p>
          <table style="border-collapse:collapse;width:100%;font-size:13px">
            <thead><tr><th>Reference</th><th>Title</th><th>Priority</th><th>Status</th><th>Group</th><th>Age</th><th>Due/SLA</th></tr></thead>
            <tbody>${htmlRows}</tbody>
          </table>
          <p><a href="${queueUrl}">Open my pending-ticket queue</a></p>
        </div>`,
        text: `Good morning ${person.name || ""},\n\nYou have ${person.tickets.length} unresolved ticket(s) assigned to you.\n\n${textRows}\n\nQueue: ${queueUrl}\n\nRegards,\nATD Helpdesk`,
      });

      if (delivery.sent) sent += 1;
      else if (delivery.skipped) skipped += 1;
      else failed += 1;
    }

    return { recipients: recipients.size, sent, skipped, failed, autoClosed: autoClosed.rowCount };
  } catch (error) {
    console.error("Ticket reminder job failed:", error.message);
    return { failed: true, error: error.message };
  } finally {
    jobRunning = false;
  }
}

function startTicketReminderJob() {
  return cron.schedule("0 8 * * 1-5", runTicketReminderJob, {
    timezone: "Africa/Johannesburg",
  });
}

module.exports = { startTicketReminderJob, runTicketReminderJob };
