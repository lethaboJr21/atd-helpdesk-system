"use strict";

const crypto = require("crypto");
const pool = require("../db/pool");
const { classifyEmail } = require("./emailTicketClassifier");

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
// Required application permissions: Mail.ReadWrite and Mail.Send, scoped to the Helpdesk mailbox.
const TOKEN_ROOT = "https://login.microsoftonline.com";

function config() {
  return {
    tenantId: process.env.GRAPH_MAIL_TENANT_ID || process.env.MICROSOFT_TENANT_ID,
    clientId: process.env.GRAPH_MAIL_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.GRAPH_MAIL_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET,
    mailbox: process.env.GRAPH_MAIL_SENDER || process.env.EMAIL_FROM || "info@atdalliance.co.za",
    enabled: String(process.env.EMAIL_TO_TICKET_ENABLED || "false").toLowerCase() === "true",
    intervalMs: Math.max(Number(process.env.EMAIL_TO_TICKET_INTERVAL_MS) || 60000, 30000),
    pageSize: Math.min(Math.max(Number(process.env.EMAIL_TO_TICKET_PAGE_SIZE) || 1, 1), 25),
    receivedAfter: String(process.env.EMAIL_TO_TICKET_RECEIVED_AFTER || "").trim(),
  };
}

async function graphToken(settings = config()) {
  const missing = ["tenantId", "clientId", "clientSecret"].filter((key) => !settings[key]);
  if (missing.length) throw new Error(`Missing Graph email configuration: ${missing.join(", ")}`);
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(`${TOKEN_ROOT}/${encodeURIComponent(settings.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Graph token request failed (${response.status}): ${await response.text()}`);
  return (await response.json()).access_token;
}

async function graphRequest(path, options = {}, settings = config()) {
  const token = await graphToken(settings);
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Graph request failed (${response.status}): ${responseText}`);
  }
  if (!responseText.trim()) return null;
  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Graph returned invalid JSON (${response.status}): ${error.message}`);
  }
}

