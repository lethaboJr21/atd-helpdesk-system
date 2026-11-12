"use strict";

const { Pool } = require("pg");
const crypto = require("crypto");

const SOURCE_URL_NAME = "PRODUCTION_ANALYTICS_DATABASE_URL";
const LOCAL_URL_NAME = "LOCAL_ANALYTICS_DATABASE_URL";
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2000;
const OVERLAP_MINUTES = 5;

const FORBIDDEN_KEY_PATTERN = /(password|hash|secret|token|credential|private_key|client_secret|session|mfa|otp|reset_code|invite_code)/i;
const DIRECT_IDENTIFIER_PATTERN = /^(email|alternative_email|username|employee_number|phone|mobile|display_name|first_name|last_name|name)$/i;

const TABLES = [
  { source: "tickets", time: "updated_at", id: "id", fields: ["id","reference","subject","description","status","priority","category","request_type","incident_type","service_request_type","requester_id","assigned_to_user_id","assigned_group_id","department","source","created_at","updated_at","due_at","resolved_at","closed_at","reopened_at","reopen_count","repeat_issue","archived_at"] },
  { source: "users", time: "updated_at", id: "id", fields: ["id","role","status","approved","department","site","position_title","manager_user_id","account_type","account_purpose","authentication_mode","microsoft_account_enabled","created_at","updated_at","archived_at","deactivated_at"] },
  { source: "support_groups", time: "updated_at", id: "id", fields: ["id","name","description","department","status","created_at","updated_at"] },
  { source: "ticket_history", time: "created_at", id: "id", fields: ["id","ticket_id","actor_user_id","action","old_value","new_value","created_at"] },
  { source: "ticket_comments", time: "created_at", id: "id", fields: ["id","ticket_id","user_id","is_internal","source","created_at","updated_at"] },
  { source: "ticket_attachments", time: "created_at", id: "id", fields: ["id","ticket_id","uploaded_by","mime_type","size_bytes","created_at"] },
  { source: "notifications", time: "created_at", id: "id", fields: ["id","user_id","type","ticket_id","is_read","created_at"] },
  { source: "company_communication_campaigns", time: "updated_at", id: "id", fields: ["id","name","status","allow_comments","published_at","sent_at","created_at","updated_at"] },
  { source: "production_daily_summary_snapshot", time: "updated_at", id: "id", fields: null },
  { source: "production_output_snapshot", time: "updated_at", id: "id", fields: null },
  { source: "production_metrics_snapshot", time: "updated_at", id: "id", fields: null }
];

