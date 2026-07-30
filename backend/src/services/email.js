const dns = require("dns");
const nodemailer = require("nodemailer");

const {
  isGraphEmailConfigured,
  verifyGraphEmailConfiguration,
  sendGraphMail,
} = require("./graphEmail");

dns.setDefaultResultOrder("ipv4first");

const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== "false";
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || "smtp")
  .trim()
  .toLowerCase();

const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
const SMTP_SECURE = String(
  process.env.SMTP_SECURE || process.env.EMAIL_SECURE || "false"
).trim().toLowerCase() === "true";
const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASSWORD || "";
const GRAPH_MAIL_SENDER = process.env.GRAPH_MAIL_SENDER || "";
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_FROM ||
  (GRAPH_MAIL_SENDER
    ? `ATD Helpdesk <${GRAPH_MAIL_SENDER}>`
    : EMAIL_USER
      ? `ATD Helpdesk <${EMAIL_USER}>`
      : "ATD Helpdesk");
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || GRAPH_MAIL_SENDER || EMAIL_USER || "";
const PUBLIC_PORTAL_URL = String(
  process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk"
).replace(/\/$/, "");

let smtpTransporter = null;

function isSmtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && EMAIL_USER && EMAIL_PASS && EMAIL_FROM);
}

function isEmailConfigured() {
  if (!EMAIL_ENABLED) return false;
  if (EMAIL_PROVIDER === "microsoft-graph") return isGraphEmailConfigured();
  if (EMAIL_PROVIDER === "smtp") return isSmtpConfigured();
  return false;
}

function createEmailTransporter() {
  if (!isSmtpConfigured()) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    family: 4,
    requireTLS: !SMTP_SECURE,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

function getEmailTransporter() {
  if (!smtpTransporter) smtpTransporter = createEmailTransporter();
  return smtpTransporter;
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
  if (!recipients) return [];
  const values = Array.isArray(recipients) ? recipients : String(recipients).split(/[;,]/);
  return Array.from(new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)));
}

