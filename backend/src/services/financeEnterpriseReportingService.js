"use strict";
const pool = require("../db/pool");
const financeAccess = require("../middleware/financeAccess");
const financeReportGenerator = require("./financeReportGenerator");
const financePeriodService = require("./financePeriodService");

const REPORT_TYPES = new Set(["kpi_performance", "workflow_throughput", "grading_distribution", "task_completion", "feedback_summary", "it_service_satisfaction", "performance_grading"]);
const REPORT_TITLES = { kpi_performance: "KPI Performance Report", workflow_throughput: "Workflow Throughput Report", grading_distribution: "Grading Distribution Report", task_completion: "Task Completion Report", feedback_summary: "Feedback Summary Report", it_service_satisfaction: "IT Service Satisfaction Report", performance_grading: "Performance Grading Report" };
const ROLLUP_DIMENSIONS = new Set(["department", "office", "finance_function", "employee_group"]);
const TREND_METRICS = new Set(["avg_kpi_score", "task_completion_rate", "overdue_count", "nps_score", "feedback_avg_rating"]);
const DEFAULT_THRESHOLDS = { excellent: 90, meets: 80, below: 60 };
const SECTION_TIMEOUT_MS = 15000;
const BAND_NAMES = ["Excellent", "Meets Expectations", "Below Expectations", "Unsatisfactory"];
const QUALITATIVE_ASSESSMENTS = {
  "Excellent": "Consistently exceeds expectations with sustained high-quality delivery.",
  "Meets Expectations": "Meets the expected performance standards for the period.",
  "Below Expectations": "Performance is below the expected standard; support and a corrective plan are recommended.",
  "Unsatisfactory": "Performance is significantly below standard; immediate corrective action is required."
};

function fail(status, code, message) { return Object.assign(new Error(message), { status, code }); }
function round1(value) { return Math.round(value * 10) / 10; }
function average(list) { return list.reduce((sum, value) => sum + value, 0) / list.length; }

async function queryTolerant(sql, params) {
  try { const result = await pool.query(sql, params); return result.rows; }
  catch (error) { if (["42P01", "42703"].includes(error.code)) return []; throw error; }
}

