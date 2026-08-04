#!/usr/bin/env node
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const pool = require("../src/db/pool");
const fsapi = require("../src/services/freshserviceClient");

/**
 * Mirrors the Freshservice tenant into the ATD Helpdesk database.
 *
 * The sync is idempotent and resumable: every entity is upserted on its
 * Freshservice id, and per-ticket detail work records `detail_synced_at` so an
 * interrupted run picks up where it stopped. Safe to schedule repeatedly until
 * the Freshservice subscription lapses.
 *
 * Usage:
 *   node scripts/freshservice-archive.js                    # everything, resumable
 *   node scripts/freshservice-archive.js --phase=tickets    # one phase only
 *   node scripts/freshservice-archive.js --refresh-details   # re-pull every ticket detail
 *   node scripts/freshservice-archive.js --since=2026-07-01  # incremental top-up
 */

const STATUS_LABELS = {
  2: "Open",
  3: "Pending",
  4: "Resolved",
  5: "Closed",
};

const PRIORITY_LABELS = { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" };

const SOURCE_LABELS = {
  1: "Email",
  2: "Portal",
  3: "Phone",
  4: "Chat",
  5: "Feedback Widget",
  6: "Yammer",
  7: "AWS Cloudwatch",
  8: "Pagerduty",
  9: "Walk-up",
  10: "Slack",
  11: "Workplace",
  12: "Workplace",
  13: "Employee Onboarding",
  14: "Alerts",
  15: "MS Teams",
  18: "Employee Offboarding",
  19: "Journey",
};

// Reference collections that fit comfortably in fs_records.
const REFERENCE_SOURCES = [
  { kind: "workspace", path: "workspaces", collection: "workspaces" },
  { kind: "group", path: "groups", collection: "groups" },
  { kind: "department", path: "departments", collection: "departments" },
  { kind: "location", path: "locations", collection: "locations" },
  { kind: "asset_type", path: "asset_types", collection: "asset_types" },
  { kind: "product", path: "products", collection: "products" },
  { kind: "vendor", path: "vendors", collection: "vendors" },
  { kind: "contract", path: "contracts", collection: "contracts" },
  { kind: "role", path: "roles", collection: "roles" },
  { kind: "sla_policy", path: "sla_policies", collection: "sla_policies" },
  { kind: "business_hours", path: "business_hours", collection: "business_hours" },
  { kind: "ticket_field", path: "ticket_form_fields", collection: "ticket_fields" },
  { kind: "requester_field", path: "requester_fields", collection: "requester_fields" },
  { kind: "agent_field", path: "agent_fields", collection: "agent_fields" },
  { kind: "canned_response_folder", path: "canned_response_folders", collection: "canned_response_folders" },
  {
    kind: "service_category",
    path: "service_catalog/categories",
    collection: "service_categories",
  },
  {
    kind: "service_item",
    path: "service_catalog/items",
    collection: "service_items",
  },
  { kind: "solution_category", path: "solutions/categories", collection: "categories" },
  { kind: "problem", path: "problems", collection: "problems" },
  { kind: "change", path: "changes", collection: "changes" },
  { kind: "release", path: "releases", collection: "releases" },
  { kind: "purchase_order", path: "purchase_orders", collection: "purchase_orders" },
  { kind: "software", path: "applications", collection: "applications" },
];

const args = process.argv.slice(2);

function flag(name) {
  return args.includes(`--${name}`);
}

function option(name, fallback = null) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const options = {
  phase: option("phase", "all"),
  since: option("since"),
  refreshDetails: flag("refresh-details"),
  skipDetails: flag("skip-details"),
  detailLimit: Number.parseInt(option("detail-limit", "0"), 10) || 0,
  dryRun: flag("dry-run"),
};

const counters = {};

function bump(key, by = 1) {
  counters[key] = (counters[key] || 0) + by;
}

function log(message) {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${stamp}] ${message}`);
}

// --- value coercion -------------------------------------------------------

function ts(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function textArray(value) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
    .filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function bigintArray(value) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  return cleaned.length ? cleaned : null;
}

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function personName(row) {
  const joined = [row.first_name, row.last_name]
    .map((v) => str(v))
    .filter(Boolean)
    .join(" ");
  return str(row.name) || str(joined) || str(row.email);
}

// --- persistence ----------------------------------------------------------

/**
 * A few Freshservice config collections (agent/requester field definitions)
 * come back without an `id`. They still need archiving, so derive a stable
 * negative key from the field name — negative ids mark synthesised keys.
 */
function synthesiseId(kind, row) {
  const seed = `${kind}:${
    str(row.name) || str(row.label_for_admins) || str(row.type) || JSON.stringify(row)
  }`;

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 140737488355328; // 2^47
  }

  return -(hash || 1);
}

async function upsertRecord(kind, row, nameKeys = ["name", "title", "label", "subject", "label_for_admins"]) {
  const fsId = num(row.id) ?? synthesiseId(kind, row);

  let name = null;
  for (const key of nameKeys) {
    if (str(row[key])) {
      name = str(row[key]);
      break;
    }
  }

  await pool.query(
    `INSERT INTO fs_records (kind, fs_id, name, parent_fs_id, created_at, updated_at, raw, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (kind, fs_id) DO UPDATE SET
       name = EXCLUDED.name,
       parent_fs_id = EXCLUDED.parent_fs_id,
       created_at = EXCLUDED.created_at,
       updated_at = EXCLUDED.updated_at,
       raw = EXCLUDED.raw,
       synced_at = NOW()`,
    [
      kind,
      fsId,
      name,
      num(row.parent_id ?? row.category_id ?? row.folder_id ?? row.parent_department_id),
      ts(row.created_at),
      ts(row.updated_at),
      JSON.stringify(row),
    ]
  );

  bump(kind);
}

async function upsertPerson(kind, row) {
  const fsId = num(row.id);
  if (fsId === null) return;

  await pool.query(
    `INSERT INTO fs_people (
       fs_id, kind, name, first_name, last_name, email, secondary_emails,
       phone, mobile, job_title, language, time_zone, location_fs_id,
       department_fs_ids, reporting_manager_fs_id, active, has_logged_in,
       created_at, updated_at, raw, synced_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW()
     )
     ON CONFLICT (fs_id) DO UPDATE SET
       kind = EXCLUDED.kind,
       name = EXCLUDED.name,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       email = EXCLUDED.email,
       secondary_emails = EXCLUDED.secondary_emails,
       phone = EXCLUDED.phone,
       mobile = EXCLUDED.mobile,
       job_title = EXCLUDED.job_title,
       language = EXCLUDED.language,
       time_zone = EXCLUDED.time_zone,
       location_fs_id = EXCLUDED.location_fs_id,
       department_fs_ids = EXCLUDED.department_fs_ids,
       reporting_manager_fs_id = EXCLUDED.reporting_manager_fs_id,
       active = EXCLUDED.active,
       has_logged_in = EXCLUDED.has_logged_in,
       created_at = EXCLUDED.created_at,
       updated_at = EXCLUDED.updated_at,
       raw = EXCLUDED.raw,
       synced_at = NOW()`,
    [
      fsId,
      kind,
      personName(row),
      str(row.first_name),
      str(row.last_name),
      str(row.email || row.primary_email),
      textArray(row.secondary_emails),
      str(row.work_phone_number || row.phone),
      str(row.mobile_phone_number || row.mobile),
      str(row.job_title),
      str(row.language),
      str(row.time_zone),
      num(row.location_id),
      bigintArray(row.department_ids),
      num(row.reporting_manager_id),
      row.active === undefined ? null : Boolean(row.active),
      row.has_logged_in === undefined ? null : Boolean(row.has_logged_in),
      ts(row.created_at),
      ts(row.updated_at),
      JSON.stringify(row),
    ]
  );

  bump(kind === "agent" ? "agents" : "requesters");
}

/**
 * Upserts a ticket. `mode` of "list" keeps existing detail columns intact so a
 * cheap list refresh never wipes richer data captured by the detail phase.
 */
async function upsertTicket(row, mode = "list") {
  const fsId = num(row.id);
  if (fsId === null) return;

  const stats = row.stats || null;
  const requester = row.requester || null;
  const isDetail = mode === "detail";

  await pool.query(
    `INSERT INTO fs_tickets (
       fs_id, workspace_id, subject, description_html, description_text, ticket_type,
       status_id, status_label, priority_id, priority_label, source_id, source_label,
       urgency, impact, category, sub_category, item_category,
       requester_fs_id, requester_name, requester_email, requested_for_fs_id,
       responder_fs_id, group_fs_id, department_fs_id,
       cc_emails, to_emails, reply_cc_emails, tags,
       is_escalated, fr_escalated, spam, deleted,
       due_by, fr_due_by, first_responded_at, resolved_at, closed_at,
       created_at, updated_at, custom_fields, stats, raw, synced_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
       $39,$40,$41,$42,NOW()
     )
     ON CONFLICT (fs_id) DO UPDATE SET
       workspace_id = EXCLUDED.workspace_id,
       subject = EXCLUDED.subject,
       description_html = COALESCE(EXCLUDED.description_html, fs_tickets.description_html),
       description_text = COALESCE(EXCLUDED.description_text, fs_tickets.description_text),
       ticket_type = EXCLUDED.ticket_type,
       status_id = EXCLUDED.status_id,
       status_label = EXCLUDED.status_label,
       priority_id = EXCLUDED.priority_id,
       priority_label = EXCLUDED.priority_label,
       source_id = EXCLUDED.source_id,
       source_label = EXCLUDED.source_label,
       urgency = COALESCE(EXCLUDED.urgency, fs_tickets.urgency),
       impact = COALESCE(EXCLUDED.impact, fs_tickets.impact),
       category = EXCLUDED.category,
       sub_category = EXCLUDED.sub_category,
       item_category = EXCLUDED.item_category,
       requester_fs_id = EXCLUDED.requester_fs_id,
       requester_name = COALESCE(EXCLUDED.requester_name, fs_tickets.requester_name),
       requester_email = COALESCE(EXCLUDED.requester_email, fs_tickets.requester_email),
       requested_for_fs_id = EXCLUDED.requested_for_fs_id,
       responder_fs_id = EXCLUDED.responder_fs_id,
       group_fs_id = EXCLUDED.group_fs_id,
       department_fs_id = EXCLUDED.department_fs_id,
       cc_emails = EXCLUDED.cc_emails,
       to_emails = EXCLUDED.to_emails,
       reply_cc_emails = EXCLUDED.reply_cc_emails,
       tags = COALESCE(EXCLUDED.tags, fs_tickets.tags),
       is_escalated = EXCLUDED.is_escalated,
       fr_escalated = EXCLUDED.fr_escalated,
       spam = EXCLUDED.spam,
       deleted = EXCLUDED.deleted,
       due_by = EXCLUDED.due_by,
       fr_due_by = EXCLUDED.fr_due_by,
       first_responded_at = COALESCE(EXCLUDED.first_responded_at, fs_tickets.first_responded_at),
       resolved_at = COALESCE(EXCLUDED.resolved_at, fs_tickets.resolved_at),
       closed_at = COALESCE(EXCLUDED.closed_at, fs_tickets.closed_at),
       created_at = EXCLUDED.created_at,
       updated_at = EXCLUDED.updated_at,
       custom_fields = COALESCE(EXCLUDED.custom_fields, fs_tickets.custom_fields),
       stats = COALESCE(EXCLUDED.stats, fs_tickets.stats),
       raw = CASE WHEN $43 THEN EXCLUDED.raw ELSE fs_tickets.raw END,
       synced_at = NOW()`,
    [
      fsId,
      num(row.workspace_id),
      str(row.subject),
      isDetail ? row.description ?? null : null,
      isDetail ? row.description_text ?? null : null,
      str(row.type),
      num(row.status),
      STATUS_LABELS[num(row.status)] || str(row.status),
      num(row.priority),
      PRIORITY_LABELS[num(row.priority)] || str(row.priority),
      num(row.source),
      SOURCE_LABELS[num(row.source)] || str(row.source),
      num(row.urgency),
      num(row.impact),
      str(row.category),
      str(row.sub_category),
      str(row.item_category),
      num(row.requester_id),
      requester ? personName(requester) : null,
      requester ? str(requester.email) : null,
      num(row.requested_for_id),
      num(row.responder_id),
      num(row.group_id),
      num(row.department_id),
      textArray(row.cc_emails),
      textArray(row.to_emails),
      textArray(row.reply_cc_emails),
      textArray(row.tags),
      row.is_escalated === undefined ? null : Boolean(row.is_escalated),
      row.fr_escalated === undefined ? null : Boolean(row.fr_escalated),
      row.spam === undefined ? null : Boolean(row.spam),
      row.deleted === undefined ? null : Boolean(row.deleted),
      ts(row.due_by),
      ts(row.fr_due_by),
      stats ? ts(stats.first_responded_at) : null,
      stats ? ts(stats.resolved_at) : null,
      stats ? ts(stats.closed_at) : null,
      ts(row.created_at),
      ts(row.updated_at),
      row.custom_fields ? JSON.stringify(row.custom_fields) : null,
      stats ? JSON.stringify(stats) : null,
      JSON.stringify(row),
      isDetail,
    ]
  );
}

async function upsertConversation(ticketFsId, row) {
  const fsId = num(row.id);
  if (fsId === null) return;

  await pool.query(
    `INSERT INTO fs_ticket_conversations (
       fs_id, ticket_fs_id, user_fs_id, body_html, body_text, incoming, private,
       source, from_email, to_emails, cc_emails, bcc_emails, created_at, updated_at,
       raw, synced_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
     ON CONFLICT (fs_id) DO UPDATE SET
       body_html = EXCLUDED.body_html,
       body_text = EXCLUDED.body_text,
       incoming = EXCLUDED.incoming,
       private = EXCLUDED.private,
       source = EXCLUDED.source,
       from_email = EXCLUDED.from_email,
       to_emails = EXCLUDED.to_emails,
       cc_emails = EXCLUDED.cc_emails,
       bcc_emails = EXCLUDED.bcc_emails,
       updated_at = EXCLUDED.updated_at,
       raw = EXCLUDED.raw,
       synced_at = NOW()`,
    [
      fsId,
      ticketFsId,
      num(row.user_id),
      row.body ?? null,
      row.body_text ?? null,
      row.incoming === undefined ? null : Boolean(row.incoming),
      row.private === undefined ? null : Boolean(row.private),
      num(row.source),
      str(row.from_email),
      textArray(row.to_emails),
      textArray(row.cc_emails),
      textArray(row.bcc_emails),
      ts(row.created_at),
      ts(row.updated_at),
      JSON.stringify(row),
    ]
  );

  bump("conversations");
  await upsertAttachments(ticketFsId, fsId, row.attachments);
}

async function upsertAttachments(ticketFsId, conversationFsId, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return;

  for (const attachment of attachments) {
    const fsId = num(attachment.id);
    if (fsId === null) continue;

    await pool.query(
      `INSERT INTO fs_attachments (
         fs_id, ticket_fs_id, conversation_fs_id, name, content_type, size_bytes,
         attachment_url, created_at, raw, synced_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (fs_id) DO UPDATE SET
         ticket_fs_id = COALESCE(EXCLUDED.ticket_fs_id, fs_attachments.ticket_fs_id),
         conversation_fs_id = COALESCE(EXCLUDED.conversation_fs_id, fs_attachments.conversation_fs_id),
         name = EXCLUDED.name,
         content_type = EXCLUDED.content_type,
         size_bytes = EXCLUDED.size_bytes,
         attachment_url = EXCLUDED.attachment_url,
         raw = EXCLUDED.raw,
         synced_at = NOW()`,
      [
        fsId,
        ticketFsId,
        conversationFsId,
        str(attachment.name),
        str(attachment.content_type),
        num(attachment.size),
        str(attachment.attachment_url),
        ts(attachment.created_at),
        JSON.stringify(attachment),
      ]
    );

    bump("attachments");
  }
}

async function upsertAsset(row) {
  const fsId = num(row.id);
  if (fsId === null) return;

  const typeFields = row.type_fields || null;

  await pool.query(
    `INSERT INTO fs_assets (
       fs_id, display_id, name, description, asset_tag, serial_number,
       asset_type_fs_id, impact, usage_type, user_fs_id, location_fs_id,
       department_fs_id, agent_fs_id, group_fs_id, product_fs_id, vendor_fs_id,
       assigned_on, created_at, updated_at, type_fields, raw, synced_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW())
     ON CONFLICT (fs_id) DO UPDATE SET
       display_id = EXCLUDED.display_id,
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       asset_tag = EXCLUDED.asset_tag,
       serial_number = EXCLUDED.serial_number,
       asset_type_fs_id = EXCLUDED.asset_type_fs_id,
       impact = EXCLUDED.impact,
       usage_type = EXCLUDED.usage_type,
       user_fs_id = EXCLUDED.user_fs_id,
       location_fs_id = EXCLUDED.location_fs_id,
       department_fs_id = EXCLUDED.department_fs_id,
       agent_fs_id = EXCLUDED.agent_fs_id,
       group_fs_id = EXCLUDED.group_fs_id,
       product_fs_id = EXCLUDED.product_fs_id,
       vendor_fs_id = EXCLUDED.vendor_fs_id,
       assigned_on = EXCLUDED.assigned_on,
       created_at = EXCLUDED.created_at,
       updated_at = EXCLUDED.updated_at,
       type_fields = COALESCE(EXCLUDED.type_fields, fs_assets.type_fields),
       raw = EXCLUDED.raw,
       synced_at = NOW()`,
    [
      fsId,
      num(row.display_id),
      str(row.name),
      str(row.description),
      str(row.asset_tag),
      str(row.serial_number || (typeFields && typeFields.serial_number)),
      num(row.asset_type_id),
      str(row.impact),
      str(row.usage_type),
      num(row.user_id),
      num(row.location_id),
      num(row.department_id),
      num(row.agent_id),
      num(row.group_id),
      num(row.product_id),
      num(row.vendor_id),
      ts(row.assigned_on),
      ts(row.created_at),
      ts(row.updated_at),
      typeFields ? JSON.stringify(typeFields) : null,
      JSON.stringify(row),
    ]
  );

  bump("assets");
}

// --- phases ---------------------------------------------------------------

async function syncReferenceData() {
  log("Phase: reference data");

  for (const source of REFERENCE_SOURCES) {
    try {
      const rows = await fsapi.fetchAll(source.path, source.collection);
      for (const row of rows) await upsertRecord(source.kind, row);
      log(`  ${source.kind}: ${rows.length}`);
    } catch (error) {
      log(`  ${source.kind}: skipped (${error.message.slice(0, 120)})`);
    }
  }

  await syncSolutionTree();
}

/**
 * Solution folders and articles are nested under their parent, so they need a
 * walk rather than a flat collection fetch.
 */
async function syncSolutionTree() {
  const categories = await pool.query(
    "SELECT fs_id FROM fs_records WHERE kind = 'solution_category'"
  );

  for (const { fs_id: categoryId } of categories.rows) {
    let folders = [];
    try {
      folders = await fsapi.fetchAll("solutions/folders", "folders", {
        category_id: categoryId,
      });
    } catch (error) {
      log(`  solution folders for ${categoryId}: ${error.message.slice(0, 100)}`);
      continue;
    }

    for (const folder of folders) {
      await upsertRecord("solution_folder", { ...folder, parent_id: categoryId });

      try {
        const articles = await fsapi.fetchAll("solutions/articles", "articles", {
          folder_id: folder.id,
        });
        for (const article of articles) {
          await upsertRecord("solution_article", {
            ...article,
            parent_id: folder.id,
          });
        }
      } catch (error) {
        log(`  solution articles for ${folder.id}: ${error.message.slice(0, 100)}`);
      }
    }
  }

  log(
    `  knowledge base: ${counters.solution_folder || 0} folders, ${
      counters.solution_article || 0
    } articles`
  );
}

async function syncPeople() {
  log("Phase: people");

  const agents = await fsapi.fetchAll("agents", "agents");
  for (const agent of agents) await upsertPerson("agent", agent);
  log(`  agents: ${agents.length}`);

  const requesters = await fsapi.fetchAll("requesters", "requesters");
  for (const requester of requesters) await upsertPerson("requester", requester);
  log(`  requesters: ${requesters.length}`);
}

/**
 * Lists every ticket ever raised. Freshservice only returns the last 30 days
 * unless `updated_since` is supplied, and caps how deep pagination can go, so
 * we walk forward in `updated_at` order and re-anchor the window each time a
 * page run ends.
 */
async function syncTicketList() {
  log("Phase: ticket list");

  const seen = new Set();
  const filters = [
    { label: "active", query: {} },
    { label: "deleted", query: { filter: "deleted" } },
    { label: "spam", query: { filter: "spam" } },
  ];

  for (const filter of filters) {
    let cursor = options.since || "2000-01-01T00:00:00Z";
    let guard = 0;
    let filterCount = 0;

    while (guard < 200) {
      guard += 1;
      let batchNewest = null;
      let pageRows = 0;

      try {
        for await (const { rows } of fsapi.paginate(
          "tickets",
          "tickets",
          {
            updated_since: cursor,
            order_by: "updated_at",
            order_type: "asc",
            ...filter.query,
          },
          { perPage: 100, maxPages: 30 }
        )) {
          pageRows += rows.length;

          for (const row of rows) {
            const id = num(row.id);
            if (id !== null && !seen.has(id)) {
              seen.add(id);
              filterCount += 1;
              await upsertTicket(row, "list");
            }
            const updated = ts(row.updated_at);
            if (updated && (!batchNewest || updated > batchNewest)) {
              batchNewest = updated;
            }
          }

          if (filterCount % 500 === 0 && filterCount > 0) {
            log(`  ${filter.label}: ${filterCount} tickets so far`);
          }
        }
      } catch (error) {
        log(`  ${filter.label}: ${error.message.slice(0, 160)}`);
        break;
      }

      if (pageRows === 0 || !batchNewest) break;

      // Re-anchor one second past the newest row to avoid an infinite loop on
      // tickets sharing the same updated_at value.
      const next = new Date(new Date(batchNewest).getTime() + 1000).toISOString();
      if (next === cursor) break;
      cursor = next;
    }

    log(`  ${filter.label}: ${filterCount} tickets`);
  }

  bump("tickets", seen.size);
  log(`  total distinct tickets listed: ${seen.size}`);
}

/**
 * Pulls description, SLA stats, tags and the full conversation thread for each
 * ticket. One request covers all of it; the dedicated conversations endpoint is
 * only used when the inline list looks truncated.
 */
async function syncTicketDetails() {
  log("Phase: ticket details and conversations");

  const where = options.refreshDetails
    ? "TRUE"
    : "(detail_synced_at IS NULL OR updated_at > detail_synced_at)";

  const limit = options.detailLimit > 0 ? `LIMIT ${options.detailLimit}` : "";

  const pending = await pool.query(
    `SELECT fs_id FROM fs_tickets WHERE ${where} ORDER BY fs_id ${limit}`
  );

  const total = pending.rows.length;
  log(`  ${total} tickets need detail`);

  let done = 0;
  let failed = 0;

  for (const { fs_id: fsId } of pending.rows) {
    try {
      const body = await fsapi.get(`tickets/${fsId}`, {
        include: "conversations,stats,tags,requester",
      });

      const ticket = body && body.ticket;
      if (!ticket) {
        failed += 1;
        continue;
      }

      await upsertTicket(ticket, "detail");
      await upsertAttachments(fsId, null, ticket.attachments);

      let conversations = Array.isArray(ticket.conversations)
        ? ticket.conversations
        : [];

      const stats = ticket.stats || {};
      const expected =
        (num(stats.inbound_count) || 0) + (num(stats.outbound_count) || 0);

      if (conversations.length >= 10 || conversations.length < expected) {
        conversations = await fsapi.fetchAll(
          `tickets/${fsId}/conversations`,
          "conversations"
        );
      }

      for (const conversation of conversations) {
        await upsertConversation(fsId, conversation);
      }

      await pool.query(
        `UPDATE fs_tickets
            SET detail_synced_at = NOW(),
                conversations_synced_at = NOW(),
                conversation_count = $2
          WHERE fs_id = $1`,
        [fsId, conversations.length]
      );

      done += 1;
      if (done % 100 === 0) {
        log(`  detail progress: ${done}/${total} (${failed} skipped)`);
      }
    } catch (error) {
      failed += 1;
      log(`  ticket ${fsId}: ${error.message.slice(0, 160)}`);
    }
  }

  bump("ticket_details", done);
  log(`  detail complete: ${done} synced, ${failed} skipped`);
}

async function syncAssets() {
  log("Phase: assets");

  const assets = await fsapi.fetchAll("assets", "assets", {
    include: "type_fields",
  });

  for (const asset of assets) await upsertAsset(asset);
  log(`  assets: ${assets.length}`);
}

const ATTACHMENT_ROOT =
  process.env.FRESHSERVICE_ATTACHMENT_DIR ||
  path.join(__dirname, "..", "storage", "freshservice-attachments");

function safeFileName(name, fallback) {
  const cleaned = String(name || "")
    .replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 150);
  return cleaned || fallback;
}

/**
 * Downloads attachment payloads to local disk. Freshservice serves them from
 * signed URLs that stop working once the tenant lapses, so the bytes have to be
 * copied across rather than merely referenced.
 */
async function syncAttachmentFiles() {
  log("Phase: downloading attachment files");

  const pending = await pool.query(
    `SELECT fs_id, ticket_fs_id, name, attachment_url
       FROM fs_attachments
      WHERE downloaded_at IS NULL
        AND attachment_url IS NOT NULL
      ORDER BY fs_id`
  );

  log(`  ${pending.rows.length} attachments to fetch`);

  let saved = 0;
  let failed = 0;

  for (const row of pending.rows) {
    const directory = path.join(ATTACHMENT_ROOT, String(row.ticket_fs_id || "unlinked"));
    const fileName = `${row.fs_id}-${safeFileName(row.name, "attachment")}`;
    const target = path.join(directory, fileName);

    try {
      await fs.promises.mkdir(directory, { recursive: true });

      const response = await fetch(row.attachment_url, {
        headers: { "User-Agent": "ATD-Helpdesk-Archive/1.0" },
      });

      if (!response.ok) {
        failed += 1;
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.promises.writeFile(target, buffer);

      await pool.query(
        `UPDATE fs_attachments
            SET stored_path = $2, downloaded_at = NOW(), size_bytes = COALESCE(size_bytes, $3)
          WHERE fs_id = $1`,
        [row.fs_id, path.relative(ATTACHMENT_ROOT, target), buffer.length]
      );

      saved += 1;
      if (saved % 50 === 0) log(`  downloaded ${saved}/${pending.rows.length}`);
    } catch (error) {
      failed += 1;
      log(`  attachment ${row.fs_id}: ${error.message.slice(0, 120)}`);
    }
  }

  bump("attachment_files", saved);
  log(`  attachments stored: ${saved}, failed: ${failed}`);
}

/**
 * Freshservice ticket lists carry ids rather than names. Copying the display
 * names onto the ticket rows keeps the archive readable and searchable on its
 * own, without a join back to the reference tables.
 */
async function denormaliseTicketNames() {
  log("Phase: filling in requester, agent and group names");

  const requesters = await pool.query(
    `UPDATE fs_tickets t
        SET requester_name = COALESCE(t.requester_name, p.name),
            requester_email = COALESCE(t.requester_email, p.email)
       FROM fs_people p
      WHERE p.fs_id = t.requester_fs_id
        AND (t.requester_name IS NULL OR t.requester_email IS NULL)`
  );

  const responders = await pool.query(
    `UPDATE fs_tickets t
        SET responder_name = p.name
       FROM fs_people p
      WHERE p.fs_id = t.responder_fs_id
        AND t.responder_name IS DISTINCT FROM p.name`
  );

  const groups = await pool.query(
    `UPDATE fs_tickets t
        SET group_name = r.name
       FROM fs_records r
      WHERE r.kind = 'group'
        AND r.fs_id = t.group_fs_id
        AND t.group_name IS DISTINCT FROM r.name`
  );

  const departments = await pool.query(
    `UPDATE fs_tickets t
        SET department_name = r.name
       FROM fs_records r
      WHERE r.kind = 'department'
        AND r.fs_id = t.department_fs_id
        AND t.department_name IS DISTINCT FROM r.name`
  );

  const assets = await pool.query(
    `UPDATE fs_assets a
        SET asset_type_name = r.name
       FROM fs_records r
      WHERE r.kind = 'asset_type'
        AND r.fs_id = a.asset_type_fs_id
        AND a.asset_type_name IS DISTINCT FROM r.name`
  );

  log(
    `  requesters ${requesters.rowCount}, agents ${responders.rowCount}, groups ${groups.rowCount}, departments ${departments.rowCount}, asset types ${assets.rowCount}`
  );
}

/**
 * Connects archived tickets to the rows already imported into the live
 * `tickets` table so a single lookup surfaces both records.
 */
async function linkLocalTickets() {
  await denormaliseTicketNames();

  log("Phase: linking to live helpdesk tickets");

  const linked = await pool.query(
    `UPDATE fs_tickets f
        SET local_ticket_id = t.id
       FROM tickets t
      WHERE f.local_ticket_id IS DISTINCT FROM t.id
        AND (
          t.external_id = f.fs_id::TEXT
          OR t.external_ticket_id = f.fs_id::TEXT
        )`
  );

  log(`  linked ${linked.rowCount} tickets`);
  bump("linked_tickets", linked.rowCount);
}

// Freshservice status and priority names line up with the helpdesk vocabulary
// apart from Urgent, which the helpdesk calls Critical.
const TICKET_STATUS_MAP = {
  Open: "Open",
  Pending: "Pending",
  Resolved: "Resolved",
  Closed: "Closed",
};

const TICKET_PRIORITY_MAP = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Urgent: "Critical",
};

/**
 * Turns mirrored Freshservice records into first-class helpdesk tickets so they
 * appear in the normal workspace rather than a separate archive.
 *
 * Keyed on `tickets.external_id`, so it is safe to re-run as more detail lands:
 * a second pass fills in descriptions and replies without duplicating rows.
 * Requesters, agents and groups are matched by email or name; where no local
 * record exists the Freshservice name is kept on the ticket itself.
 *
 * Visible ticket references use the same INC-/REQ-/CHG- scheme as natively
 * raised tickets. The Freshservice id stays on `external_id` for tracing.
 */
async function promoteToTickets() {
  log("Phase: promoting Freshservice records into helpdesk tickets");

  const promoted = await pool.query(
    `WITH source AS (
       SELECT
         f.*,
         requester.id            AS local_requester_id,
         COALESCE(f.requester_name, requester_person.name)   AS best_requester_name,
         COALESCE(f.requester_email, requester_person.email) AS best_requester_email,
         assignee.id             AS local_assignee_id,
         COALESCE(f.responder_name, responder_person.name)   AS best_assignee_name,
         local_group.id          AS local_group_id,
         COALESCE(f.group_name, group_record.name)           AS best_group_name,
         workspace_record.name   AS workspace_name
       FROM fs_tickets f
       LEFT JOIN fs_people requester_person ON requester_person.fs_id = f.requester_fs_id
       LEFT JOIN fs_people responder_person ON responder_person.fs_id = f.responder_fs_id
       LEFT JOIN fs_records group_record
              ON group_record.kind = 'group' AND group_record.fs_id = f.group_fs_id
       LEFT JOIN fs_records workspace_record
              ON workspace_record.kind = 'workspace' AND workspace_record.fs_id = f.workspace_id
       LEFT JOIN users requester
              ON lower(requester.email) = lower(COALESCE(f.requester_email, requester_person.email))
       LEFT JOIN users assignee
              ON lower(assignee.email) = lower(responder_person.email)
       LEFT JOIN support_groups local_group
              ON lower(local_group.name) = lower(COALESCE(f.group_name, group_record.name))
     )
     INSERT INTO tickets (
       ticket_ref, title, description, priority, status, workspace,
       requester_id, created_by_user_id, assigned_to_user_id, assigned_group_id,
       category, sub_category, source, ticket_type,
       created_at, updated_at, due_at, closed_at, resolved_at, first_responded_at,
       sla_pct, origin, external_id,
       external_requester_name, external_requester_email,
       external_assignee_name, external_group_name
     )
     SELECT
       -- Temporary unique placeholder; rewritten to INC-/REQ-/CHG-<id> below.
       'TMP-FS-' || s.fs_id,
       COALESCE(
         NULLIF(
           trim(both FROM regexp_replace(
             COALESCE(s.subject, ''),
             '^\s*((re|fw|fwd)\s*:\s*)?\[ticket\s*#\d+\]\s*',
             '',
             'i'
           )),
           ''
         ),
         'Freshservice ticket ' || s.fs_id
       ),
       s.description_text,
       COALESCE($1::jsonb ->> s.priority_label, 'Medium'),
       COALESCE($2::jsonb ->> s.status_label, 'Closed'),
       COALESCE(NULLIF(TRIM(s.workspace_name), ''), 'IT'),
       s.local_requester_id,
       s.local_requester_id,
       s.local_assignee_id,
       s.local_group_id,
       s.category,
       s.sub_category,
       s.source_label,
       s.ticket_type,
       s.created_at,
       s.updated_at,
       s.due_by,
       s.closed_at,
       s.resolved_at,
       s.first_responded_at,
       CASE
         WHEN s.due_by IS NULL THEN NULL
         WHEN COALESCE(s.resolved_at, s.closed_at) IS NULL THEN
           CASE WHEN NOW() <= s.due_by THEN 100 ELSE 0 END
         WHEN COALESCE(s.resolved_at, s.closed_at) <= s.due_by THEN 100
         ELSE 0
       END,
       'freshservice',
       s.fs_id::TEXT,
       s.best_requester_name,
       s.best_requester_email,
       s.best_assignee_name,
       s.best_group_name
     FROM source s
     WHERE COALESCE(s.spam, FALSE) = FALSE
       AND COALESCE(s.deleted, FALSE) = FALSE
     ON CONFLICT (external_id) DO UPDATE SET
       title = EXCLUDED.title,
       description = COALESCE(EXCLUDED.description, tickets.description),
       priority = EXCLUDED.priority,
       status = EXCLUDED.status,
       workspace = EXCLUDED.workspace,
       requester_id = COALESCE(EXCLUDED.requester_id, tickets.requester_id),
       assigned_to_user_id = COALESCE(EXCLUDED.assigned_to_user_id, tickets.assigned_to_user_id),
       assigned_group_id = COALESCE(EXCLUDED.assigned_group_id, tickets.assigned_group_id),
       category = EXCLUDED.category,
       sub_category = EXCLUDED.sub_category,
       source = EXCLUDED.source,
       ticket_type = EXCLUDED.ticket_type,
       updated_at = EXCLUDED.updated_at,
       due_at = EXCLUDED.due_at,
       closed_at = EXCLUDED.closed_at,
       resolved_at = EXCLUDED.resolved_at,
       first_responded_at = EXCLUDED.first_responded_at,
       sla_pct = EXCLUDED.sla_pct,
       external_requester_name = COALESCE(EXCLUDED.external_requester_name, tickets.external_requester_name),
       external_requester_email = COALESCE(EXCLUDED.external_requester_email, tickets.external_requester_email),
       external_assignee_name = COALESCE(EXCLUDED.external_assignee_name, tickets.external_assignee_name),
       external_group_name = COALESCE(EXCLUDED.external_group_name, tickets.external_group_name)`,
    [JSON.stringify(TICKET_PRIORITY_MAP), JSON.stringify(TICKET_STATUS_MAP)]
  );

  log(`  tickets written: ${promoted.rowCount}`);
  bump("promoted_tickets", promoted.rowCount);

  // Assign the same INC-/REQ-/CHG-<padded id> format used by natively raised tickets.
  const renumbered = await pool.query(
    `UPDATE tickets
        SET ticket_ref =
          CASE
            WHEN lower(COALESCE(ticket_type, '')) LIKE '%change%' THEN 'CHG'
            WHEN lower(COALESCE(ticket_type, '')) LIKE '%request%'
              OR lower(COALESCE(ticket_type, '')) LIKE '%service%' THEN 'REQ'
            ELSE 'INC'
          END
          || '-' || lpad(id::text, 5, '0')
      WHERE origin = 'freshservice'
        AND (
          ticket_ref LIKE 'TMP-FS-%'
          OR ticket_ref LIKE 'FS-%'
          OR ticket_ref IS DISTINCT FROM (
            CASE
              WHEN lower(COALESCE(ticket_type, '')) LIKE '%change%' THEN 'CHG'
              WHEN lower(COALESCE(ticket_type, '')) LIKE '%request%'
                OR lower(COALESCE(ticket_type, '')) LIKE '%service%' THEN 'REQ'
              ELSE 'INC'
            END
            || '-' || lpad(id::text, 5, '0')
          )
        )`
  );

  log(`  ticket refs normalised: ${renumbered.rowCount}`);
  bump("renumbered_tickets", renumbered.rowCount);

  // Point the mirror back at the helpdesk row it produced.
  await pool.query(
    `UPDATE fs_tickets f
        SET local_ticket_id = t.id
       FROM tickets t
      WHERE t.external_id = f.fs_id::TEXT
        AND f.local_ticket_id IS DISTINCT FROM t.id`
  );

  const comments = await pool.query(
    `INSERT INTO ticket_comments (
       ticket_id, author_user_id, body, is_internal, created_at,
       external_id, author_name, author_email, origin
     )
     SELECT
       t.id,
       author.id,
       COALESCE(NULLIF(TRIM(c.body_text), ''), '(no message content captured)'),
       COALESCE(c.private, FALSE),
       c.created_at,
       'fs-' || c.fs_id,
       COALESCE(person.name, c.from_email),
       COALESCE(person.email, c.from_email),
       'freshservice'
     FROM fs_ticket_conversations c
     JOIN tickets t ON t.external_id = c.ticket_fs_id::TEXT
     LEFT JOIN fs_people person ON person.fs_id = c.user_fs_id
     LEFT JOIN users author ON lower(author.email) = lower(person.email)
     ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO UPDATE SET
       body = EXCLUDED.body,
       is_internal = EXCLUDED.is_internal,
       author_user_id = COALESCE(EXCLUDED.author_user_id, ticket_comments.author_user_id),
       author_name = COALESCE(EXCLUDED.author_name, ticket_comments.author_name),
       author_email = COALESCE(EXCLUDED.author_email, ticket_comments.author_email)`
  );

  log(`  replies written: ${comments.rowCount}`);
  bump("promoted_comments", comments.rowCount);

  const summary = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE origin = 'freshservice')                         AS imported,
       COUNT(*) FILTER (WHERE origin = 'freshservice' AND requester_id IS NULL) AS no_local_requester,
       COUNT(*) FILTER (WHERE origin = 'freshservice' AND status NOT IN ('Resolved','Closed')) AS still_active
       FROM tickets`
  );

  const row = summary.rows[0];
  log(
    `  imported ${row.imported} tickets (${row.still_active} still active, ${row.no_local_requester} without a local requester account)`
  );
}

// --- runner ---------------------------------------------------------------

const PHASES = {
  reference: syncReferenceData,
  people: syncPeople,
  tickets: syncTicketList,
  details: syncTicketDetails,
  files: syncAttachmentFiles,
  assets: syncAssets,
  link: linkLocalTickets,
  promote: promoteToTickets,
};

const ALL_PHASES = [
  "reference",
  "people",
  "tickets",
  "details",
  "files",
  "assets",
  "link",
  "promote",
];

async function main() {
  if (!fsapi.isConfigured()) {
    console.error(
      "FRESHSERVICE_API_KEY is missing. Set it in backend/.env before running the archive sync."
    );
    process.exitCode = 1;
    return;
  }

  const requested =
    options.phase === "all" ? ALL_PHASES : options.phase.split(",").map((p) => p.trim());

  for (const phase of requested) {
    if (!PHASES[phase]) {
      console.error(`Unknown phase "${phase}". Valid: ${ALL_PHASES.join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  const run = await pool.query(
    "INSERT INTO fs_sync_runs (mode, status) VALUES ($1, 'running') RETURNING id",
    [requested.join(",")]
  );
  const runId = run.rows[0].id;

  log(`Sync run #${runId} starting (${requested.join(", ")}) against ${fsapi.domain}`);

  try {
    for (const phase of requested) {
      if (phase === "details" && options.skipDetails) {
        log("Phase: ticket details skipped by flag");
        continue;
      }
      await PHASES[phase]();
    }

    const apiStats = fsapi.stats();
    await pool.query(
      `UPDATE fs_sync_runs
          SET status = 'completed', finished_at = NOW(), api_calls = $2, entities = $3
        WHERE id = $1`,
      [runId, apiStats.apiCalls, JSON.stringify(counters)]
    );

    log(`Sync run #${runId} completed. ${apiStats.apiCalls} API calls, ${apiStats.throttled} rate-limit pauses.`);
    log(`Totals: ${JSON.stringify(counters)}`);
  } catch (error) {
    await pool.query(
      `UPDATE fs_sync_runs
          SET status = 'failed', finished_at = NOW(), api_calls = $2,
              entities = $3, error = $4
        WHERE id = $1`,
      [runId, fsapi.stats().apiCalls, JSON.stringify(counters), error.message]
    );
    console.error("Sync failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
