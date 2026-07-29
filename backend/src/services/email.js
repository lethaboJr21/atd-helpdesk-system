const dns = require("dns");
const nodemailer = require("nodemailer");

dns.setDefaultResultOrder("ipv4first");

const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== "false";

const SMTP_HOST =
  process.env.SMTP_HOST ||
  process.env.EMAIL_HOST ||
  "";

const SMTP_PORT = Number(
  process.env.SMTP_PORT ||
    process.env.EMAIL_PORT ||
    587
);

const SMTP_SECURE =
  String(
    process.env.SMTP_SECURE ||
      process.env.EMAIL_SECURE ||
      "false"
  )
    .trim()
    .toLowerCase() === "true";

const EMAIL_USER =
  process.env.EMAIL_USER ||
  process.env.SMTP_USER ||
  "";

const EMAIL_PASS =
  process.env.EMAIL_PASS ||
  process.env.SMTP_PASSWORD ||
  "";

const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  `"ATD Helpdesk" <${EMAIL_USER}>`;

const PUBLIC_PORTAL_URL =
  process.env.PUBLIC_PORTAL_URL ||
  "http://localhost:5173/helpdesk";

let transporter = null;

function isEmailConfigured() {
  return Boolean(
    EMAIL_ENABLED &&
      SMTP_HOST &&
      SMTP_PORT &&
      EMAIL_USER &&
      EMAIL_PASS &&
      EMAIL_FROM
  );
}

function createEmailTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    family: 4,
    requireTLS: !SMTP_SECURE,
    connectionTimeout: Number(
      process.env.SMTP_CONNECTION_TIMEOUT || 10000
    ),
    greetingTimeout: Number(
      process.env.SMTP_GREETING_TIMEOUT || 10000
    ),
    socketTimeout: Number(
      process.env.SMTP_SOCKET_TIMEOUT || 15000
    ),
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

function getEmailTransporter() {
  if (!transporter) {
    transporter = createEmailTransporter();
  }

  return transporter;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeRecipients(recipients) {
  if (!recipients) {
    return [];
  }

  const recipientList = Array.isArray(recipients)
    ? recipients
    : [recipients];

  return Array.from(
    new Set(
      recipientList
        .map((emailAddress) => {
          return String(emailAddress || "")
            .trim()
            .toLowerCase();
        })
        .filter(Boolean)
    )
  );
}

async function verifyEmailTransporter() {
  if (!EMAIL_ENABLED) {
    console.log("Email delivery is disabled with EMAIL_ENABLED=false.");
    return false;
  }

  if (!isEmailConfigured()) {
    console.warn("Email configuration is incomplete.", {
      hostConfigured: Boolean(SMTP_HOST),
      port: SMTP_PORT || null,
      secure: SMTP_SECURE,
      userConfigured: Boolean(EMAIL_USER),
      passwordConfigured: Boolean(EMAIL_PASS),
      fromConfigured: Boolean(EMAIL_FROM),
    });

    return false;
  }

  try {
    const activeTransporter = getEmailTransporter();
    await activeTransporter.verify();

    console.log("Email transporter verified.", {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
    });

    return true;
  } catch (error) {
    console.error("Email transporter verification failed:", {
      code: error.code || null,
      command: error.command || null,
      responseCode: error.responseCode || null,
      message: error.message,
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
    });

    return false;
  }
}

async function sendMailSafe({
  to,
  subject,
  html,
  text,
}) {
  const recipients = normalizeRecipients(to);

  if (!EMAIL_ENABLED) {
    return {
      sent: false,
      skipped: true,
      reason: "Email delivery is disabled.",
    };
  }

  if (!isEmailConfigured()) {
    return {
      sent: false,
      skipped: true,
      reason: "Email configuration is incomplete.",
    };
  }

  if (recipients.length === 0) {
    return {
      sent: false,
      skipped: true,
      reason: "No valid recipients were supplied.",
    };
  }

  try {
    const activeTransporter = getEmailTransporter();

    const info = await activeTransporter.sendMail({
      from: EMAIL_FROM,
      to: recipients.join(","),
      subject,
      html,
      text,
    });

    console.log("Email sent successfully:", {
      messageId: info.messageId,
      acceptedCount: info.accepted?.length || 0,
      rejectedCount: info.rejected?.length || 0,
      subject,
    });

    return {
      sent: true,
      skipped: false,
      info,
    };
  } catch (error) {
    console.error("Email delivery failed:", {
      code: error.code || null,
      command: error.command || null,
      responseCode: error.responseCode || null,
      message: error.message,
      recipientCount: recipients.length,
      subject,
    });

    return {
      sent: false,
      skipped: false,
      error: {
        code: error.code || null,
        message: error.message,
      },
    };
  }
}

async function sendApprovalEmail(user) {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    return {
      sent: false,
      skipped: true,
      reason: "ADMIN_EMAIL is not configured.",
    };
  }

  const adminUsersUrl = `${PUBLIC_PORTAL_URL}/admin/users`;
  const safeName = escapeHtml(user?.name || "N/A");
  const safeEmail = escapeHtml(user?.email || "N/A");
  const subject = "New User Signup Pending Approval";

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
      <p>Hi Admin,</p>
      <p>A new user has registered and is waiting for approval.</p>
      <div style="margin:18px 0;padding:14px;background:#f8fafc;border-left:4px solid #2563eb;">
        <p style="margin:0;"><strong>Name:</strong> ${safeName}</p>
        <p style="margin:0;"><strong>Email:</strong> ${safeEmail}</p>
      </div>
      <p>
        <a href="${adminUsersUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Open Admin Users
        </a>
      </p>
      <p>Kind regards,<br/><strong>ATD Helpdesk</strong></p>
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
  `.trim();

  return sendMailSafe({
    to: adminEmail,
    subject,
    html,
    text,
  });
}

async function sendM365WelcomeEmail(user) {
  const safeName = escapeHtml(user?.name || "ATD user");
  const safeEmail = escapeHtml(user?.email || "");
  const subject = "Welcome to the ATD Helpdesk Portal";

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
      <p>Hi ${safeName},</p>
      <p>Your Microsoft 365 account has been registered on the <strong>ATD Helpdesk Portal</strong>.</p>
      <div style="margin:18px 0;padding:14px;background:#f8fafc;border-left:4px solid #2563eb;">
        <p style="margin:0;"><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin:0;"><strong>Default role:</strong> Standard user</p>
      </div>
      <p>
        <a href="${PUBLIC_PORTAL_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Open ATD Helpdesk
        </a>
      </p>
      <p>Kind regards,<br/><strong>ATD Helpdesk</strong></p>
    </div>
  `;

  const text = `
Hi ${user?.name || "ATD user"},

Your Microsoft 365 account has been registered on the ATD Helpdesk Portal.

Email: ${user?.email || ""}
Default role: Standard user

Open ATD Helpdesk:
${PUBLIC_PORTAL_URL}

Kind regards,
ATD Helpdesk
  `.trim();

  return sendMailSafe({
    to: user?.email,
    subject,
    html,
    text,
  });
}