async function verifyEmailTransporter() {
  if (!EMAIL_ENABLED) {
    console.log("Email delivery is disabled with EMAIL_ENABLED=false.");
    return false;
  }
  if (!isSmtpConfigured()) {
    console.warn("SMTP email configuration is incomplete.", {
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
    await getEmailTransporter().verify();
    console.log("SMTP email transporter verified.", { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE });
    return true;
  } catch (error) {
    console.error("SMTP email verification failed:", {
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

async function verifyEmailProvider() {
  if (!EMAIL_ENABLED) {
    console.log("Email delivery is disabled with EMAIL_ENABLED=false.");
    return false;
  }
  if (EMAIL_PROVIDER === "microsoft-graph") {
    if (!isGraphEmailConfigured()) {
      console.warn("Microsoft Graph email configuration is incomplete.", {
        tenantConfigured: Boolean(process.env.GRAPH_MAIL_TENANT_ID),
        clientConfigured: Boolean(process.env.GRAPH_MAIL_CLIENT_ID),
        secretConfigured: Boolean(process.env.GRAPH_MAIL_CLIENT_SECRET),
        senderConfigured: Boolean(process.env.GRAPH_MAIL_SENDER),
      });
      return false;
    }
    try {
      const result = await verifyGraphEmailConfiguration();
      console.log("Microsoft Graph email verified.", result);
      return true;
    } catch (error) {
      console.error("Microsoft Graph email verification failed:", {
        status: error.response?.status || null,
        code: error.response?.data?.error?.code || error.code || null,
        message: error.response?.data?.error?.message || error.message,
        requestId: error.response?.headers?.["request-id"] || null,
      });
      return false;
    }
  }
  if (EMAIL_PROVIDER === "smtp") return verifyEmailTransporter();
  console.warn("Unsupported email provider.", { provider: EMAIL_PROVIDER });
  return false;
}

async function sendMailSafe({ to, cc, bcc, subject, html, text, replyTo }) {
  const recipients = normalizeRecipients(to);
  const ccRecipients = normalizeRecipients(cc);
  const bccRecipients = normalizeRecipients(bcc);

  if (!EMAIL_ENABLED) return { sent: false, skipped: true, reason: "Email delivery is disabled." };
  if (!isEmailConfigured()) return { sent: false, skipped: true, provider: EMAIL_PROVIDER, reason: "Email configuration is incomplete." };
  if (recipients.length === 0) return { sent: false, skipped: true, reason: "No valid recipients were supplied." };
  if (!String(subject || "").trim()) return { sent: false, skipped: true, reason: "Email subject is required." };

  try {
    if (EMAIL_PROVIDER === "microsoft-graph") {
      const result = await sendGraphMail({
        to: recipients,
        cc: ccRecipients,
        bcc: bccRecipients,
        subject,
        html,
        text,
        replyTo: replyTo || EMAIL_REPLY_TO,
      });
      console.log("Microsoft Graph email accepted:", {
        status: result.status,
        sender: result.sender,
        recipientCount: result.recipientCount,
        subject,
      });
      return result;
    }

    const info = await getEmailTransporter().sendMail({
      from: EMAIL_FROM,
      replyTo: replyTo || EMAIL_REPLY_TO || undefined,
      to: recipients.join(","),
      cc: ccRecipients.length ? ccRecipients.join(",") : undefined,
      bcc: bccRecipients.length ? bccRecipients.join(",") : undefined,
      subject,
      html,
      text,
    });
    console.log("SMTP email sent successfully:", {
      messageId: info.messageId,
      acceptedCount: info.accepted?.length || 0,
      rejectedCount: info.rejected?.length || 0,
      subject,
    });
    return { sent: true, skipped: false, provider: "smtp", info };
  } catch (error) {
    const safeError = {
      status: error.response?.status || null,
      code: error.response?.data?.error?.code || error.code || null,
      message: error.response?.data?.error?.message || error.message,
      requestId: error.response?.headers?.["request-id"] || null,
      recipientCount: recipients.length,
      subject,
      provider: EMAIL_PROVIDER,
    };
    console.error("Email delivery failed:", safeError);
    return {
      sent: false,
      skipped: false,
      provider: EMAIL_PROVIDER,
      error: { code: safeError.code, message: safeError.message, requestId: safeError.requestId },
    };
  }
}

async function sendEmail(optionsOrTo, subject, html, text) {
  if (optionsOrTo && typeof optionsOrTo === "object" && !Array.isArray(optionsOrTo)) {
    return sendMailSafe(optionsOrTo);
  }
  return sendMailSafe({ to: optionsOrTo, subject, html, text });
}

async function sendApprovalEmail(user) {
  const recipients = normalizeRecipients(process.env.ADMIN_EMAIL);
  if (!recipients.length) return { sent: false, skipped: true, reason: "ADMIN_EMAIL is not configured." };

  const adminUsersUrl = `${PUBLIC_PORTAL_URL}/admin/users?view=pending`;
  const subject = "New User Signup Pending Approval";
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
      <p>Hi,</p>
      <p>A new user has registered and is waiting for approval.</p>
      <div style="margin:18px 0;padding:14px;background:#f8fafc;border-left:4px solid #2563eb;">
        <p style="margin:0;"><strong>Name:</strong> ${escapeHtml(user?.name || "N/A")}</p>
        <p style="margin:0;"><strong>Email:</strong> ${escapeHtml(user?.email || "N/A")}</p>
      </div>
      <p><a href="${adminUsersUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Review Pending Signups</a></p>
      <p>Kind regards,<br/><strong>ATD Helpdesk</strong></p>
    </div>`;
  const text = `New account request pending approval.\n\nName: ${user?.name || "N/A"}\nEmail: ${user?.email || "N/A"}\n\nReview: ${adminUsersUrl}`;
  return sendMailSafe({ to: recipients, subject, html, text });
}

async function sendAccountRequestReceivedEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: "Requester email is unavailable." };
  const loginUrl = `${PUBLIC_PORTAL_URL}/login`;
  const subject = "ATD Helpdesk Account Request Received";
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
      <p>Hi ${escapeHtml(user.name || "ATD user")},</p>
      <p>Your ATD Helpdesk account request was received and is awaiting approval.</p>
      <p>You can sign in after an administrator approves and activates the account.</p>
      <p><a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Return to Sign In</a></p>
      <p>If assistance is required, contact the IT team.</p>
      <p>Kind regards,<br/><strong>ATD Helpdesk</strong></p>
    </div>`;
  const text = `Hi ${user.name || "ATD user"},\n\nYour ATD Helpdesk account request was received and is awaiting approval.\n\nSign in: ${loginUrl}\n\nKind regards,\nATD Helpdesk`;
  return sendMailSafe({ to: user.email, subject, html, text });
}

async function sendM365WelcomeEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: "Recipient email is unavailable." };
  const subject = "Welcome to the ATD Helpdesk Portal";
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
      <p>Hi ${escapeHtml(user.name || "ATD user")},</p>
      <p>Your Microsoft 365 account has been registered on the <strong>ATD Helpdesk Portal</strong>.</p>
      <div style="margin:18px 0;padding:14px;background:#f8fafc;border-left:4px solid #2563eb;">
        <p style="margin:0;"><strong>Email:</strong> ${escapeHtml(user.email)}</p>
        <p style="margin:0;"><strong>Portal role:</strong> ${escapeHtml(user.role || "user")}</p>
      </div>
      <p><a href="${PUBLIC_PORTAL_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open ATD Helpdesk</a></p>
      <p>Kind regards,<br/><strong>ATD Helpdesk</strong></p>
    </div>`;
  const text = `Hi ${user.name || "ATD user"},\n\nYour Microsoft 365 account has been registered on the ATD Helpdesk Portal.\n\nOpen: ${PUBLIC_PORTAL_URL}`;
  return sendMailSafe({ to: user.email, subject, html, text });
}

async function sendTicketAssignmentEmail({ recipients, ticket, groupName }) {
  const normalizedRecipients = normalizeRecipients(recipients);
  if (!normalizedRecipients.length) return { sent: false, skipped: true, reason: "No assignment email recipients were found." };

  const reference = ticket?.ticket_ref || `TICKET-${ticket?.id}`;
  const title = ticket?.title || "Untitled ticket";
  const url = `${PUBLIC_PORTAL_URL}/tickets/${ticket?.id}`;
  const subject = `Ticket Assigned - ${reference}`;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;">
      <p>Hi,</p>
      <p>A Helpdesk ticket has been assigned to ${escapeHtml(groupName || "your team")}.</p>
      <div style="margin:18px 0;padding:14px;background:#f8fafc;border-left:4px solid #2563eb;">
        <p style="margin:0;"><strong>Ticket:</strong> ${escapeHtml(reference)}</p>
        <p style="margin:0;"><strong>Title:</strong> ${escapeHtml(title)}</p>
        <p style="margin:0;"><strong>Priority:</strong> ${escapeHtml(ticket?.priority || "Medium")}</p>
        <p style="margin:0;"><strong>Status:</strong> ${escapeHtml(ticket?.status || "Open")}</p>
      </div>
      <p>${escapeHtml(ticket?.description || "No description provided.")}</p>
      <p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open Ticket</a></p>
      <p>Kind regards,<br/><strong>ATD Helpdesk</strong></p>
    </div>`;
  const text = `Ticket: ${reference}\nTitle: ${title}\nPriority: ${ticket?.priority || "Medium"}\nStatus: ${ticket?.status || "Open"}\n\n${url}`;
  return sendMailSafe({ to: normalizedRecipients, subject, html, text });
}

module.exports = {
  EMAIL_PROVIDER,
  isEmailConfigured,
  verifyEmailProvider,
  verifyEmailTransporter,
  sendMailSafe,
  sendEmail,
  sendApprovalEmail,
  sendAccountRequestReceivedEmail,
  sendTicketAssignmentEmail,
  sendM365WelcomeEmail,
};
