
const dns = require("dns");
const nodemailer = require("nodemailer");

const {
  isGraphEmailConfigured,
  verifyGraphEmailConfiguration,
  sendGraphMail,
} = require("./graphEmail");
const {
  getEmailGovernance,
  getUserEmailPreferences,
} = require("./systemSettings");

const pool = require("../db/pool");

dns.setDefaultResultOrder("ipv4first");

const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== "false";
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();
const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || process.env.EMAIL_SECURE || "false")
  .trim()
  .toLowerCase() === "true";
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
    .replaceAll("'", "&#39;");
}

function normalizeRecipients(recipients) {
  if (!recipients) return [];
  const values = Array.isArray(recipients)
    ? recipients
    : String(recipients).split(/[;,]/);

  return Array.from(new Set(
    values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  ));
}

function categoryPreferenceKey(category) {
  return ({
    ticket_assignment: "assignment_emails",
    ticket_update: "ticket_update_emails",
    reminder: "reminder_emails",
    escalation: "escalation_emails",
    account_request: "administrative_emails",
    account_approval: "administrative_emails",
    welcome: "administrative_emails",
    requester_update: "ticket_update_emails",
    ticket_created: "ticket_update_emails",
    assignment_proposed: "assignment_emails",
    assignment_accepted: "assignment_emails",
  })[category] || null;
}

async function filterRecipientsByPreference(recipients, category) {
  const preferenceKey = categoryPreferenceKey(category);
  if (!preferenceKey || recipients.length === 0) return recipients;

  const result = await pool.query(
    `SELECT id, LOWER(email) AS email
       FROM users
      WHERE LOWER(email) = ANY($1::text[])`,
    [recipients]
  );

  const userByEmail = new Map(result.rows.map((row) => [row.email, row.id]));
  const allowed = [];

  for (const recipient of recipients) {
    const userId = userByEmail.get(recipient);
    if (!userId) {
      allowed.push(recipient);
      continue;
    }

    const preferences = await getUserEmailPreferences(userId);
    if (preferences.email_enabled !== false && preferences[preferenceKey] !== false) {
      allowed.push(recipient);
    }
  }

  return allowed;
}

