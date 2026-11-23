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
  const preferred = ["All IT Agents", classification.requiresTriage ? "Service Desk" : classification.workspace, classification.category, "IT"].filter(Boolean);
  const result = await client.query(
    `SELECT id, name FROM support_groups
     WHERE COALESCE(is_active, TRUE)=TRUE
     ORDER BY CASE
       WHEN lower(name)=lower($1) THEN 0
       WHEN lower(name)=lower($2) THEN 1
       WHEN lower(name)=lower($3) THEN 2
       WHEN lower(name)=lower($4) THEN 3
       ELSE 4 END, name
     LIMIT 1`,
    [preferred[0] || "All IT Agents", preferred[1] || "Service Desk", preferred[2] || "IT", preferred[3] || "IT"]
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

function messageRecipients(message,key){return (message?.[key]||[]).map(row=>String(row?.emailAddress?.address||"").trim().toLowerCase()).filter(Boolean);}
function referenceFromSubject(subject){const matches=Array.from(new Set((String(subject||"").toUpperCase().match(/\b(?:INC|REQ|CHG|PRJ)-\d{5,}\b/g)||[])));return {reference:matches.length===1?matches[0]:null,ambiguous:matches.length>1,matches};}
async function ticketForReply(client,message){
 const parsed=referenceFromSubject(message.subject);
 if(parsed.ambiguous)return {reason:"ambiguous_reference",matches:parsed.matches};
 if(parsed.reference){const found=await client.query("SELECT * FROM tickets WHERE UPPER(ticket_ref)=$1 LIMIT 1",[parsed.reference]);if(found.rows[0])return {ticket:found.rows[0],matchedBy:"subject_reference"};return {reason:"reference_not_found",reference:parsed.reference};}
 if(message.conversationId){const found=await client.query(`SELECT t.* FROM email_ticket_intake e JOIN tickets t ON t.id=e.ticket_id WHERE e.conversation_id=$1 AND e.ticket_id IS NOT NULL ORDER BY e.created_at DESC LIMIT 1`,[message.conversationId]);if(found.rows[0])return {ticket:found.rows[0],matchedBy:"conversation_id"};}
 return {reason:"new_request"};
}
async function authorisedReplySender(client,ticket,senderEmail){
 const email=String(senderEmail||"").toLowerCase();if(!email)return false;
 const result=await client.query(`SELECT EXISTS(
 SELECT 1 FROM users u WHERE LOWER(u.email)=$1 AND (u.id=$2 OR u.id=$3 OR EXISTS(SELECT 1 FROM ticket_collaborators c WHERE c.ticket_id=$4 AND c.user_id=u.id AND c.is_active=TRUE) OR EXISTS(SELECT 1 FROM support_group_members gm WHERE gm.group_id=$5 AND gm.user_id=u.id))
 UNION ALL SELECT 1 FROM ticket_email_participants p WHERE p.ticket_id=$4 AND LOWER(p.email)=$1 AND p.is_active=TRUE
 ) allowed`,[email,ticket.requester_id,ticket.assigned_to_user_id,ticket.id,ticket.assigned_group_id]);return Boolean(result.rows[0]?.allowed);
}
async function attachReplyFromMessage(message,settings=config()){
 const client=await pool.connect();let intakeId=null;try{await client.query("BEGIN");intakeId=await reserveMessage(client,message,settings);if(!intakeId){await client.query("ROLLBACK");return {duplicate:true,messageId:message.id};}
 const sender=senderFrom(message);const match=await ticketForReply(client,message);if(!match.ticket){await client.query("UPDATE email_ticket_intake SET status=$1,error_message=NULL,raw_metadata=raw_metadata||$2::jsonb,updated_at=NOW() WHERE id=$3",[match.reason,JSON.stringify({reference:match.reference||null,matches:match.matches||[]}),intakeId]);await client.query("COMMIT");return {handled:match.reason!=="new_request",...match,intakeId};}
 if(!await authorisedReplySender(client,match.ticket,sender.email)){await client.query("UPDATE email_ticket_intake SET status='unauthorised_reply',ticket_id=$1,updated_at=NOW() WHERE id=$2",[match.ticket.id,intakeId]);await client.query("COMMIT");return {handled:true,reason:"unauthorised_reply",ticketId:match.ticket.id,intakeId};}
 const bodyText=message.body?.contentType==="html"?htmlToText(message.body.content):String(message.body?.content||"").trim();if(!bodyText)throw new Error("Incoming reply has no usable body.");
 const externalId=`graph:${String(settings.mailbox).toLowerCase()}:${message.id}`;const to=messageRecipients(message,"toRecipients");const cc=messageRecipients(message,"ccRecipients");
 const inserted=await client.query(`INSERT INTO ticket_comments(ticket_id,author_user_id,body,is_internal,created_at,external_id,author_name,author_email,origin,internet_message_id,conversation_id,received_at,to_recipients,cc_recipients,raw_metadata) VALUES($1,(SELECT id FROM users WHERE LOWER(email)=LOWER($2) LIMIT 1),$3,FALSE,COALESCE($4::timestamptz,NOW()),$5,$6,$2,'email',$7,$8,$4,$9::jsonb,$10::jsonb,$11::jsonb) ON CONFLICT DO NOTHING RETURNING id`,[match.ticket.id,sender.email,bodyText, message.receivedDateTime||null,externalId,sender.name||null,message.internetMessageId||null,message.conversationId||null,JSON.stringify(to),JSON.stringify(cc),JSON.stringify({graphMessageId:message.id,matchedBy:match.matchedBy,subject:message.subject||null})]);
 await client.query("UPDATE email_ticket_intake SET status='reply_attached',ticket_id=$1,error_message=NULL,updated_at=NOW() WHERE id=$2",[match.ticket.id,intakeId]);if(inserted.rowCount){await client.query("INSERT INTO ticket_history(ticket_id,actor_user_id,action,new_value) VALUES($1,(SELECT id FROM users WHERE LOWER(email)=LOWER($2) LIMIT 1),'email_reply_received',$3)",[match.ticket.id,sender.email,JSON.stringify({sender:sender.email,receivedAt:message.receivedDateTime||null,matchedBy:match.matchedBy})]);await client.query("UPDATE tickets SET updated_at=NOW() WHERE id=$1",[match.ticket.id]);}
 await client.query("COMMIT");return {handled:true,duplicate:!inserted.rowCount,reason:"reply_attached",ticketId:match.ticket.id,intakeId,commentId:inserted.rows[0]?.id||null};
 }catch(error){await client.query("ROLLBACK").catch(()=>{});if(intakeId)await pool.query("UPDATE email_ticket_intake SET status='failed',error_message=$1,updated_at=NOW() WHERE id=$2",[error.message,intakeId]).catch(()=>{});throw error;}finally{client.release();}
}
async function financeRouting(client,settings,sender){
 const mailbox=(await client.query(`SELECT * FROM finance_mailboxes WHERE LOWER(email)=LOWER($1) AND active=TRUE LIMIT 1`,[settings.mailbox])).rows[0];
 if(!mailbox||!mailbox.authorised||!mailbox.monitoring_enabled)return null;
 const external=(await client.query(`SELECT * FROM finance_external_senders WHERE LOWER(email)=LOWER($1) AND active=TRUE LIMIT 1`,[sender.email])).rows[0]||null;
 if(external?.blocked||external?.verification_status==="blocked")return {blocked:true,mailbox,external};
 return {mailbox,external,priority:mailbox.default_priority||"Medium",groupId:mailbox.default_group_id||null,assigneeId:mailbox.default_assignee_id||null,financeFunction:external?.finance_function||mailbox.finance_function||"General Finance Administration",triageState:external?.verification_status==="trusted"?"actionable":"triage_required",riskLevel:external?.verification_status==="under_review"?"high":"normal"};
}async function createTicketFromMessage(message, settings = config()) {
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
    const finance = await financeRouting(client, settings, sender);
    if (finance?.blocked) throw new Error("Finance sender is blocked by governance policy.");
    const group = finance?.groupId
      ? { id: finance.groupId, name: "Finance routing rule" }
      : await findGroup(client, classification);
    const temporaryRef = `TMP-MAIL-${crypto.createHash("sha256").update(`${settings.mailbox}:${message.id}`).digest("hex").slice(0, 24)}`;
    const requestDetails = {
      module: classification.ticketType,
      emailIntake: {
        mailbox: settings.mailbox,
        graphMessageId: message.id,
        internetMessageId: message.internetMessageId || null,
        conversationId: message.conversationId || null,
        receivedAt: message.receivedDateTime || null,
        externalSender: !requester,
        importance: message.importance || "normal",
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
       VALUES ($1,$2,$3,$13,'Open',$4,$5,$5,$6,$7,'Email',$8,
               'email',$9,$10,$11,$12::jsonb,NOW(),NOW())
       RETURNING id`,
      [temporaryRef, title, bodyText || "Request received by email.", classification.workspace,
       requester?.id || null, group?.id || null, classification.category, classification.ticketType,
       message.internetMessageId || message.id, requester ? null : sender.name || null,
       requester ? null : sender.email, JSON.stringify(requestDetails), finance?.priority || "Medium"]
    );
    const ticketId = inserted.rows[0].id;
    const emailImportant = String(message.importance||'').toLowerCase()==='high';
    await client.query(`UPDATE tickets SET is_important=$1,importance_source='email',important_marked_at=CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id=$2`,[emailImportant,ticketId]);
    const ticketRef = await allocateTicketRef(client, ticketId, classification.ticketType);

    await client.query(
      `UPDATE email_ticket_intake
       SET status='created', classification=$1, confidence=$2, assigned_group_id=$3,
           ticket_id=$4, updated_at=NOW()
       WHERE id=$5`,
      [classification.ticketType, classification.confidence, group?.id || null, ticketId, intakeId]
    );
    if(finance){
      const responseDue=new Date(Date.now()+Number(finance.mailbox.first_response_minutes||1440)*60000);
      const dueAt=finance.mailbox.due_minutes?new Date(Date.now()+Number(finance.mailbox.due_minutes)*60000):null;
      await client.query(`UPDATE tickets SET workspace='FIN',assigned_group_id=COALESCE($1,assigned_group_id),assigned_to_user_id=$2,priority=$3,response_due_at=$4,due_at=COALESCE($5,due_at),status=CASE WHEN $2::bigint IS NULL THEN status ELSE 'Assigned' END WHERE id=$6`,[finance.groupId,finance.assigneeId,finance.priority,responseDue,dueAt,ticketId]);
      await client.query(`INSERT INTO finance_ticket_operations(ticket_id,source_mailbox_id,external_sender_id,intake_id,triage_state,first_response_due_at,waiting_party,last_meaningful_update_at,finance_function,risk_level,sender_classification,external_organisation,unattended_since,routed_by_rule) VALUES($1,$2,$3,$4,$5,$6,'internal',NOW(),$7,$8,$9,$10,NOW(),TRUE) ON CONFLICT(ticket_id) DO UPDATE SET source_mailbox_id=EXCLUDED.source_mailbox_id,external_sender_id=EXCLUDED.external_sender_id,intake_id=EXCLUDED.intake_id,triage_state=EXCLUDED.triage_state,first_response_due_at=EXCLUDED.first_response_due_at,finance_function=EXCLUDED.finance_function,risk_level=EXCLUDED.risk_level,sender_classification=EXCLUDED.sender_classification,external_organisation=EXCLUDED.external_organisation,unattended_since=EXCLUDED.unattended_since,routed_by_rule=TRUE,updated_at=NOW()`,[ticketId,finance.mailbox.id,finance.external?.id||null,intakeId,finance.triageState,responseDue,finance.financeFunction,finance.riskLevel,finance.external?.sender_type||"unknown",finance.external?.organisation||null]);
    }    await client.query("COMMIT");

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
  const select = ["id", "internetMessageId", "conversationId", "subject", "body", "from", "sender", "replyTo", "toRecipients", "ccRecipients", "receivedDateTime", "webLink", "importance", "isRead"].join(",");
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
      const replyResult = await attachReplyFromMessage(message, settings);
      const result = replyResult.handled || replyResult.duplicate ? replyResult : await createTicketFromMessage(message, settings);
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

module.exports = { config, runEmailIntake, createTicketFromMessage, attachReplyFromMessage, referenceFromSubject, startEmailTicketIntakeScheduler };