function requireValue(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function quoted(name) { return `"${String(name).replace(/"/g, '""')}"`; }
function digest(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function sanitizeObject(value) {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
    if (DIRECT_IDENTIFIER_PATTERN.test(key) && item != null) result[`${key}_pseudonym`] = digest(item);
    else result[key] = sanitizeObject(item);
  }
  return result;
}
function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const batchArg = process.argv.find(value => value.startsWith("--batch-size="));
  const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Number(batchArg?.split("=")[1] || DEFAULT_BATCH_SIZE)));
  return { dryRun: args.has("--dry-run"), full: args.has("--full"), batchSize };
}
async function tableExists(client, table) {
  const result = await client.query("SELECT to_regclass($1) AS name", [`public.${table}`]);
  return Boolean(result.rows[0]?.name);
}
async function availableColumns(client, table) {
  const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]);
  return new Set(result.rows.map(row => row.column_name));
}
async function ensureLocalSchema(client) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS analytics`);
  await client.query(`CREATE TABLE IF NOT EXISTS analytics.sync_runs(
    id bigserial PRIMARY KEY, run_key uuid NOT NULL UNIQUE, mode text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
    status text NOT NULL DEFAULT 'running', source_database text, source_transaction_read_only boolean,
    tables_attempted integer NOT NULL DEFAULT 0, rows_read bigint NOT NULL DEFAULT 0,
    rows_inserted bigint NOT NULL DEFAULT 0, rows_updated bigint NOT NULL DEFAULT 0,
    rows_skipped bigint NOT NULL DEFAULT 0, error_count integer NOT NULL DEFAULT 0,
    details jsonb NOT NULL DEFAULT '{}'::jsonb
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS analytics.sync_watermarks(
    source_table text PRIMARY KEY, watermark_at timestamptz, watermark_id text,
    last_successful_run uuid, updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS analytics.source_records(
    source_table text NOT NULL, source_id text NOT NULL, source_updated_at timestamptz,
    payload jsonb NOT NULL, payload_hash text NOT NULL, first_synced_at timestamptz NOT NULL DEFAULT now(),
    last_synced_at timestamptz NOT NULL DEFAULT now(), last_sync_run uuid NOT NULL,
    PRIMARY KEY(source_table,source_id)
  )`);
  await client.query(`CREATE INDEX IF NOT EXISTS ix_analytics_source_records_updated ON analytics.source_records(source_table,source_updated_at DESC)`);
}
async function verifySourceReadOnly(client) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const state = await client.query("SELECT current_database() AS database, current_setting('transaction_read_only')::boolean AS read_only");
  if (state.rows[0]?.read_only !== true) throw new Error("Production transaction is not read-only. Sync aborted.");
  return state.rows[0];
}
async function getWatermark(local, table, full) {
  if (full) return { at: null, id: null };
  const result = await local.query("SELECT watermark_at,watermark_id FROM analytics.sync_watermarks WHERE source_table=$1", [table]);
  return { at: result.rows[0]?.watermark_at || null, id: result.rows[0]?.watermark_id || null };
}
async function syncTable(source, local, config, runKey, options) {
  if (!await tableExists(source, config.source)) return { table: config.source, skipped: true, reason: "source table absent", read: 0, inserted: 0, updated: 0 };
  const columns = await availableColumns(source, config.source);
  if (!columns.has(config.id)) return { table: config.source, skipped: true, reason: `missing ${config.id}`, read: 0, inserted: 0, updated: 0 };
  const timeColumn = columns.has(config.time) ? config.time : columns.has("created_at") ? "created_at" : null;
  const requested = config.fields ? config.fields.filter(field => columns.has(field) && !FORBIDDEN_KEY_PATTERN.test(field)) : [...columns].filter(field => !FORBIDDEN_KEY_PATTERN.test(field));
  if (!requested.includes(config.id)) requested.unshift(config.id);
  const watermark = await getWatermark(local, config.source, options.full);
  let cursorAt = watermark.at ? new Date(new Date(watermark.at).getTime() - OVERLAP_MINUTES * 60000) : null;
  let cursorId = watermark.id || "";
  let read = 0, inserted = 0, updated = 0, latestAt = watermark.at, latestId = watermark.id;
  while (true) {
    const select = requested.map(quoted).join(",");
    const where = timeColumn && cursorAt ? `WHERE (${quoted(timeColumn)},${quoted(config.id)}::text) > ($1::timestamptz,$2::text)` : "";
    const params = where ? [cursorAt, cursorId, options.batchSize] : [options.batchSize];
    const limitParam = where ? "$3" : "$1";
    const order = timeColumn ? `${quoted(timeColumn)} ASC,${quoted(config.id)}::text ASC` : `${quoted(config.id)}::text ASC`;
    const result = await source.query(`SELECT ${select} FROM public.${quoted(config.source)} ${where} ORDER BY ${order} LIMIT ${limitParam}`, params);
    if (!result.rows.length) break;
    read += result.rows.length;
    for (const raw of result.rows) {
      const payload = sanitizeObject(raw);
      const sourceId = String(raw[config.id]);
      const sourceUpdatedAt = timeColumn ? raw[timeColumn] : null;
      const payloadText = JSON.stringify(payload);
      const payloadHash = digest(payloadText);
      if (!options.dryRun) {
        const merge = await local.query(`INSERT INTO analytics.source_records(source_table,source_id,source_updated_at,payload,payload_hash,last_sync_run)
          VALUES($1,$2,$3,$4::jsonb,$5,$6::uuid)
          ON CONFLICT(source_table,source_id) DO UPDATE SET source_updated_at=EXCLUDED.source_updated_at,payload=EXCLUDED.payload,
          payload_hash=EXCLUDED.payload_hash,last_synced_at=now(),last_sync_run=EXCLUDED.last_sync_run
          WHERE analytics.source_records.payload_hash IS DISTINCT FROM EXCLUDED.payload_hash
          RETURNING (xmax=0) AS inserted`, [config.source,sourceId,sourceUpdatedAt,payloadText,payloadHash,runKey]);
        if (merge.rowCount) merge.rows[0].inserted ? inserted++ : updated++;
      }
      latestAt = sourceUpdatedAt || latestAt;
      latestId = sourceId;
    }
    if (timeColumn) { cursorAt = latestAt; cursorId = latestId; }
    else break;
    if (result.rows.length < options.batchSize) break;
  }
  if (!options.dryRun && latestId != null) await local.query(`INSERT INTO analytics.sync_watermarks(source_table,watermark_at,watermark_id,last_successful_run)
    VALUES($1,$2,$3,$4::uuid) ON CONFLICT(source_table) DO UPDATE SET watermark_at=EXCLUDED.watermark_at,watermark_id=EXCLUDED.watermark_id,
    last_successful_run=EXCLUDED.last_successful_run,updated_at=now()`, [config.source,latestAt,latestId,runKey]);
  return { table: config.source, skipped: false, read, inserted, updated, unchanged: read-inserted-updated, watermarkAt: latestAt, watermarkId: latestId };
}
async function main() {
  const options = parseArgs();
  const sourceUrl = requireValue(SOURCE_URL_NAME);
  const localUrl = requireValue(LOCAL_URL_NAME);
  if (sourceUrl === localUrl) throw new Error("Production and local analytics URLs must be different.");
  const source = new Pool({ connectionString: sourceUrl, application_name: "atd-helpdesk-analytics-source-readonly", max: 1, statement_timeout: 120000, query_timeout: 120000 });
  const local = new Pool({ connectionString: localUrl, application_name: "atd-helpdesk-local-analytics-writer", max: 2 });
  const runKey = crypto.randomUUID();
  let runId = null;
  const details = [];
  try {
    await ensureLocalSchema(local);
    const sourceState = await verifySourceReadOnly(source);
    const run = await local.query(`INSERT INTO analytics.sync_runs(run_key,mode,source_database,source_transaction_read_only) VALUES($1::uuid,$2,$3,$4) RETURNING id`, [runKey,options.dryRun?"dry-run":options.full?"full":"incremental",sourceState.database,sourceState.read_only]);
    runId = run.rows[0].id;
    for (const table of TABLES) details.push(await syncTable(source,local,table,runKey,options));
    await source.query("COMMIT");
    const totals = details.reduce((a,r)=>({read:a.read+(r.read||0),inserted:a.inserted+(r.inserted||0),updated:a.updated+(r.updated||0),skipped:a.skipped+(r.skipped?1:0)}),{read:0,inserted:0,updated:0,skipped:0});
    await local.query(`UPDATE analytics.sync_runs SET completed_at=now(),status='completed',tables_attempted=$2,rows_read=$3,rows_inserted=$4,rows_updated=$5,rows_skipped=$6,details=$7::jsonb WHERE id=$1`, [runId,TABLES.length,totals.read,totals.inserted,totals.updated,totals.skipped,JSON.stringify(details)]);
    console.log(JSON.stringify({ status:"completed", runKey, mode:options.dryRun?"dry-run":options.full?"full":"incremental", totals, tables:details },null,2));
  } catch (error) {
    try { await source.query("ROLLBACK"); } catch {}
    if (runId) { try { await local.query(`UPDATE analytics.sync_runs SET completed_at=now(),status='failed',error_count=1,details=$2::jsonb WHERE id=$1`,[runId,JSON.stringify({message:error.message,completedTables:details})]); } catch {} }
    throw error;
  } finally { await Promise.allSettled([source.end(),local.end()]); }
}
main().catch(error=>{ console.error(`Analytics sync failed: ${error.message}`); process.exitCode=1; });
