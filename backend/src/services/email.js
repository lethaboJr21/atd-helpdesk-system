const nodemailer = require("nodemailer");
const dns = require("dns");

// ✅ Prefer IPv4 to avoid SMTP IPv6 routing issues
dns.setDefaultResultOrder("ipv4first");

// ✅ Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * ✅ Sends approval request email to admin.
 * Triggered when a new user signs up.
 */
async function sendApprovalEmail(user) {
  const adminEmail = process.env.ADMIN_EMAIL;

  // ✅ Prevent silent failure if ADMIN_EMAIL is missing
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is missing in backend/.env");
  }

  const info = await transporter.sendMail({
    from: `"ATD Helpdesk" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: "New User Signup Pending Approval",
    html: `
      <h2>New User Pending Approval</h2>

      <p>A new user has registered and is waiting for approval.</p>

      <p><strong>Name:</strong> ${user.name || "N/A"}</p>
      <p><strong>Email:</strong> ${user.email || "N/A"}</p>

      <p>Please open the Admin Users page to approve or reject this user.</p>

      <p>
        <a href="http://localhost:5173/admin/users">
          Open Admin Users
        </a>
      </p>
    `,
  });

  

  console.log("Approval email sent to:", adminEmail);
  console.log("Approval email message ID:", info.messageId);

  return info;
}
/**
 *  Sends ticket assignment email to a group or assigned agent.
 */
async function sendTicketAssignmentEmail({ recipients, ticket, groupName }) {
  if (!recipients || recipients.length === 0) {
    console.log("No ticket email recipients found.");
    return null;
  }

  const uniqueRecipients = [...new Set(recipients.filter(Boolean))];

  const info = await transporter.sendMail({
    from: `"ATD Helpdesk" <${process.env.EMAIL_USER}>`,
    to: uniqueRecipients.join(","),
    subject: `New Ticket Assigned: ${ticket.ticket_ref || ticket.id}`,
    html: `
      <h2>New Helpdesk Ticket Assigned</h2>

      <p>A ticket has been created and assigned to your group.</p>

      <p><strong>Ticket:</strong> ${ticket.ticket_ref || ticket.id}</p>
      <p><strong>Title:</strong> ${ticket.title}</p>
      <p><strong>Priority:</strong> ${ticket.priority}</p>
      <p><strong>Status:</strong> ${ticket.status}</p>
      <p><strong>Group:</strong> ${groupName || "N/A"}</p>

      <p>Please open the Ticket Workspace to review and action this ticket.</p>

      <p>
        <a href="http://localhost:5173/tickets">
          Open Ticket Workspace
        </a>
      </p>
    `,
  });

  console.log("Ticket assignment email sent to:", uniqueRecipients.join(", "));
  console.log("Ticket assignment email ID:", info.messageId);

  return info;
}


module.exports = {
  sendApprovalEmail,sendTicketAssignmentEmail
};