const CADENCE_SHAPE = /^\d{4}(-Q\d+|-H\d+)?$/;
function isMonthlyPeriodKey(value) { return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
function isValidPeriodKey(value) {
  if (isMonthlyPeriodKey(value)) return true;
  if (typeof value === "string" && CADENCE_SHAPE.test(value.trim())) {
    try { financePeriodService.resolvePeriodKey(value); return true; } catch (error) { return false; }
  }
  return false;
}
function currentPeriodKey() { return new Date().toISOString().slice(0, 7); }
function normalizePeriod(parameters) {
  const source = parameters || {};
  if (isMonthlyPeriodKey(source.periodKey)) return { from: source.periodKey, to: source.periodKey };
  if (source.periodKey && CADENCE_SHAPE.test(String(source.periodKey).trim())) {
    const resolved = financePeriodService.resolvePeriodKey(source.periodKey);
    return { from: resolved.fromMonth, to: resolved.toMonth };
  }
  if (source.periodRange && isMonthlyPeriodKey(source.periodRange.from) && isMonthlyPeriodKey(source.periodRange.to)) {
    if (source.periodRange.from > source.periodRange.to) throw fail(400, "INVALID_PERIOD", "periodRange.from must not exceed periodRange.to.");
    return { from: source.periodRange.from, to: source.periodRange.to };
  }
  if (source.periodKey || source.periodRange) throw fail(400, "INVALID_PERIOD", "Provide periodKey or periodRange as YYYY-MM.");
  const current = currentPeriodKey();
  return { from: current, to: current };
}
function monthShift(periodKey, delta) {
  const [year, month] = periodKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = total - shiftedYear * 12 + 1;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}`;
}
function enumeratePeriods(from, to) {
  const periods = [];
  let cursor = from;
  while (cursor <= to) {
    periods.push(cursor);
    if (periods.length > 24) throw fail(400, "INVALID_PERIOD", "Period range too wide (max 24 periods).");
    cursor = monthShift(cursor, 1);
  }
  return periods;
}

async function resolveContext(requestingUser) {
  if (requestingUser.financeAccess && requestingUser.financeAccess.maxConfidentiality !== undefined) return requestingUser.financeAccess;
  return financeAccess.resolve({ user: { id: Number(requestingUser.id) } });
}
async function requesterProfile(requestingUser) {
  const id = Number(requestingUser.id);
  if (requestingUser.name !== undefined && requestingUser.department !== undefined && requestingUser.role !== undefined) return { id, name: requestingUser.name, department: requestingUser.department, role: requestingUser.role };
  const rows = await queryTolerant(`SELECT name, department, role FROM users WHERE id=$1`, [id]);
  if (!rows.length) throw fail(403, "REPORT_REQUESTER_REQUIRED", "Requesting user not found.");
  return { id, name: rows[0].name, department: rows[0].department, role: rows[0].role };
}
async function computeAllowedUserIds(context, profile) {
  const level = context.accessLevel;
  if (profile.role === "superadmin" || ["workspace_manager", "security_admin", "auditor"].includes(level)) return null;
  if (["director", "executive"].includes(level) && profile.department) {
    const rows = await queryTolerant(`SELECT id FROM users WHERE LOWER(department)=LOWER($1) AND archived_at IS NULL`, [profile.department]);
    if (rows.length) return Array.from(new Set(rows.map(row => Number(row.id))));
  }
  return Array.from(new Set([profile.id, ...(context.reportingScope || []).map(Number)].filter(id => Number.isFinite(id))));
}
async function resolveScope(requestingUser) {
  if (!requestingUser || !Number.isFinite(Number(requestingUser.id))) throw fail(403, "REPORT_REQUESTER_REQUIRED", "A requesting user is required.");
  const context = await resolveContext(requestingUser);
  const profile = await requesterProfile(requestingUser);
  const scopeIds = await computeAllowedUserIds(context, profile);
  return { context, profile, scopeIds };
}
function scopeClause(scopeIds, column, startIndex) {
  if (scopeIds === null) return { sql: "TRUE", params: [] };
  return { sql: `${column}=ANY($${startIndex}::bigint[])`, params: [scopeIds] };
}
async function assertTargetScope(scopeIds, parameters) {
  if (scopeIds === null) return {};
  if (parameters.employeeUserId !== undefined && parameters.employeeUserId !== null) {
    if (!scopeIds.includes(Number(parameters.employeeUserId))) throw fail(403, "REPORT_SCOPE_DENIED", "The requested employee is outside the authorised reporting scope.");
    return {};
  }
  if (Array.isArray(parameters.employeeUserIds) && parameters.employeeUserIds.length) {
    if (parameters.employeeUserIds.some(id => !scopeIds.includes(Number(id)))) throw fail(403, "REPORT_SCOPE_DENIED", "One or more requested employees are outside the authorised reporting scope.");
    return {};
  }
  if (parameters.department) {
    const rows = await queryTolerant(`SELECT id FROM users WHERE LOWER(department)=LOWER($1) AND archived_at IS NULL`, [parameters.department]);
    if (!rows.length) return { emptyTarget: true };
    if (!rows.some(row => scopeIds.includes(Number(row.id)))) throw fail(403, "REPORT_SCOPE_DENIED", "The requested department is outside the authorised reporting scope.");
  }
  if (parameters.officeCode) {
    const rows = await queryTolerant(`SELECT user_id FROM finance_employee_responsibilities WHERE office_code=$1 AND active=TRUE`, [parameters.officeCode]);
    if (!rows.length) return { emptyTarget: true };
    if (!rows.some(row => scopeIds.includes(Number(row.user_id)))) throw fail(403, "REPORT_SCOPE_DENIED", "The requested office is outside the authorised reporting scope.");
  }
  if (parameters.financeFunction) {
    const rows = await queryTolerant(`SELECT user_id FROM finance_employee_responsibilities WHERE finance_function=$1 AND active=TRUE`, [parameters.financeFunction]);
    if (!rows.length) return { emptyTarget: true };
    if (!rows.some(row => scopeIds.includes(Number(row.user_id)))) throw fail(403, "REPORT_SCOPE_DENIED", "The requested finance function is outside the authorised reporting scope.");
  }
  return {};
}

async function userDimensionMap(userIds) {
  const scope = scopeClause(userIds === null ? null : userIds, "u.id", 1);
  const rows = await queryTolerant(`SELECT DISTINCT ON (u.id) u.id, u.name, u.department, u.job_title, fr.office_code, fr.finance_function FROM users u LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=u.id AND fr.active=TRUE WHERE u.archived_at IS NULL AND ${scope.sql} ORDER BY u.id`, scope.params);
  const map = new Map();
  rows.forEach(row => map.set(Number(row.id), row));
  return map;
}
function dimensionValueOf(profile, dimension) {
  if (!profile) return null;
  if (dimension === "office") return profile.office_code || null;
  if (dimension === "finance_function") return profile.finance_function || null;
  if (dimension === "employee_group") return profile.job_title || null;
  return profile.department || null;
}

async function gradingThresholds(financeFunctionName) {
  try {
    const result = await pool.query(`SELECT excellent_threshold, meets_expectations_threshold, below_expectations_threshold FROM finance_grading_band_configs WHERE ($1::text IS NOT NULL AND finance_function_id=(SELECT id FROM finance_functions WHERE name=$1 LIMIT 1)) OR ($1::text IS NULL AND finance_function_id IS NULL AND name='Default') ORDER BY id LIMIT 1`, [financeFunctionName || null]);
    if (result.rows.length) return { excellent: Number(result.rows[0].excellent_threshold), meets: Number(result.rows[0].meets_expectations_threshold), below: Number(result.rows[0].below_expectations_threshold) };
  } catch (error) { if (!["42P01", "42703"].includes(error.code)) throw error; }
  return DEFAULT_THRESHOLDS;
}
function classifyScore(score, thresholds) {
  if (score === null || score === undefined) return null;
  if (score >= thresholds.excellent) return "Excellent";
  if (score >= thresholds.meets) return "Meets Expectations";
  if (score >= thresholds.below) return "Below Expectations";
  return "Unsatisfactory";
}
async function employeeOverallScores(periodFrom, periodTo, scopeIds) {
  const scope = scopeClause(scopeIds, "employee_user_id", 3);
  const rows = await queryTolerant(`SELECT employee_user_id, CASE WHEN SUM(weight)>0 THEN SUM(period_score*weight)/SUM(weight) ELSE AVG(period_score) END overall FROM finance_kpi_objective_aggregates WHERE period_key BETWEEN $1 AND $2 AND ${scope.sql} GROUP BY employee_user_id`, [periodFrom, periodTo, ...scope.params]);
  const map = new Map();
  rows.forEach(row => map.set(Number(row.employee_user_id), Number(row.overall)));
  return map;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("Section generation timed out."), { code: "SECTION_TIMEOUT" })), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
async function runSection(name, factory) {
  try {
    const outcome = await withTimeout(factory(), SECTION_TIMEOUT_MS);
    return { summary: (outcome && outcome.summary) || [], sections: Array.isArray(outcome && outcome.sections) ? outcome.sections : [] };
  } catch (error) {
    if (error && error.status) throw error;
    return { error: { section: name, code: error.code || "SECTION_FAILED", error: error.message } };
  }
}

async function buildKpiPerformance({ period, scopeIds, parameters }) {
  const dimension = ROLLUP_DIMENSIONS.has(parameters.dimension) ? parameters.dimension : "department";
  const scores = await employeeOverallScores(period.from, period.to, scopeIds);
  const dimMap = await userDimensionMap(Array.from(scores.keys()));
  const groups = new Map();
  scores.forEach((score, userId) => {
    const value = dimensionValueOf(dimMap.get(userId), dimension) || "Unassigned";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(score);
  });
  const dimensionRows = Array.from(groups.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([value, list]) => [value, list.length, round1(average(list)), round1(Math.min(...list)), round1(Math.max(...list))]);
  const objectiveScope = scopeClause(scopeIds, "employee_user_id", 3);
  const objectiveRows = await queryTolerant(`SELECT objective_name, ROUND(AVG(period_score),1) avg_score, SUM(weight) total_weight FROM finance_kpi_objective_aggregates WHERE period_key BETWEEN $1 AND $2 AND ${objectiveScope.sql} GROUP BY objective_name ORDER BY objective_name`, [period.from, period.to, ...objectiveScope.params]);
  return {
    summary: [{ label: "Dimension", value: dimension }, { label: "Employees Scored", value: scores.size }],
    sections: [
      { name: `KPI Averages by ${dimension}`, columns: ["Dimension", "Employees", "AvgScore", "MinScore", "MaxScore"], rows: dimensionRows },
      { name: "Objective Averages", columns: ["Objective", "AvgScore", "TotalWeight"], rows: objectiveRows.map(row => [row.objective_name, Number(row.avg_score), Number(row.total_weight)]) }
    ]
  };
}

async function buildWorkflowThroughput({ period, scopeIds }) {
  const journalScope = scopeClause(scopeIds, "j.preparer_user_id", 3);
  const journals = await queryTolerant(`SELECT j.journal_reference, COALESCE(u.name,'') preparer, j.status, j.submitted_at, j.approved_at, CASE WHEN j.submitted_at IS NOT NULL AND j.approved_at IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (j.approved_at-j.submitted_at))/3600.0,1) END cycle_hours, CASE WHEN j.submitted_at <= COALESCE(j.effective_due_at, j.original_due_at, j.due_at) THEN TRUE ELSE FALSE END on_time_submission, CASE WHEN j.submitted_at > COALESCE(j.effective_due_at, j.original_due_at, j.due_at) THEN TRUE ELSE FALSE END late_submission FROM finance_journals j LEFT JOIN users u ON u.id=j.preparer_user_id WHERE j.accounting_period BETWEEN $1 AND $2 AND ${journalScope.sql} ORDER BY j.journal_reference`, [period.from, period.to, ...journalScope.params]);
  const reconciliationScope = scopeClause(scopeIds, "r.owner_user_id", 3);
  const reconciliations = await queryTolerant(`SELECT r.control_name, COALESCE(u.name,'') owner, r.status, r.created_at, r.approved_at, CASE WHEN r.approved_at IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (r.approved_at-r.created_at))/3600.0,1) END cycle_hours, CASE WHEN COALESCE(r.reviewed_at, r.approved_at, r.closed_at) <= COALESCE(r.effective_due_at, r.original_due_at, r.due_at) THEN TRUE ELSE FALSE END on_time_submission, CASE WHEN COALESCE(r.reviewed_at, r.approved_at, r.closed_at) > COALESCE(r.effective_due_at, r.original_due_at, r.due_at) THEN TRUE ELSE FALSE END late_submission FROM finance_reconciliations r LEFT JOIN users u ON u.id=r.owner_user_id WHERE r.accounting_period BETWEEN $1 AND $2 AND ${reconciliationScope.sql} ORDER BY r.control_name`, [period.from, period.to, ...reconciliationScope.params]);
  const closeScope = scopeClause(scopeIds, "ct.owner_user_id", 3);
  const closeTasks = await queryTolerant(`SELECT ct.task_reference, COALESCE(u.name,'') owner, ct.status, cp.period_key, ct.completed_at, CASE WHEN ct.completed_at IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (ct.completed_at-ct.created_at))/3600.0,1) END cycle_hours, CASE WHEN ct.completed_at <= COALESCE(ct.effective_due_at, ct.original_due_at, ct.due_at) THEN TRUE ELSE FALSE END on_time_submission, CASE WHEN ct.completed_at > COALESCE(ct.effective_due_at, ct.original_due_at, ct.due_at) THEN TRUE ELSE FALSE END late_submission FROM finance_close_tasks ct JOIN finance_close_periods cp ON cp.id=ct.period_id LEFT JOIN users u ON u.id=ct.owner_user_id WHERE cp.period_key BETWEEN $1 AND $2 AND ${closeScope.sql} ORDER BY ct.task_reference`, [period.from, period.to, ...closeScope.params]);
  const journalCycles = journals.filter(row => row.cycle_hours !== null && row.cycle_hours !== undefined).map(row => Number(row.cycle_hours));
  const reconciliationCycles = reconciliations.filter(row => row.cycle_hours !== null && row.cycle_hours !== undefined).map(row => Number(row.cycle_hours));
  const closeCycles = closeTasks.filter(row => row.cycle_hours !== null && row.cycle_hours !== undefined).map(row => Number(row.cycle_hours));
  let ticketOnTime = null;
  let ticketLate = null;
  try {
    const ticketScope = scopeClause(scopeIds, "t.assigned_to_user_id", 3);
    const ticketRows = await pool.query(`SELECT COUNT(*) FILTER (WHERE t.closed_at <= COALESCE(t.effective_due_at, t.original_due_at, t.due_at)) on_time, COUNT(*) FILTER (WHERE t.closed_at > COALESCE(t.effective_due_at, t.original_due_at, t.due_at)) late FROM tickets t WHERE t.workspace='FIN' AND t.archived_at IS NULL AND t.closed_at IS NOT NULL AND to_char(t.created_at,'YYYY-MM') BETWEEN $1 AND $2 AND ${ticketScope.sql}`, [period.from, period.to, ...ticketScope.params]);
    ticketOnTime = Number(ticketRows.rows[0].on_time);
    ticketLate = Number(ticketRows.rows[0].late);
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) console.warn(`Workflow throughput ticket on-time counts omitted: ${error.message}`);
    else throw error;
  }
  const summary = [
    { label: "Journals", value: journals.length },
    { label: "Reconciliations", value: reconciliations.length },
    { label: "Month-End Tasks", value: closeTasks.length },
    { label: "Avg Journal Approval Hours", value: journalCycles.length ? round1(average(journalCycles)) : null },
    { label: "Avg Reconciliation Approval Hours", value: reconciliationCycles.length ? round1(average(reconciliationCycles)) : null },
    { label: "Avg Close Task Completion Hours", value: closeCycles.length ? round1(average(closeCycles)) : null },
    { label: "Journals OnTimeSubmissions", value: journals.filter(row => row.on_time_submission === true).length },
    { label: "Journals LateSubmissions", value: journals.filter(row => row.late_submission === true).length },
    { label: "Reconciliations OnTimeSubmissions", value: reconciliations.filter(row => row.on_time_submission === true).length },
    { label: "Reconciliations LateSubmissions", value: reconciliations.filter(row => row.late_submission === true).length },
    { label: "Month-End Tasks OnTimeSubmissions", value: closeTasks.filter(row => row.on_time_submission === true).length },
    { label: "Month-End Tasks LateSubmissions", value: closeTasks.filter(row => row.late_submission === true).length }
  ];
  if (ticketOnTime !== null) summary.push({ label: "Tickets OnTimeSubmissions", value: ticketOnTime }, { label: "Tickets LateSubmissions", value: ticketLate });
  return {
    summary,
    sections: [
      { name: "Journals", columns: ["Journal", "Preparer", "Status", "SubmittedAt", "ApprovedAt", "ApprovalCycleHours", "OnTimeSubmission", "LateSubmission"], rows: journals.map(row => [row.journal_reference, row.preparer, row.status, row.submitted_at, row.approved_at, row.cycle_hours, row.on_time_submission, row.late_submission]) },
      { name: "Reconciliations", columns: ["Control", "Owner", "Status", "CreatedAt", "ApprovedAt", "ApprovalCycleHours", "OnTimeSubmission", "LateSubmission"], rows: reconciliations.map(row => [row.control_name, row.owner, row.status, row.created_at, row.approved_at, row.cycle_hours, row.on_time_submission, row.late_submission]) },
      { name: "Month-End Tasks", columns: ["Task", "Owner", "Status", "Period", "CompletedAt", "CompletionCycleHours", "OnTimeSubmission", "LateSubmission"], rows: closeTasks.map(row => [row.task_reference, row.owner, row.status, row.period_key, row.completed_at, row.cycle_hours, row.on_time_submission, row.late_submission]) }
    ]
  };
}

async function buildGradingDistribution({ period, scopeIds }) {
  const scores = await employeeOverallScores(period.from, period.to, scopeIds);
  const dimMap = await userDimensionMap(Array.from(scores.keys()));
  const thresholdCache = new Map();
  const counts = {};
  BAND_NAMES.forEach(band => { counts[band] = 0; });
  const employeeRows = [];
  for (const entry of scores) {
    const userId = entry[0];
    const score = entry[1];
    const profile = dimMap.get(userId) || {};
    const financeFunction = profile.finance_function || null;
    if (!thresholdCache.has(financeFunction)) thresholdCache.set(financeFunction, await gradingThresholds(financeFunction));
    const band = classifyScore(score, thresholdCache.get(financeFunction));
    counts[band] += 1;
    employeeRows.push([profile.name || String(userId), round1(score), band]);
  }
  const total = scores.size;
  employeeRows.sort((a, b) => b[1] - a[1]);
  return {
    summary: [{ label: "Employees Graded", value: total }],
    sections: [
      { name: "Grading Bands", columns: ["Band", "Count", "Percentage"], rows: BAND_NAMES.map(band => [band, counts[band], total ? round1(counts[band] * 100 / total) : 0]) },
      { name: "Employee Scores", columns: ["Employee", "OverallScore", "Band"], rows: employeeRows }
    ]
  };
}

async function loadScopedTickets(period, scopeIds) {
  const scope = scopeClause(scopeIds, "t.assigned_to_user_id", 3);
  return queryTolerant(`SELECT t.ticket_ref, t.title, t.status, t.due_at, t.assigned_to_user_id FROM tickets t WHERE t.workspace='FIN' AND t.archived_at IS NULL AND to_char(t.created_at,'YYYY-MM') BETWEEN $1 AND $2 AND ${scope.sql}`, [period.from, period.to, ...scope.params]);
}
async function buildTaskCompletion({ period, scopeIds }) {
  const tickets = await loadScopedTickets(period, scopeIds);
  const timeScope = scopeClause(scopeIds, "user_id", 3);
  const timeRows = await queryTolerant(`SELECT user_id, SUM(duration_minutes) total_minutes, COUNT(*) entries FROM finance_time_tracking_entries WHERE to_char(created_at,'YYYY-MM') BETWEEN $1 AND $2 AND ${timeScope.sql} GROUP BY user_id`, [period.from, period.to, ...timeScope.params]);
  const timeByUser = new Map();
  timeRows.forEach(row => timeByUser.set(Number(row.user_id), row));
  const dimMap = await userDimensionMap(Array.from(new Set(tickets.map(ticket => Number(ticket.assigned_to_user_id)).filter(id => Number.isFinite(id)))));
  const byEmployee = new Map();
  tickets.forEach(ticket => {
    const userId = Number(ticket.assigned_to_user_id);
    if (!Number.isFinite(userId)) return;
    if (!byEmployee.has(userId)) byEmployee.set(userId, { total: 0, completed: 0, overdue: 0 });
    const record = byEmployee.get(userId);
    record.total += 1;
    if (["Resolved", "Closed"].includes(ticket.status)) record.completed += 1;
    if (ticket.due_at && new Date(ticket.due_at) < new Date() && !["Resolved", "Closed"].includes(ticket.status)) record.overdue += 1;
  });
  const employeeRows = Array.from(byEmployee.entries()).map(([userId, record]) => {
    const profile = dimMap.get(userId) || {};
    const time = timeByUser.get(userId);
    return [profile.name || String(userId), record.total, record.completed, round1(record.completed * 100 / record.total), record.overdue, round1(record.overdue * 100 / record.total), time ? Number(time.total_minutes) : 0];
  }).sort((a, b) => b[1] - a[1]);
  const overdueRows = tickets.filter(ticket => ticket.due_at && new Date(ticket.due_at) < new Date() && !["Resolved", "Closed"].includes(ticket.status)).map(ticket => [ticket.ticket_ref, ticket.title, ticket.due_at, (dimMap.get(Number(ticket.assigned_to_user_id)) || {}).name || ""]);
  const totalTickets = tickets.length;
  const completed = tickets.filter(ticket => ["Resolved", "Closed"].includes(ticket.status)).length;
  return {
    summary: [
      { label: "Tickets", value: totalTickets },
      { label: "Completed", value: completed },
      { label: "Completion Rate %", value: totalTickets ? round1(completed * 100 / totalTickets) : null },
      { label: "Overdue", value: overdueRows.length }
    ],
    sections: [
      { name: "By Employee", columns: ["Employee", "TotalTickets", "Completed", "CompletionRatePct", "Overdue", "OverdueRatePct", "TrackedMinutes"], rows: employeeRows },
      { name: "Overdue Tickets", columns: ["Ticket", "Title", "DueAt", "Assignee"], rows: overdueRows }
    ]
  };
}

async function buildFeedbackSummary({ period, scopeIds }) {
  const scope = scopeClause(scopeIds, "recipient_user_id", 3);
  const byEmployee = await queryTolerant(`SELECT recipient_user_id, period_key, COUNT(*) remarks, ROUND(AVG(rating),1) avg_rating FROM finance_feedback_entries WHERE period_key BETWEEN $1 AND $2 AND ${scope.sql} GROUP BY recipient_user_id, period_key ORDER BY period_key DESC, recipient_user_id`, [period.from, period.to, ...scope.params]);
  const recent = await queryTolerant(`SELECT f.author_user_id, f.recipient_user_id, f.rating, f.remark_text, f.created_at FROM finance_feedback_entries f WHERE f.period_key BETWEEN $1 AND $2 AND ${scope.sql} ORDER BY f.created_at DESC LIMIT 200`, [period.from, period.to, ...scope.params]);
  const nameIds = Array.from(new Set([...byEmployee.map(row => Number(row.recipient_user_id)), ...recent.map(row => Number(row.author_user_id)), ...recent.map(row => Number(row.recipient_user_id))])).filter(id => Number.isFinite(id));
  const dimMap = await userDimensionMap(nameIds);
  const nameOf = userId => (dimMap.get(Number(userId)) || {}).name || String(userId || "");
  return {
    summary: [{ label: "Feedback Recipients", value: byEmployee.length }, { label: "Recent Remarks", value: recent.length }],
    sections: [
      { name: "By Employee", columns: ["Employee", "Period", "Remarks", "AvgRating"], rows: byEmployee.map(row => [nameOf(row.recipient_user_id), row.period_key, Number(row.remarks), row.avg_rating === null ? null : Number(row.avg_rating)]) },
      { name: "Recent Remarks", columns: ["Author", "Recipient", "Rating", "CreatedAt", "Remark"], rows: recent.map(row => [nameOf(row.author_user_id), nameOf(row.recipient_user_id), row.rating, row.created_at, String(row.remark_text || "").slice(0, 120)]) }
    ]
  };
}

async function buildItServiceSatisfaction({ period }) {
  const byPeriod = await queryTolerant(`SELECT to_char(submitted_at,'YYYY-MM') period_key, COUNT(*) responses, ROUND(AVG(satisfaction_rating),1) avg_satisfaction, ROUND(100.0*COUNT(*) FILTER (WHERE nps_classification='Promoter')/NULLIF(COUNT(*),0),1) promoters_pct, ROUND(100.0*COUNT(*) FILTER (WHERE nps_classification='Passive')/NULLIF(COUNT(*),0),1) passives_pct, ROUND(100.0*COUNT(*) FILTER (WHERE nps_classification='Detractor')/NULLIF(COUNT(*),0),1) detractors_pct, ROUND(100.0*(COUNT(*) FILTER (WHERE nps_classification='Promoter')-COUNT(*) FILTER (WHERE nps_classification='Detractor'))/NULLIF(COUNT(*),0),1) nps_score FROM finance_it_service_surveys WHERE to_char(submitted_at,'YYYY-MM') BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`, [period.from, period.to]);
  const recent = await queryTolerant(`SELECT it_ticket_id, satisfaction_rating, nps_score, nps_classification, submitted_at FROM finance_it_service_surveys WHERE to_char(submitted_at,'YYYY-MM') BETWEEN $1 AND $2 ORDER BY submitted_at DESC LIMIT 200`, [period.from, period.to]);
  const totalResponses = byPeriod.reduce((sum, row) => sum + Number(row.responses), 0);
  return {
    summary: [{ label: "Total Responses", value: totalResponses }, { label: "Periods With Responses", value: byPeriod.length }],
    sections: [
      { name: "By Period", columns: ["Period", "Responses", "AvgSatisfaction", "PromotersPct", "PassivesPct", "DetractorsPct", "NpsScore"], rows: byPeriod.map(row => [row.period_key, Number(row.responses), row.avg_satisfaction === null ? null : Number(row.avg_satisfaction), Number(row.promoters_pct), Number(row.passives_pct), Number(row.detractors_pct), Number(row.nps_score)]) },
      { name: "Recent Responses", columns: ["TicketId", "Satisfaction", "Nps", "Classification", "SubmittedAt"], rows: recent.map(row => [row.it_ticket_id, row.satisfaction_rating, row.nps_score, row.nps_classification, row.submitted_at]) }
    ]
  };
}

function assembleGrading(objectives, thresholds) {
  const totalWeight = objectives.reduce((sum, objective) => sum + Number(objective.weight || 0), 0);
  const overallScore = objectives.length ? (totalWeight > 0 ? objectives.reduce((sum, objective) => sum + Number(objective.period_score) * Number(objective.weight || 0), 0) / totalWeight : average(objectives.map(objective => Number(objective.period_score)))) : null;
  const gradingBand = classifyScore(overallScore, thresholds);
  const qualitativeAssessment = gradingBand === null ? "No scored objectives recorded for the period." : QUALITATIVE_ASSESSMENTS[gradingBand];
  return { overallScore: overallScore === null ? null : round1(overallScore), gradingBand, qualitativeAssessment };
}
async function buildPerformanceGrading({ period, scopeIds, parameters }) {
  const employeeUserId = Number(parameters.employeeUserId);
  if (!Number.isFinite(employeeUserId)) throw fail(400, "MISSING_REQUIRED_PARAMETER", "employeeUserId is required for the performance grading report.");
  if (scopeIds !== null && !scopeIds.includes(employeeUserId)) throw fail(403, "REPORT_SCOPE_DENIED", "The requested employee is outside the authorised reporting scope.");
  const objectives = await queryTolerant(`SELECT objective_name, weight, period_score FROM finance_kpi_objective_aggregates WHERE employee_user_id=$1 AND period_key BETWEEN $2 AND $3 ORDER BY objective_name`, [employeeUserId, period.from, period.to]);
  const dimMap = await userDimensionMap([employeeUserId]);
  const profile = dimMap.get(employeeUserId) || {};
  const thresholds = await gradingThresholds(profile.finance_function || null);
  const grading = assembleGrading(objectives, thresholds);
  const correctiveRows = await queryTolerant(`SELECT id, description, target_improvement_score, review_date, mentor_user_id, status, created_at FROM finance_corrective_action_plans WHERE employee_user_id=$1 AND period_key BETWEEN $2 AND $3 AND status='active' ORDER BY created_at DESC LIMIT 1`, [employeeUserId, period.from, period.to]);
  const correctiveAction = correctiveRows.length ? correctiveRows[0] : null;
  const sections = [
    { name: "Objectives", columns: ["Objective", "Weight", "Score", "WeightedContribution"], rows: objectives.map(objective => [objective.objective_name, Number(objective.weight), Number(objective.period_score), round1(Number(objective.period_score) * Number(objective.weight || 0))]) }
  ];
  if (correctiveAction) sections.push({ name: "Corrective Action Plan", columns: ["Field", "Value"], rows: [["Description", correctiveAction.description], ["Target Improvement Score", correctiveAction.target_improvement_score], ["Review Date", correctiveAction.review_date], ["Status", correctiveAction.status], ["Created At", correctiveAction.created_at]] });
  return {
    summary: [
      { label: "Employee", value: profile.name || String(employeeUserId) },
      { label: "OverallScore", value: grading.overallScore },
      { label: "GradingBand", value: grading.gradingBand },
      { label: "QualitativeAssessment", value: grading.qualitativeAssessment }
    ],
    sections,
    grading: { ...grading, objectives: objectives.map(objective => ({ objective: objective.objective_name, weight: Number(objective.weight), score: Number(objective.period_score) })), correctiveAction }
  };
}

async function generateReport({ reportType, parameters = {}, outputFormat = "pdf", requestingUser }) {
  if (!REPORT_TYPES.has(reportType)) throw fail(400, "INVALID_REPORT_TYPE", "Unknown report type.");
  const context = await resolveContext(requestingUser);
  if (!financeAccess.confidentialityAllowed(context, parameters.confidentialityLevel || "Internal")) throw fail(403, "CONFIDENTIALITY_CLEARANCE_INSUFFICIENT", "The requested confidentiality level exceeds the authorised clearance.");
  const profile = await requesterProfile(requestingUser);
  const scopeIds = await computeAllowedUserIds(context, profile);
  const period = normalizePeriod(parameters);
  const target = await assertTargetScope(scopeIds, parameters);
  const warnings = [];
  const errors = [];
  let summary = [{ label: "Report Type", value: REPORT_TITLES[reportType] }, { label: "Period", value: `${period.from} to ${period.to}` }, { label: "Requested By", value: profile.name || profile.id }];
  let sections = [];
  if (target.emptyTarget) {
    warnings.push("NO_DATA_FOR_PERIOD");
  } else {
    const builders = {
      kpi_performance: () => buildKpiPerformance({ period, scopeIds, parameters }),
      workflow_throughput: () => buildWorkflowThroughput({ period, scopeIds, parameters }),
      grading_distribution: () => buildGradingDistribution({ period, scopeIds, parameters }),
      task_completion: () => buildTaskCompletion({ period, scopeIds, parameters }),
      feedback_summary: () => buildFeedbackSummary({ period, scopeIds, parameters }),
      it_service_satisfaction: () => buildItServiceSatisfaction({ period, scopeIds, parameters }),
      performance_grading: () => buildPerformanceGrading({ period, scopeIds, parameters })
    };
    const outcome = await runSection(reportType, builders[reportType]);
    if (outcome.error) errors.push(outcome.error);
    else { summary = summary.concat(outcome.summary); sections = outcome.sections; }
  }
  if (!sections.some(section => section.rows.length > 0) && !warnings.includes("NO_DATA_FOR_PERIOD")) warnings.push("NO_DATA_FOR_PERIOD");
  const formatted = await financeReportGenerator.format({ title: `${REPORT_TITLES[reportType]} ${period.from}`, generatedAt: new Date().toISOString(), summary, sections, warnings, _errors: errors }, outputFormat);
  return { ...formatted, warnings, _errors: errors };
}

async function getPerformanceGrading({ employeeUserId, periodKey, periodRange, requestingUser }) {
  const { scopeIds } = await resolveScope(requestingUser);
  const period = normalizePeriod({ periodKey, periodRange });
  const outcome = await buildPerformanceGrading({ period, scopeIds, parameters: { employeeUserId } });
  return { period: `${period.from} to ${period.to}`, overallScore: outcome.grading.overallScore, gradingBand: outcome.grading.gradingBand, objectives: outcome.grading.objectives, qualitativeAssessment: outcome.grading.qualitativeAssessment, correctiveAction: outcome.grading.correctiveAction };
}

async function getReportRollup({ dimension, periodKey, periodRange, requestingUser }) {
  if (!ROLLUP_DIMENSIONS.has(dimension)) throw fail(400, "INVALID_ROLLUP_DIMENSION", "dimension must be department, office, finance_function, or employee_group.");
  const period = normalizePeriod({ periodKey, periodRange });
  const { scopeIds } = await resolveScope(requestingUser);
  const scores = await employeeOverallScores(period.from, period.to, scopeIds);
  const previousScores = await employeeOverallScores(monthShift(period.from, -1), monthShift(period.to, -1), scopeIds);
  const dimMap = await userDimensionMap(scopeIds);
  const tickets = await loadScopedTickets(period, scopeIds);
  const thresholdCache = new Map();
  const groups = new Map();
  dimMap.forEach((profile, userId) => {
    const value = dimensionValueOf(profile, dimension) || "Unassigned";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(userId);
  });
  const rollup = Array.from(groups.keys()).sort().map(value => {
    const employeeIds = groups.get(value);
    const currentScores = employeeIds.filter(id => scores.has(id)).map(id => scores.get(id));
    const previousValues = employeeIds.filter(id => previousScores.has(id)).map(id => previousScores.get(id));
    const avgScore = currentScores.length ? round1(average(currentScores)) : null;
    const previousAverage = previousValues.length ? average(previousValues) : null;
    const trendDelta = avgScore !== null && previousAverage !== null ? round1(avgScore - previousAverage) : null;
    const ticketList = tickets.filter(ticket => employeeIds.includes(Number(ticket.assigned_to_user_id)));
    const completed = ticketList.filter(ticket => ["Resolved", "Closed"].includes(ticket.status)).length;
    const taskCompletionRate = ticketList.length ? round1(completed * 100 / ticketList.length) : null;
    const overdueCount = ticketList.filter(ticket => ticket.due_at && new Date(ticket.due_at) < new Date() && !["Resolved", "Closed"].includes(ticket.status)).length;
    const atRiskCount = currentScores.filter(score => score < 80).length;
    const distribution = {};
    BAND_NAMES.forEach(band => { distribution[band] = 0; });
    return Promise.all(employeeIds.filter(id => scores.has(id)).map(async id => {
      const financeFunction = (dimMap.get(id) || {}).finance_function || null;
      if (!thresholdCache.has(financeFunction)) thresholdCache.set(financeFunction, await gradingThresholds(financeFunction));
      const band = classifyScore(scores.get(id), thresholdCache.get(financeFunction));
      distribution[band] += 1;
    })).then(() => ({ dimensionValue: value, employeeCount: employeeIds.length, metrics: { avgScore, taskCompletionRate, overdueCount, atRiskCount, distribution, trendDelta } }));
  });
  return { rollup: await Promise.all(rollup) };
}

async function trendMetricValue(metric, periodKey, scopeIds, dimensionFilter) {
  if (metric === "avg_kpi_score") {
    const scores = await employeeOverallScores(periodKey, periodKey, scopeIds);
    const values = Array.from(scores.entries()).filter(entry => !dimensionFilter || dimensionFilter.has(entry[0])).map(entry => entry[1]);
    return values.length ? round1(average(values)) : null;
  }
  if (metric === "task_completion_rate" || metric === "overdue_count") {
    const tickets = await loadScopedTickets({ from: periodKey, to: periodKey }, scopeIds);
    const filtered = tickets.filter(ticket => !dimensionFilter || dimensionFilter.has(Number(ticket.assigned_to_user_id)));
    if (metric === "overdue_count") return filtered.filter(ticket => ticket.due_at && new Date(ticket.due_at) < new Date() && !["Resolved", "Closed"].includes(ticket.status)).length;
    if (!filtered.length) return null;
    return round1(filtered.filter(ticket => ["Resolved", "Closed"].includes(ticket.status)).length * 100 / filtered.length);
  }
  if (metric === "nps_score") {
    const rows = await queryTolerant(`SELECT ROUND(100.0*(COUNT(*) FILTER (WHERE nps_classification='Promoter')-COUNT(*) FILTER (WHERE nps_classification='Detractor'))/NULLIF(COUNT(*),0),1) nps_score FROM finance_it_service_surveys WHERE to_char(submitted_at,'YYYY-MM')=$1`, [periodKey]);
    return rows.length && rows[0].nps_score !== null ? Number(rows[0].nps_score) : null;
  }
  const rows = await queryTolerant(`SELECT ROUND(AVG(rating),1) avg_rating FROM finance_feedback_entries WHERE period_key=$1`, [periodKey]);
  return rows.length && rows[0].avg_rating !== null ? Number(rows[0].avg_rating) : null;
}
async function getTrendAnalysis({ metric, periodKey, periodRange, dimension, dimensionValue, requestingUser }) {
  if (!TREND_METRICS.has(metric)) throw fail(400, "INVALID_TREND_METRIC", "metric must be one of avg_kpi_score, task_completion_rate, overdue_count, nps_score, feedback_avg_rating.");
  const period = normalizePeriod({ periodKey, periodRange });
  const periods = enumeratePeriods(period.from, period.to);
  const { scopeIds } = await resolveScope(requestingUser);
  let dimensionFilter = null;
  if (dimensionValue) {
    const dimMap = await userDimensionMap(scopeIds);
    dimensionFilter = new Set(Array.from(dimMap.entries()).filter(entry => dimensionValueOf(entry[1], ROLLUP_DIMENSIONS.has(dimension) ? dimension : "department") === dimensionValue).map(entry => entry[0]));
  }
  const series = [];
  let previousValue = null;
  for (const periodKey of periods) {
    const value = await trendMetricValue(metric, periodKey, scopeIds, dimensionFilter);
    series.push({ periodKey, value, previousValue, pctChange: value !== null && previousValue !== null && previousValue !== 0 ? round1((value - previousValue) * 100 / previousValue) : null });
    previousValue = value;
  }
  return series;
}

module.exports = { generateReport, getReportRollup, getTrendAnalysis, getPerformanceGrading, REPORT_TYPES, ROLLUP_DIMENSIONS, TREND_METRICS, employeeOverallScores, gradingThresholds, classifyScore, resolveScope, computeAllowedUserIds, userDimensionMap, scopeClause, queryTolerant, isValidPeriodKey, normalizePeriod };