function htmlToText(value = "") {
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function senderFrom(message = {}) {
  const address = message.replyTo?.[0]?.emailAddress || message.from?.emailAddress || message.sender?.emailAddress || {};
  return { email: String(address.address || "").trim().toLowerCase(), name: String(address.name || "").trim() };
}

function validSmtpAddress(value = "") {
  const email = String(value).trim().toLowerCase();
  if (!email || email.length > 254) return false;
  if (email.startsWith("/o=") || email.includes("imceaex") || email.includes("x500:")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function automatedMessageReason(message = {}, settings = config()) {
  const sender = senderFrom(message).email;
  const subject = String(message.subject || "").trim();
  const mailbox = String(settings.mailbox || "").trim().toLowerCase();
  if (!validSmtpAddress(sender)) return "invalid-or-legacy-sender";
  if (sender === mailbox) return "helpdesk-mailbox-message";
  if (/^(postmaster|mailer-daemon|no-?reply)@/i.test(sender) || /(^|[._-])no-?reply@/i.test(sender)) return "automated-sender";
  if (/^(automatic reply|auto(?:matic)? reply|out of office|undeliverable|delivery (?:has )?failed|non-delivery report|mail delivery failed)\s*:/i.test(subject)) return "automated-subject";
  if (/^\[(?:INC|REQ|CHG|PRJ)-\d+\]\s+We received your Helpdesk request/i.test(subject)) return "helpdesk-acknowledgement";
  if (/^\[Ticket #\d+\]/i.test(subject)) return "legacy-ticket-notification";
  return null;
}

async function findGroup(client, classification) {
  const preferred = classification.requiresTriage ? ["Service Desk", "IT", "Infrastructure Team"] : [classification.workspace, classification.category, "IT"];
  const result = await client.query(
    `SELECT id, name FROM support_groups
     WHERE COALESCE(is_active, TRUE)=TRUE
     ORDER BY CASE
       WHEN lower(name)=lower($1) THEN 0
       WHEN lower(name)=lower($2) THEN 1
       WHEN lower(name)=lower($3) THEN 2
       ELSE 3 END, name
     LIMIT 1`,
    [preferred[0] || "IT", preferred[1] || "IT", preferred[2] || "IT"]
  );
  return result.rows[0] || null;
}

async function findRequester(client, email) {
  if (!email) return null;
  const result = await client.query(
    `SELECT id, name, email FROM users
     WHERE lower(email)=lower($1)
       AND approved=TRUE AND status='active' AND archived_at IS NULL
       AND COALESCE(account_type,'person')='person'
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function allocateTicketRef(client, ticketId, ticketType) {
  const prefix = { incident: "INC", service_request: "REQ", asset_request: "REQ", change: "CHG", project: "PRJ" }[ticketType] || "INC";
  const ticketRef = `${prefix}-${String(ticketId).padStart(5, "0")}`;
  await client.query("UPDATE tickets SET ticket_ref=$1 WHERE id=$2", [ticketRef, ticketId]);
  return ticketRef;
}

async function acknowledge({ mailbox, recipient, senderName, ticketRef, title }, settings = config()) {
  if (!validSmtpAddress(recipient)) return { status: "skipped", reason: "invalid-recipient" };
  const safeName = senderName || "there";
  const body = {
    message: {
      subject: `[${ticketRef}] We received your Helpdesk request`,
      body: {
        contentType: "HTML",
        content: `<p>Hello ${safeName},</p><p>Your request has been received and created as <strong>${ticketRef}</strong>.</p><p><strong>${title}</strong></p><p>Please keep ${ticketRef} in the subject when replying.</p><p>ATD Helpdesk</p>`,
      },
      toRecipients: [{ emailAddress: { address: recipient } }],
    },
    saveToSentItems: true,
  };
  await graphRequest(`/users/${encodeURIComponent(mailbox)}/sendMail`, { method: "POST", body: JSON.stringify(body) }, settings);
  return { status: "sent" };
}

async function reserveMessage(client, message, settings) {
  const sender = senderFrom(message);
  const result = await client.query(
    `INSERT INTO email_ticket_intake
      (mailbox, graph_message_id, internet_message_id, conversation_id, sender_email, sender_name,
       subject, received_at, status, raw_metadata, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'processing',$9::jsonb,NOW())
     ON CONFLICT (mailbox, graph_message_id) DO NOTHING
     RETURNING id`,
    [settings.mailbox, message.id, message.internetMessageId || null, message.conversationId || null,
     sender.email || null, sender.name || null, message.subject || "No subject", message.receivedDateTime || null,
     JSON.stringify({ webLink: message.webLink || null, importance: message.importance || null })]
  );
  return result.rows[0]?.id || null;
}

async function createTicketFromMessage(message, settings = config()) {
  const client = await pool.connect();
  let intakeId = null;
  try {
    await client.query("BEGIN");
    intakeId = await reserveMessage(client, message, settings);
    if (!intakeId) {
      await client.query("ROLLBACK");
      return { duplicate: true, messageId: message.id };
    }

    const sender = senderFrom(message);
    if (!sender.email) throw new Error("Incoming message has no usable sender address.");
    if (sender.email === settings.mailbox.toLowerCase()) throw new Error("Mailbox-generated message ignored to prevent a mail loop.");

    const bodyText = message.body?.contentType === "html" ? htmlToText(message.body.content) : String(message.body?.content || "").trim();
    const title = String(message.subject || "Email request").replace(/^\s*(re|fw|fwd)\s*:\s*/i, "").trim().slice(0, 500) || "Email request";
    const classification = classifyEmail({ subject: title, body: bodyText });
    const requester = await findRequester(client, sender.email);
    const group = await findGroup(client, classification);
    const temporaryRef = `TMP-MAIL-${crypto.createHash("sha256").update(`${settings.mailbox}:${message.id}`).digest("hex").slice(0, 24)}`;
    const requestDetails = {
      module: classification.ticketType,
      emailIntake: {
        mailbox: settings.mailbox,
        graphMessageId: message.id,
        internetMessageId: message.internetMessageId || null,
        conversationId: message.conversationId || null,
        receivedAt: message.receivedDateTime || null,
        senderEmail: sender.email,
        senderName: sender.name || null,
      },
      classification: {
        type: classification.ticketType,
        confidence: classification.confidence,
        requiresTriage: classification.requiresTriage,
        reasons: classification.reasons,
      },
    };

    const inserted = await client.query(
      `INSERT INTO tickets
        (ticket_ref, title, description, priority, status, workspace, requester_id,
         created_by_user_id, assigned_group_id, category, source, ticket_type,
         origin, external_id, external_requester_name, external_requester_email,
         request_details, created_at, updated_at)
       VALUES ($1,$2,$3,'Medium','Open',$4,$5,$5,$6,$7,'Email',$8,
               'email',$9,$10,$11,$12::jsonb,NOW(),NOW())
       RETURNING id`,
      [temporaryRef, title, bodyText || "Request received by email.", classification.workspace,
       requester?.id || null, group?.id || null, classification.category, classification.ticketType,
       message.internetMessageId || message.id, requester ? null : sender.name || null,
       requester ? null : sender.email, JSON.stringify(requestDetails)]
    );
    const ticketId = inserted.rows[0].id;
    const ticketRef = await allocateTicketRef(client, ticketId, classification.ticketType);

    await client.query(
      `UPDATE email_ticket_intake
       SET status='created', classification=$1, confidence=$2, assigned_group_id=$3,
           ticket_id=$4, updated_at=NOW()
       WHERE id=$5`,
      [classification.ticketType, classification.confidence, group?.id || null, ticketId, intakeId]
    );
    await client.query("COMMIT");

    // History is best-effort and runs after COMMIT so a legacy history schema
    // cannot roll back a successfully created email ticket.
   await pool.query(
  `INSERT INTO ticket_history
    (ticket_id, actor_user_id, action, old_value, new_value)
   VALUES ($1, $2, $3, $4, $5)`,
  [
    ticketId,
    requester?.id || null,
    "email_intake",
    null,
    JSON.stringify({
      source: "microsoft-graph",
      mailbox: settings.mailbox,
      sender: sender.email,
      classification: classification.ticketType,
      confidence: classification.confidence,
      assignedGroupId: group?.id || null
    })
  ]
).catch((error) =>
  console.warn("Email intake history was not recorded:", error.message)
);

    try {
      const acknowledgement = await acknowledge({ mailbox: settings.mailbox, recipient: sender.email, senderName: sender.name,
        ticketRef, title }, settings);
      const acknowledgementStatus = acknowledgement?.status || "skipped";
      await pool.query(
        `UPDATE email_ticket_intake
         SET status=CASE WHEN $1='sent' THEN 'acknowledged' ELSE status END,
             acknowledgement_status=$1, acknowledgement_error=NULL,
             acknowledged_at=CASE WHEN $1='sent' THEN NOW() ELSE acknowledged_at END,
             error_message=NULL, updated_at=NOW()
         WHERE id=$2`,
        [acknowledgementStatus, intakeId]
      );
    } catch (error) {
      console.error("Email ticket acknowledgement failed:", error.message);
      await pool.query(
        `UPDATE email_ticket_intake
         SET acknowledgement_status='failed', acknowledgement_error=$1,
             error_message=NULL, updated_at=NOW()
         WHERE id=$2`,
        [error.message, intakeId]
      );
    }

    return { duplicate: false, intakeId, ticketId, ticketRef, classification, group };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (intakeId) {
      await pool.query("UPDATE email_ticket_intake SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2", [error.message, intakeId]).catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

async function listUnreadMessages(settings = config()) {
  const select = ["id", "internetMessageId", "conversationId", "subject", "body", "from", "sender", "replyTo", "receivedDateTime", "webLink", "importance", "isRead"].join(",");
  const filters = ["isRead eq false"];
  if (settings.receivedAfter) {
    const cutoff = new Date(settings.receivedAfter);
    if (Number.isNaN(cutoff.getTime())) {
      throw new Error("EMAIL_TO_TICKET_RECEIVED_AFTER must be a valid ISO-8601 timestamp.");
    }
    filters.push(`receivedDateTime ge ${cutoff.toISOString()}`);
  }
  const path = `/users/${encodeURIComponent(settings.mailbox)}/mailFolders/inbox/messages?` +
    new URLSearchParams({
      "$filter": filters.join(" and "),
      "$orderby": "receivedDateTime desc",
      "$top": String(settings.pageSize),
      "$select": select,
    }).toString();
  const payload = await graphRequest(path, {}, settings);
  return Array.isArray(payload?.value) ? payload.value : [];
}

async function markRead(messageId, settings = config()) {
  await graphRequest(`/users/${encodeURIComponent(settings.mailbox)}/messages/${encodeURIComponent(messageId)}`,
    { method: "PATCH", body: JSON.stringify({ isRead: true }) }, settings);
}

async function runEmailIntake({ includeRead = false } = {}) {
  const settings = config();
  const messages = await listUnreadMessages(settings);
  const results = [];
  for (const message of messages) {
    try {
      const skipReason = automatedMessageReason(message, settings);
      if (skipReason) {
        results.push({ messageId: message.id, ok: true, skipped: true, reason: skipReason });
        if (!includeRead) await markRead(message.id, settings);
        continue;
      }
      const result = await createTicketFromMessage(message, settings);
      results.push({ messageId: message.id, ok: true, ...result });
      if (!includeRead) await markRead(message.id, settings);
    } catch (error) {
      console.error("Email-to-ticket intake failed:", error.message);
      results.push({ messageId: message.id, ok: false, error: error.message });
    }
  }
  return { mailbox: settings.mailbox, processed: results.length, results };
}

let timer = null;
let running = false;
function startEmailTicketIntakeScheduler() {
  const settings = config();
  if (!settings.enabled) {
    console.log("Email-to-ticket intake is disabled.");
    return null;
  }
  if (timer) return timer;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runEmailIntake(); }
    catch (error) { console.error("Scheduled email-to-ticket intake failed:", error.message); }
    finally { running = false; }
  };
  setTimeout(tick, 5000);
  timer = setInterval(tick, settings.intervalMs);
  console.log(`Email-to-ticket intake enabled for ${settings.mailbox} every ${settings.intervalMs}ms.`);
  return timer;
}

module.exports = { config, runEmailIntake, createTicketFromMessage, startEmailTicketIntakeScheduler };