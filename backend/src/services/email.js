const nodemailer = require("nodemailer");
const dns = require("dns");

// Prefer IPv4 to avoid SMTP IPv6 routing issues.
dns.setDefaultResultOrder("ipv4first");

const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== "false";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const PUBLIC_PORTAL_URL =
  process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk";

const SMTP_FROM =
  process.env.SMTP_FROM || `"ATD Helpdesk" <${process.env.EMAIL_USER}>`;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: !SMTP_SECURE,
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeRecipients(recipients) {
  if (!recipients) return [];

  const list = Array.isArray(recipients) ? recipients : [recipients];

  return [...new Set(list.map((email) => String(email || "").trim()).filter(Boolean))];
}

async function verifyEmailTransporter() {
  if (!EMAIL_ENABLED) {
    console.log("📭 Email disabled with EMAIL_ENABLED=false");
    return false;
  }

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn("⚠️ EMAIL_USER or EMAIL_PASS missing. Email will not send.");
    return false;
  }

  try {
    await transporter.verify();
    console.log("✅ Email transporter verified");
    return true;
  } catch (err) {
    console.error("❌ Email transporter verification failed:", err.message);
    return false;
  }
}

async function sendMailSafe({ to, subject, html, text }) {
  const recipients = normalizeRecipients(to);

  if (!EMAIL_ENABLED) {
    console.log("📭 Email disabled. Skipping:", subject);
    return null;
  }

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn("⚠️ Email credentials missing. Skipping:", subject);
    return null;
  }

  if (recipients.length === 0) {
    console.log("📭 No recipients. Skipping:", subject);
    return null;
  }

  console.log("📧 Sending email:", {
    to: recipients,
    subject,
  });

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to: recipients.join(","),
    subject,
    html,
    text,
  });

  console.log("✅ Email sent:", {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });

  return info;
}

/**
 * Sends approval request email to admin.
 * Triggered when a new user signs up.
 */
async function sendApprovalEmail(user) {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is missing in backend/.env");
  }

  const adminUsersUrl = `${PUBLIC_PORTAL_URL}/admin/users`;

  const name = escapeHtml(user?.name || "N/A");
  const email = escapeHtml(user?.email || "N/A");

  const subject = "New User Signup Pending Approval";

  const html = `
    <div style="font-family:Segoe UI, Arial, sans-serif; color:#1f2937; font-size:14px; line-height:1.6;">
      <p>Hi Admin,</p>

      <p>A new user has registered and is waiting for approval.</p>

      <div style="margin:18px 0; padding:14px; background:#f8fafc; border-left:4px solid #2563eb;">
        <p style="margin:0;"><strong>Name:</strong> ${name}</p>
        <p style="margin:0;"><strong>Email:</strong> ${email}</p>
      </div>

      <p>Please open the Admin Users page to approve or reject this user.</p>

      <p>
        <a href="${adminUsersUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600;">
          Open Admin Users
        </a>
      </p>

      <p style="margin-top:28px;">
        Kind regards,<br/>
        <strong>ATD Helpdesk</strong><br/>
        IT Support Portal
      </p>

      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />

      <p style="font-size:12px; color:#64748b;">
        This is an automated notification from the ATD Alliance Helpdesk Portal.
      </p>
    </div>
  `;

  const text = `
Hi Admin,

A new user has registered and is waiting for approval.

Name: ${user?.name || "N/A"}
Email: ${user?.email || "N/A"}

Open Admin Users:
${adminUsersUrl}

Kind regards,
ATD Helpdesk
`;

  return sendMailSafe({
    to: adminEmail,
    subject,
    html,
    text,
  });
}

/**
 * Sends ticket assignment email to group members or assigned agent.
 */
async function sendTicketAssignmentEmail({ recipients, ticket, groupName }) {
  const uniqueRecipients = normalizeRecipients(recipients);

  if (uniqueRecipients.length === 0) {
    console.log("📭 No ticket assignment email recipients found.", {
      ticketId: ticket?.id,
      ticketRef: ticket?.ticket_ref,
    });

    return null;
  }

  const ticketRef = ticket?.ticket_ref || `TICKET-${ticket?.id}`;
  const ticketTitle = ticket?.title || "Untitled ticket";
  const ticketUrl = `${PUBLIC_PORTAL_URL}/tickets/${ticket?.id}`;

  const safeTicketRef = escapeHtml(ticketRef);
  const safeTitle = escapeHtml(ticketTitle);
  const safeDescription = escapeHtml(ticket?.description || "No description provided.");
  const safePriority = escapeHtml(ticket?.priority || "Medium");
  const safeStatus = escapeHtml(ticket?.status || "Open");
  const safeWorkspace = escapeHtml(ticket?.workspace || "IT");
  const safeGroup = escapeHtml(groupName || "N/A");

  const subject = `Assigned to Group - ${ticketTitle}`;

  const html = `
    <div style="font-family:Segoe UI, Arial, sans-serif; color:#1f2937; font-size:14px; line-height:1.6;">
      <p>Hi,</p>

      <p>
        A new incident has been assigned to your group
        <strong>${safeGroup}</strong>. Please follow the link below to view the incident.
      </p>

      <h3 style="margin-top:24px; color:#111827;">
        ${safeTitle}
      </h3>

      <p>
        <strong>Ticket:</strong> ${safeTicketRef}<br/>
        <strong>Priority:</strong> ${safePriority}<br/>
        <strong>Status:</strong> ${safeStatus}<br/>
        <strong>Workspace:</strong> ${safeWorkspace}<br/>
        <strong>Assigned Group:</strong> ${safeGroup}
      </p>

      <div style="margin:20px 0; padding:14px; background:#f8fafc; border-left:4px solid #2563eb;">
        <strong>Description</strong>
        <p style="white-space:pre-wrap; margin-bottom:0;">${safeDescription}</p>
      </div>

      <p>
        <a href="${ticketUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600;">
          Open Ticket
        </a>
      </p>

      <p style="margin-top:28px;">
        Kind regards,<br/>
        <strong>ATD Helpdesk</strong><br/>
        IT Support Portal
      </p>

      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />

      <p style="font-size:12px; color:#64748b;">
        This is an automated notification from the ATD Alliance Helpdesk Portal.
      </p>
    </div>
  `;

  const text = `
Hi,

A new incident has been assigned to your group "${groupName || "N/A"}".

Ticket: ${ticketRef}
Title: ${ticketTitle}
Priority: ${ticket?.priority || "Medium"}
Status: ${ticket?.status || "Open"}
Workspace: ${ticket?.workspace || "IT"}
Assigned Group: ${groupName || "N/A"}

Description:
${ticket?.description || "No description provided."}

Open Ticket:
${ticketUrl}

Kind regards,
ATD Helpdesk
`;

  return sendMailSafe({
    to: uniqueRecipients,
    subject,
    html,
    text,
  });
}

module.exports = {
  verifyEmailTransporter,
  sendApprovalEmail,
  sendTicketAssignmentEmail,
};