async function sendTicketAssignmentEmail({
  recipients,
  ticket,
  groupName,
}) {
  const normalizedRecipients = normalizeRecipients(recipients);

  if (normalizedRecipients.length === 0) {
    return {
      sent: false,
      skipped: true,
      reason: "No assignment email recipients were found.",
    };
  }

  const ticketReference =
    ticket?.ticket_ref ||
    `TICKET-${ticket?.id}`;

  const ticketTitle =
    ticket?.title ||
    "Untitled ticket";

  const ticketUrl =
    `${PUBLIC_PORTAL_URL}/tickets/${ticket?.id}`;

  const subject = `Ticket Assigned - ${ticketReference}`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
      <p>Hi,</p>
      <p>A Helpdesk ticket has been assigned to ${escapeHtml(groupName || "your team")}.</p>
      <div style="margin:18px 0;padding:14px;background:#f8fafc;border-left:4px solid #2563eb;">
        <p style="margin:0;"><strong>Ticket:</strong> ${escapeHtml(ticketReference)}</p>
        <p style="margin:0;"><strong>Title:</strong> ${escapeHtml(ticketTitle)}</p>
        <p style="margin:0;"><strong>Priority:</strong> ${escapeHtml(ticket?.priority || "Medium")}</p>
        <p style="margin:0;"><strong>Status:</strong> ${escapeHtml(ticket?.status || "Open")}</p>
      </div>
      <p>${escapeHtml(ticket?.description || "No description provided.")}</p>
      <p>
        <a href="${ticketUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Open Ticket
        </a>
      </p>
      <p>Kind regards,<br/><strong>ATD Helpdesk</strong></p>
    </div>
  `;

  const text = `
Hi,

A Helpdesk ticket has been assigned to ${groupName || "your team"}.

Ticket: ${ticketReference}
Title: ${ticketTitle}
Priority: ${ticket?.priority || "Medium"}
Status: ${ticket?.status || "Open"}

${ticket?.description || "No description provided."}

Open Ticket:
${ticketUrl}

Kind regards,
ATD Helpdesk
  `.trim();

  return sendMailSafe({
    to: normalizedRecipients,
    subject,
    html,
    text,
  });
}

module.exports = {
  verifyEmailTransporter,
  sendMailSafe,
  sendApprovalEmail,
  sendTicketAssignmentEmail,
  sendM365WelcomeEmail,
};