async function verifyEmailTransporter() {
  if (!EMAIL_ENABLED) return false;
  if (!isSmtpConfigured()) return false;

  try {
    await getEmailTransporter().verify();
    console.log("SMTP email transporter verified.", {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
    });
    return true;
  } catch (error) {
    console.error("SMTP email verification failed:", {
      code: error.code || null,
      message: error.message,
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
    if (!isGraphEmailConfigured()) return false;
    const result = await verifyGraphEmailConfiguration();
    console.log("Microsoft Graph email verified.", result);
    return true;
  }

  if (EMAIL_PROVIDER === "smtp") return verifyEmailTransporter();
  return false;
}

async function sendMailSafe({
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  replyTo,
  category = "general",
  bypassUserPreferences = false,
  attachments = [],
}) {
  const intendedTo = normalizeRecipients(to);
  const intendedCc = normalizeRecipients(cc);
  const intendedBcc = normalizeRecipients(bcc);
  const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 10) : [];

  if (!EMAIL_ENABLED) {
    return { sent: false, skipped: true, reason: "Email delivery is disabled by environment configuration." };
  }

  let governance = { mode: "live", testRecipients: [], categories: {} };

  try {
    governance = await getEmailGovernance();
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }

  // Test-environment guard: EMAIL_REDIRECT_ALL forces testing mode for this
  // process only, routing every outgoing email to the given address(es)
  // regardless of the shared governance settings.
  if (process.env.EMAIL_REDIRECT_ALL) {
    governance = {
      ...governance,
      mode: "testing",
      testRecipients: normalizeRecipients(process.env.EMAIL_REDIRECT_ALL),
    };
  }

  if (governance.mode === "disabled") {
    return { sent: false, skipped: true, reason: "System email delivery is disabled." };
  }

  if (governance.categories?.[category] === false) {
    return { sent: false, skipped: true, reason: `Email category '${category}' is disabled.` };
  }

  let recipients = intendedTo;
  let ccRecipients = intendedCc;
  let bccRecipients = intendedBcc;

  if (!bypassUserPreferences && governance.mode === "live") {
    recipients = await filterRecipientsByPreference(recipients, category);
    ccRecipients = await filterRecipientsByPreference(ccRecipients, category);
    bccRecipients = await filterRecipientsByPreference(bccRecipients, category);
  }

  let effectiveSubject = String(subject || "").trim();
  let effectiveHtml = html;
  let effectiveText = text;

  if (governance.mode === "testing") {
    const originalRecipients = [...recipients, ...ccRecipients, ...bccRecipients];
    recipients = normalizeRecipients(governance.testRecipients);
    ccRecipients = [];
    bccRecipients = [];

    if (recipients.length === 0) {
      return { sent: false, skipped: true, reason: "Testing mode has no configured test recipients." };
    }

    const originalLabel = originalRecipients.join(", ") || "none";
    effectiveSubject = `[TEST - Intended for ${originalLabel}] ${effectiveSubject}`;
    effectiveHtml = `<div style="padding:12px;background:#fff7ed;border:1px solid #fdba74;margin-bottom:16px;"><strong>ATD Helpdesk testing mode</strong><br/>Original recipients: ${escapeHtml(originalLabel)}</div>${effectiveHtml || ""}`;
    effectiveText = `ATD Helpdesk testing mode\nOriginal recipients: ${originalLabel}\n\n${effectiveText || ""}`;
  }

  if (!isEmailConfigured()) {
    return { sent: false, skipped: true, provider: EMAIL_PROVIDER, reason: "Email configuration is incomplete." };
  }

  if (recipients.length === 0) {
    return { sent: false, skipped: true, reason: "No recipients remain after email preferences were applied." };
  }

  if (!effectiveSubject) {
    return { sent: false, skipped: true, reason: "Email subject is required." };
  }

  try {
    if (EMAIL_PROVIDER === "microsoft-graph") {
      return await sendGraphMail({
        to: recipients,
        cc: ccRecipients,
        bcc: bccRecipients,
        subject: effectiveSubject,
        html: effectiveHtml,
        text: effectiveText,
        replyTo: replyTo || EMAIL_REPLY_TO,
        attachments: safeAttachments,
      });
    }

    const info = await getEmailTransporter().sendMail({
      from: EMAIL_FROM,
      replyTo: replyTo || EMAIL_REPLY_TO || undefined,
      to: recipients.join(","),
      cc: ccRecipients.length ? ccRecipients.join(",") : undefined,
      bcc: bccRecipients.length ? bccRecipients.join(",") : undefined,
      subject: effectiveSubject,
      html: effectiveHtml,
      text: effectiveText,
      attachments: safeAttachments,
    });

    return { sent: true, skipped: false, provider: "smtp", info };
  } catch (error) {
    console.error("Email delivery failed:", {
      code: error.response?.data?.error?.code || error.code || null,
      message: error.response?.data?.error?.message || error.message,
      category,
      provider: EMAIL_PROVIDER,
    });

    return {
      sent: false,
      skipped: false,
      provider: EMAIL_PROVIDER,
      error: {
        code: error.response?.data?.error?.code || error.code || null,
        message: error.response?.data?.error?.message || error.message,
      },
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
  const adminUsersUrl = `${PUBLIC_PORTAL_URL}/admin/users?view=pending`;
  return sendMailSafe({
    to: recipients,
    category: "account_approval",
    subject: "New User Signup Pending Approval",
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.6;"><p>Hi,</p><p>A new user has registered and is waiting for approval.</p><p><strong>Name:</strong> ${escapeHtml(user?.name || "N/A")}<br/><strong>Email:</strong> ${escapeHtml(user?.email || "N/A")}</p><p><a href="${adminUsersUrl}">Review Pending Signups</a></p></div>`,
    text: `New account request pending approval.\nName: ${user?.name || "N/A"}\nEmail: ${user?.email || "N/A"}\nReview: ${adminUsersUrl}`,
  });
}

async function sendAccountRequestReceivedEmail(user) {
  return sendMailSafe({
    to: user?.email,
    category: "account_request",
    subject: "ATD Helpdesk Account Request Received",
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;"><p>Hi ${escapeHtml(user?.name || "ATD user")},</p><p>Your account request was received and is awaiting approval.</p><p><a href="${PUBLIC_PORTAL_URL}/login">Return to Sign In</a></p></div>`,
    text: `Your ATD Helpdesk account request was received and is awaiting approval.\n${PUBLIC_PORTAL_URL}/login`,
  });
}

async function sendM365WelcomeEmail(user) {
  return sendMailSafe({
    to: user?.email,
    category: "welcome",
    subject: "Welcome to the ATD Helpdesk Portal",
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;"><p>Hi ${escapeHtml(user?.name || "ATD user")},</p><p>Your Microsoft 365 account has been registered on ATD Helpdesk.</p><p><a href="${PUBLIC_PORTAL_URL}">Open ATD Helpdesk</a></p></div>`,
    text: `Your Microsoft 365 account has been registered on ATD Helpdesk.\n${PUBLIC_PORTAL_URL}`,
  });
}

async function sendTicketParticipationInvitation({ participant, ticket, inviter, reason, sourceType, accessScope }) {
  const recipient=participant?.email; const reference=ticket?.ticket_ref||`TICKET-${ticket?.id}`; const ticketUrl=`${PUBLIC_PORTAL_URL}/tickets/${ticket?.id}`; const dashboardUrl=`${PUBLIC_PORTAL_URL}/employee`;
  return sendMailSafe({to:recipient,category:"ticket_update",subject:`[${reference}] Ticket participation invitation`,html:`<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>ATD Helpdesk participation invitation</h2><p>Hi ${escapeHtml(participant?.name||"there")},</p><p>${escapeHtml(inviter?.name||inviter?.email||"A Helpdesk user")} invited you to participate in <strong>${escapeHtml(reference)}</strong>.</p><p><strong>${escapeHtml(ticket?.title||"Untitled ticket")}</strong></p><div style="padding:12px;background:#f8fafc;border-radius:8px">${escapeHtml(reason)}</div><p>Access: ${escapeHtml(accessScope||"reply_only")} | Source: ${escapeHtml(sourceType||"requested_reply")}</p><p>You may read requester-visible content and reply. Internal notes, assignment, SLA, resolution, closure, archive and deletion controls remain restricted.</p><p><a href="${ticketUrl}" style="background:#172b57;color:white;padding:10px 16px;text-decoration:none;border-radius:8px">Open authorised ticket</a> &nbsp; <a href="${dashboardUrl}">Employee Dashboard</a></p></div>`,text:`ATD Helpdesk participation invitation\n${reference}\n${ticket?.title||""}\n\nReason: ${reason}\nAccess: ${accessScope||"reply_only"}\n\nOpen ticket: ${ticketUrl}\nEmployee Dashboard: ${dashboardUrl}`});
}
async function sendTicketAssignmentEmail({ recipients, ticket, groupName }) {
  const reference = ticket?.ticket_ref || `TICKET-${ticket?.id}`;
  const url = `${PUBLIC_PORTAL_URL}/tickets/${ticket?.id}`;
  return sendMailSafe({
    to: recipients,
    category: "ticket_assignment",
    subject: `Ticket Assigned - ${reference}`,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;"><p>A ticket has been assigned to ${escapeHtml(groupName || "your team")}.</p><p><strong>${escapeHtml(reference)}</strong><br/>${escapeHtml(ticket?.title || "Untitled ticket")}</p><p><a href="${url}">Open Ticket</a></p></div>`,
    text: `Ticket: ${reference}\nTitle: ${ticket?.title || "Untitled ticket"}\n${url}`,
  });
}

async function sendTicketCreatedEmail({ requester, ticket, attachmentCount = 0 }) {
  const reference = ticket?.ticket_ref || `TICKET-${ticket?.id}`;
  const ticketUrl = `${PUBLIC_PORTAL_URL}/tickets/${ticket?.id}`;
  const myTicketsUrl = `${PUBLIC_PORTAL_URL}/tickets?view=mine`;
  const rows = [
    ["Request type", ticket?.ticket_type || "Request"], ["Category", [ticket?.category,ticket?.sub_category,ticket?.item_category].filter(Boolean).join(" / ") || "Not classified"],
    ["Priority", ticket?.priority || "Medium"], ["Status", ticket?.status || "Open"], ["Workspace", ticket?.workspace || "IT"],
    ["Support group", ticket?.assigned_group_name || "Not available"], ["Assigned agent", ticket?.assigned_to_name || "Not available"],
    ["Attachments", String(Number(attachmentCount) || 0)], ["Created", new Date(ticket?.created_at || Date.now()).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })],
  ];
  const table = rows.map(([label,value]) => `<tr><td style="padding:7px 12px;color:#64748b">${escapeHtml(label)}</td><td style="padding:7px 12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join("");
  return sendMailSafe({ to: requester?.email || ticket?.requester_email, category:"ticket_created", subject:`Request received - ${reference}`,
    html:`<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>We received your request</h2><p>Hi ${escapeHtml(requester?.name || ticket?.requester_name || "there")},</p><p>Your request was created successfully.</p><p><strong>${escapeHtml(reference)}</strong><br>${escapeHtml(ticket?.title || "Untitled request")}</p><div style="padding:12px;background:#f8fafc;border-radius:8px;white-space:pre-wrap">${escapeHtml(ticket?.description || "")}</div><table style="margin:16px 0;border-collapse:collapse">${table}</table><p><a href="${ticketUrl}" style="background:#172b57;color:white;padding:10px 16px;text-decoration:none;border-radius:8px">Open Ticket</a> &nbsp; <a href="${myTicketsUrl}">My Tickets</a></p></div>`,
    text:`We received your request.\n${reference}\n${ticket?.title || ""}\n\n${ticket?.description || ""}\n\n${rows.map(([a,b])=>`${a}: ${b}`).join("\n")}\n\nOpen: ${ticketUrl}\nMy Tickets: ${myTicketsUrl}` });
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
  sendTicketParticipationInvitation,
  sendTicketCreatedEmail,
  sendM365WelcomeEmail,
};
