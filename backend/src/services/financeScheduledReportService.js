"use strict";
const cron = require("node-cron");
const pool = require("../db/pool");
const config = require("../config");
const financeAccess = require("../middleware/financeAccess");
const financeEnterpriseReportingService = require("./financeEnterpriseReportingService");
const { sendMailSafe } = require("./email");

const OUTPUT_FORMATS = new Set(["pdf", "xlsx", "csv"]);
const RETRY_BACKOFFS_MS = [1000, 2000, 4000];

function fail(status, code, message) { return Object.assign(new Error(message), { status, code }); }
async function queryTolerant(sql, params) {
  try { const result = await pool.query(sql, params); return result.rows; }
  catch (error) { if (["42P01", "42703"].includes(error.code)) return []; throw error; }
}
async function recordGovernance(recordType, recordId, action, actorUserId, reason, detail) {
  try { await pool.query(`INSERT INTO finance_governance_actions(record_type, record_id, action, actor_user_id, reason, detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [recordType, recordId, action, actorUserId, reason || null, JSON.stringify(detail || {})]); }
  catch (error) { if (!["42P01", "42703"].includes(error.code)) console.warn("Scheduled report governance audit failed:", error.message); }
}
function isValidEmail(value) { return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
async function userEmail(userId) {
  const rows = await queryTolerant(`SELECT email FROM users WHERE id=$1`, [Number(userId)]);
  return rows.length ? String(rows[0].email || "").trim().toLowerCase() : null;
}

const DOW_NAMES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTH_NAMES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseCronField(field, min, max, nameMap) {
  const values = new Set();
  for (const part of String(field).split(",")) {
    const segments = part.split("/");
    const rangePart = segments[0];
    const step = segments.length > 1 ? Number(segments[1]) : 1;
    if (!Number.isFinite(step) || step < 1) return null;
    let lo, hi;
    if (rangePart === "*") { lo = min; hi = max; }
    else if (rangePart.includes("-")) { const bounds = rangePart.split("-"); lo = resolveCronToken(bounds[0], nameMap); hi = resolveCronToken(bounds[1], nameMap); }
    else { lo = resolveCronToken(rangePart, nameMap); hi = segments.length > 1 ? max : lo; }
    if (lo === null || hi === null || lo < min || hi > max || lo > hi) return null;
    for (let value = lo; value <= hi; value += step) values.add(value);
  }
  return values;
}
function resolveCronToken(token, nameMap) {
  if (nameMap && Object.prototype.hasOwnProperty.call(nameMap, String(token).toLowerCase())) return nameMap[String(token).toLowerCase()];
  const value = Number(token);
  return Number.isFinite(value) ? value : null;
}
function cronMatches(expression, date) {
  const fields = String(expression).trim().split(/\s+/);
  if (fields.length < 5 || fields.length > 6) return false;
  const minute = parseCronField(fields[0], 0, 59);
  const hour = parseCronField(fields[1], 0, 23);
  const dayOfMonth = parseCronField(fields[2], 1, 31);
  const month = parseCronField(fields[3], 1, 12, MONTH_NAMES);
  const dayOfWeek = parseCronField(fields[4], 0, 7, DOW_NAMES);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return false;
  if (dayOfWeek.has(7)) dayOfWeek.add(0);
  const domRestricted = fields[2] !== "*";
  const dowRestricted = fields[4] !== "*";
  const matchesDom = dayOfMonth.has(date.getDate());
  const matchesDow = dayOfWeek.has(date.getDay());
  return minute.has(date.getMinutes()) && hour.has(date.getHours()) && month.has(date.getMonth() + 1) && (domRestricted && dowRestricted ? matchesDom || matchesDow : matchesDom && matchesDow);
}
function isValidCronExpression(expression) {
  if (typeof cron.validate === "function") { try { return Boolean(cron.validate(expression)); } catch (error) { return false; } }
  return cronMatches(expression, new Date());
}

async function assertDistributionList(distributionListId) {
  const rows = await queryTolerant(`SELECT id, active FROM finance_distribution_lists WHERE id=$1`, [Number(distributionListId)]);
  if (!rows.length) throw fail(404, "DISTRIBUTION_LIST_NOT_FOUND", "Distribution list not found.");
  if (!rows[0].active) throw fail(404, "DISTRIBUTION_LIST_NOT_FOUND", "Distribution list is no longer active.");
  return rows[0];
}

async function createScheduledReport({ name, reportType, parameters, scheduleCron, outputFormat = "pdf", distributionListId, confidentialityLevel = "Internal", createdBy }) {
  if (!name || !String(name).trim() || String(name).length > 120) throw fail(400, "MISSING_REQUIRED_PARAMETER", "A report name of up to 120 characters is required.");
  if (!financeEnterpriseReportingService.REPORT_TYPES.has(reportType)) throw fail(400, "INVALID_REPORT_TYPE", "Unknown report type.");
  if (!isValidCronExpression(scheduleCron)) throw fail(400, "INVALID_CRON_EXPRESSION", "Provide a valid 5-field cron expression.");
  if (!OUTPUT_FORMATS.has(outputFormat)) throw fail(400, "UNSUPPORTED_FORMAT", "outputFormat must be pdf, xlsx, or csv.");
  if (!Number.isFinite(Number(distributionListId))) throw fail(400, "MISSING_REQUIRED_PARAMETER", "distributionListId is required.");
  if (!Number.isFinite(Number(createdBy))) throw fail(400, "MISSING_REQUIRED_PARAMETER", "createdBy is required.");
  const params = parameters && typeof parameters === "object" && !Array.isArray(parameters) ? parameters : {};
  if (reportType === "performance_grading" && (params.employeeUserId === undefined || params.employeeUserId === null)) throw fail(400, "MISSING_REQUIRED_PARAMETER", "parameters.employeeUserId is required for the performance grading report.");
  await assertDistributionList(distributionListId);
  try {
    const result = await pool.query(`INSERT INTO finance_scheduled_reports(name, report_type, parameters, schedule_cron, output_format, distribution_list_id, confidentiality_level, created_by) VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8) RETURNING *`, [String(name).trim(), reportType, JSON.stringify(params), scheduleCron, outputFormat, Number(distributionListId), String(confidentialityLevel), Number(createdBy)]);
    await recordGovernance("finance_scheduled_report", result.rows[0].id, "created", Number(createdBy), null, { reportType, scheduleCron, outputFormat, distributionListId: Number(distributionListId) });
    return result.rows[0];
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) throw fail(503, "FINANCE_ADVANCED_MANAGEMENT_NOT_MIGRATED", "Run the finance advanced management migration first.");
    throw error;
  }
}

async function updateScheduledReport(id, patch = {}, updatedBy) {
  const existing = await queryTolerant(`SELECT * FROM finance_scheduled_reports WHERE id=$1`, [Number(id)]);
  if (!existing.length) throw fail(404, "SCHEDULED_REPORT_NOT_FOUND", "Scheduled report not found.");
  const sets = [];
  const values = [];
  const addSet = (column, value) => { values.push(value); sets.push(`${column}=$${values.length}`); };
  if (patch.name !== undefined) { if (!String(patch.name).trim() || String(patch.name).length > 120) throw fail(400, "MISSING_REQUIRED_PARAMETER", "A report name of up to 120 characters is required."); addSet("name", String(patch.name).trim()); }
  if (patch.parameters !== undefined) { const params = patch.parameters && typeof patch.parameters === "object" && !Array.isArray(patch.parameters) ? patch.parameters : {}; values.push(JSON.stringify(params)); sets.push(`parameters=$${values.length}::jsonb`); }
  if (patch.scheduleCron !== undefined) { if (!isValidCronExpression(patch.scheduleCron)) throw fail(400, "INVALID_CRON_EXPRESSION", "Provide a valid 5-field cron expression."); addSet("schedule_cron", patch.scheduleCron); }
  if (patch.outputFormat !== undefined) { if (!OUTPUT_FORMATS.has(patch.outputFormat)) throw fail(400, "UNSUPPORTED_FORMAT", "outputFormat must be pdf, xlsx, or csv."); addSet("output_format", patch.outputFormat); }
  if (patch.distributionListId !== undefined) { await assertDistributionList(patch.distributionListId); addSet("distribution_list_id", Number(patch.distributionListId)); }
  if (patch.confidentialityLevel !== undefined) addSet("confidentiality_level", String(patch.confidentialityLevel));
  if (patch.active !== undefined) addSet("active", Boolean(patch.active));
  if (!sets.length) return existing[0];
  try {
    const result = await pool.query(`UPDATE finance_scheduled_reports SET ${sets.join(", ")} WHERE id=$${values.length + 1} RETURNING *`, [...values, Number(id)]);
    await recordGovernance("finance_scheduled_report", Number(id), "updated", Number(updatedBy), null, { fields: sets.map(set => set.split("=")[0]) });
    return result.rows[0];
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) throw fail(503, "FINANCE_ADVANCED_MANAGEMENT_NOT_MIGRATED", "Run the finance advanced management migration first.");
    throw error;
  }
}

async function deactivateScheduledReport(id, deactivatedBy) {
  try {
    const result = await pool.query(`UPDATE finance_scheduled_reports SET active=FALSE WHERE id=$1 RETURNING *`, [Number(id)]);
    if (!result.rowCount) throw fail(404, "SCHEDULED_REPORT_NOT_FOUND", "Scheduled report not found.");
    await recordGovernance("finance_scheduled_report", Number(id), "deactivated", Number(deactivatedBy), "Scheduled report deactivated; pending executions cancelled.", {});
    return result.rows[0];
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) throw fail(503, "FINANCE_ADVANCED_MANAGEMENT_NOT_MIGRATED", "Run the finance advanced management migration first.");
    throw error;
  }
}

async function getScheduledReports({ activeOnly, createdBy } = {}) {
  return queryTolerant(`SELECT * FROM finance_scheduled_reports WHERE ($1::boolean IS NULL OR active=$1) AND ($2::bigint IS NULL OR created_by=$2) ORDER BY created_at DESC`, [activeOnly === undefined ? null : Boolean(activeOnly), createdBy === undefined ? null : Number(createdBy)]);
}

function normaliseMembers(members) {
  if (!Array.isArray(members)) throw fail(400, "INVALID_DISTRIBUTION_MEMBER", "members must be an array of email addresses.");
  const normalised = [];
  for (const member of members) {
    if (!isValidEmail(member)) throw fail(400, "INVALID_DISTRIBUTION_MEMBER", "Distribution list members must be valid email addresses.");
    normalised.push(String(member).trim().toLowerCase());
  }
  return Array.from(new Set(normalised));
}

async function createDistributionList({ name, members, confidentialityLevel = "Internal", managedBy }) {
  if (!name || !String(name).trim() || String(name).length > 120) throw fail(400, "MISSING_REQUIRED_PARAMETER", "A list name of up to 120 characters is required.");
  if (!Number.isFinite(Number(managedBy))) throw fail(400, "MISSING_REQUIRED_PARAMETER", "managedBy is required.");
  const normalised = normaliseMembers(members);
  const managerEmail = await userEmail(managedBy);
  if (managerEmail && normalised.includes(managerEmail)) throw fail(403, "SELF_DISTRIBUTION_ADD_PROHIBITED", "Users cannot add themselves to a distribution list.");
  try {
    const result = await pool.query(`INSERT INTO finance_distribution_lists(name, members, confidentiality_level, managed_by) VALUES($1,$2::text[],$3,$4) RETURNING *`, [String(name).trim(), normalised, String(confidentialityLevel), Number(managedBy)]);
    await recordGovernance("finance_distribution_list", result.rows[0].id, "created", Number(managedBy), null, { members: normalised, confidentialityLevel: String(confidentialityLevel) });
    return result.rows[0];
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) throw fail(503, "FINANCE_ADVANCED_MANAGEMENT_NOT_MIGRATED", "Run the finance advanced management migration first.");
    throw error;
  }
}

async function updateDistributionList(id, patch = {}, updatedBy) {
  const existing = await queryTolerant(`SELECT * FROM finance_distribution_lists WHERE id=$1`, [Number(id)]);
  if (!existing.length) throw fail(404, "DISTRIBUTION_LIST_NOT_FOUND", "Distribution list not found.");
  const sets = [];
  const values = [];
  if (patch.name !== undefined) { if (!String(patch.name).trim() || String(patch.name).length > 120) throw fail(400, "MISSING_REQUIRED_PARAMETER", "A list name of up to 120 characters is required."); values.push(String(patch.name).trim()); sets.push(`name=$${values.length}`); }
  if (patch.members !== undefined) {
    const normalised = normaliseMembers(patch.members);
    const updaterEmail = await userEmail(updatedBy);
    if (updaterEmail && normalised.includes(updaterEmail)) throw fail(403, "SELF_DISTRIBUTION_ADD_PROHIBITED", "Users cannot add themselves to a distribution list.");
    values.push(normalised); sets.push(`members=$${values.length}::text[]`);
  }
  if (patch.confidentialityLevel !== undefined) { values.push(String(patch.confidentialityLevel)); sets.push(`confidentiality_level=$${values.length}`); }
  if (patch.active !== undefined) { values.push(Boolean(patch.active)); sets.push(`active=$${values.length}`); }
  if (!sets.length) return existing[0];
  try {
    const result = await pool.query(`UPDATE finance_distribution_lists SET ${sets.join(", ")} WHERE id=$${values.length + 1} RETURNING *`, [...values, Number(id)]);
    await recordGovernance("finance_distribution_list", Number(id), "updated", Number(updatedBy), null, { fields: sets.map(set => set.split("=")[0]) });
    return result.rows[0];
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) throw fail(503, "FINANCE_ADVANCED_MANAGEMENT_NOT_MIGRATED", "Run the finance advanced management migration first.");
    throw error;
  }
}

async function getDistributionLists({ managedBy } = {}) {
  return queryTolerant(`SELECT * FROM finance_distribution_lists WHERE ($1::bigint IS NULL OR managed_by=$1) ORDER BY created_at DESC`, [managedBy === undefined ? null : Number(managedBy)]);
}

async function resolveEligibleRecipients(report) {
  const members = Array.isArray(report.members) ? report.members : [];
  if (!members.length) return { recipients: [], skipped: [], empty: true };
  const recipients = [];
  const skipped = [];
  for (const email of members) {
    const rows = await queryTolerant(`SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND archived_at IS NULL`, [String(email)]);
    if (!rows.length) { skipped.push({ email: String(email), reason: "RECIPIENT_CLEARANCE_INSUFFICIENT" }); continue; }
    const userId = Number(rows[0].id);
    let allowed = false;
    try { const context = await financeAccess.resolve({ user: { id: userId } }); allowed = financeAccess.confidentialityAllowed(context, report.confidentiality_level); }
    catch (error) { allowed = false; }
    if (!allowed) { skipped.push({ email: String(email), reason: "RECIPIENT_CLEARANCE_INSUFFICIENT" }); continue; }
    recipients.push({ userId, email: String(email) });
  }
  return { recipients, skipped, empty: false };
}

async function withRetries(factory, maxRetries, backoffs) {
  let attempt = 0;
  while (true) {
    try { return await factory(); }
    catch (error) {
      if (attempt >= maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, backoffs[attempt] !== undefined ? backoffs[attempt] : backoffs[backoffs.length - 1]));
      attempt += 1;
    }
  }
}

async function markRun(reportId, status) {
  try { await pool.query(`UPDATE finance_scheduled_reports SET last_run_at=NOW(), last_run_status=$2 WHERE id=$1`, [Number(reportId), status]); }
  catch (error) { if (!["42P01", "42703"].includes(error.code)) console.warn("Scheduled report run status update failed:", error.message); }
}
async function reportStillActive(reportId) {
  const rows = await queryTolerant(`SELECT active FROM finance_scheduled_reports WHERE id=$1`, [Number(reportId)]);
  return rows.length ? Boolean(rows[0].active) : false;
}
async function logDelivery(recipientUserId, reportId, delivered, status) {
  try { await pool.query(`INSERT INTO finance_email_delivery_log(recipient_user_id, email_type, task_id, delivered, status) VALUES($1,'scheduled_report',$2,$3,$4)`, [Number(recipientUserId), Number(reportId), Boolean(delivered), String(status)]); }
  catch (error) { if (!["42P01", "42703"].includes(error.code)) console.warn("Scheduled report delivery audit failed:", error.message); }
}
async function alertOwner(report, subject, text) {
  const rows = await queryTolerant(`SELECT email FROM users WHERE id=$1`, [Number(report.created_by)]);
  if (!rows.length || !rows[0].email) return;
  try { await sendMailSafe({ to: rows[0].email, category: "scheduled_reports", subject, text }); }
  catch (error) { console.warn("Scheduled report owner alert failed:", error.message); }
}

async function executeScheduledReport(reportId) {
  const rows = await queryTolerant(`SELECT r.*, l.name list_name, l.members, l.active list_active FROM finance_scheduled_reports r JOIN finance_distribution_lists l ON l.id=r.distribution_list_id WHERE r.id=$1`, [Number(reportId)]);
  if (!rows.length) throw fail(404, "SCHEDULED_REPORT_NOT_FOUND", "Scheduled report not found.");
  const report = rows[0];
  if (!report.active) return { status: "skipped", reason: "REPORT_INACTIVE" };
  if (!report.list_active) throw fail(400, "INVALID_REPORT_PARAMETER", "The distribution list referenced by this report is no longer active.");
  const { recipients, skipped, empty } = await resolveEligibleRecipients(report);
  const warnings = [];
  if (empty) warnings.push("EMPTY_DISTRIBUTION_LIST");
  if (skipped.length) warnings.push("RECIPIENT_CLEARANCE_INSUFFICIENT");
  const maxRetries = (config.financeAdvanced && config.financeAdvanced.scheduledReportRetryMax) || 3;
  try {
    const generated = await withRetries(() => financeEnterpriseReportingService.generateReport({
      reportType: report.report_type,
      parameters: Object.assign({}, report.parameters || {}, { confidentialityLevel: report.confidentiality_level }),
      outputFormat: report.output_format,
      requestingUser: { id: Number(report.created_by) }
    }), maxRetries, RETRY_BACKOFFS_MS);
    if (empty) await alertOwner(report, `Scheduled report "${report.name}" has an empty distribution list`, `The scheduled report "${report.name}" was generated but its distribution list is empty. Add recipients to receive future distributions.`);
    let delivered = 0;
    for (const recipient of recipients) {
      if (!(await reportStillActive(reportId))) break;
      try {
        const result = await sendMailSafe({ to: recipient.email, category: "scheduled_reports", subject: `Finance report: ${report.name}`, text: `The scheduled report "${report.name}" for period ${new Date().toISOString().slice(0, 7)} is attached.`, attachments: [{ filename: generated.filename, content: generated.buffer, contentType: generated.mimeType }] });
        if (result && result.sent) delivered += 1;
        await logDelivery(recipient.userId, reportId, Boolean(result && result.sent), result && result.sent ? "sent" : String((result && result.reason) || "skipped"));
      } catch (error) {
        await logDelivery(recipient.userId, reportId, false, "failed");
      }
    }
    await markRun(reportId, "success");
    return { status: "success", delivered, recipients: recipients.length, skipped: skipped.length, warnings };
  } catch (error) {
    await markRun(reportId, "failed");
    await alertOwner(report, `Scheduled report "${report.name}" failed`, `The scheduled report "${report.name}" failed after ${maxRetries} retries. Error: ${error.message}`);
    return { status: "failed", error: error.message, warnings };
  }
}

let schedulerTask = null;
const firedExecutions = new Map();
async function runSchedulerTick() {
  const rows = await queryTolerant(`SELECT id, schedule_cron FROM finance_scheduled_reports WHERE active=TRUE`, []);
  const now = new Date();
  const minuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
  for (const row of rows) {
    const expression = String(row.schedule_cron || "");
    if (!isValidCronExpression(expression) || !cronMatches(expression, now)) continue;
    const fireKey = `${row.id}:${minuteKey}`;
    if (firedExecutions.has(fireKey)) continue;
    firedExecutions.set(fireKey, Date.now());
    executeScheduledReport(Number(row.id)).catch(error => console.warn("Scheduled report execution failed:", error.message));
  }
  if (firedExecutions.size > 1000) {
    const cutoff = Date.now() - 3600000;
    for (const entry of firedExecutions) { if (entry[1] < cutoff) firedExecutions.delete(entry[0]); }
  }
}
function startScheduledReportScheduler() {
  if (schedulerTask) return schedulerTask;
  const interval = (config.financeAdvanced && config.financeAdvanced.scheduledReportCheckIntervalCron) || "*/5 * * * *";
  schedulerTask = cron.schedule(interval, () => { runSchedulerTick().catch(error => console.warn("Scheduled report scheduler tick failed:", error.message)); });
  return schedulerTask;
}

module.exports = { createScheduledReport, updateScheduledReport, deactivateScheduledReport, getScheduledReports, createDistributionList, updateDistributionList, getDistributionLists, executeScheduledReport, startScheduledReportScheduler, cronMatches, isValidCronExpression };