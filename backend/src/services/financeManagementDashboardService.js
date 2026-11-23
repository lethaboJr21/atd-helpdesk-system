const pool = require("../db/pool");
const financeAccess = require("../middleware/financeAccess");
const financeManagerDashboard = require("./financeManagerDashboard");
const reportingService = require("./financeEnterpriseReportingService");

const CACHE_TTL_MS = 60000;
const CACHE_MAX_ENTRIES = 200;
const PANEL_TIMEOUT_MS = 15000;
const HIERARCHY_MAX_DEPTH = 25;
const TARGET_KPI_SCORE = financeManagerDashboard.TARGET_KPI_SCORE || 80;
const GLOBAL_LEVELS = new Set(["workspace_manager", "security_admin", "auditor"]);
const HOD_LEVELS = new Set(["director", "executive"]);

const dashboardCache = new Map();

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

async function queryTolerant(sql, params) {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return [];
    throw error;
  }
}

function scopeClause(ids, column, startIndex) {
  if (ids === null || ids === undefined) return { sql: "TRUE", params: [] };
  return { sql: `${column}=ANY($${startIndex}::bigint[])`, params: [ids] };
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("Panel generation timed out."), { code: "PANEL_TIMEOUT" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function currentPeriodKey() {
  return new Date().toISOString().slice(0, 7);
}

function monthBounds(periodKey) {
  const [year, month] = periodKey.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return { from: `${periodKey}-01`, to: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01` };
}

async function resolveContext(requester) {
  if (requester.financeAccess && requester.financeAccess.maxConfidentiality) return requester.financeAccess;
  return financeAccess.resolve({ user: { id: requester.id, role: requester.role, job_title: requester.job_title } });
}

async function requesterProfile(userId) {
  const rows = await queryTolerant(`SELECT id, name, email, department, role, job_title FROM users WHERE id=$1::bigint`, [userId]);
  return rows[0] || { id: userId, name: null, email: null, department: null, role: null, job_title: null };
}

async function departmentUserIds(department) {
  if (!department) return [];
  const rows = await queryTolerant(`SELECT id FROM users WHERE LOWER(department)=LOWER($1) AND archived_at IS NULL AND status='active'`, [department]);
  return rows.map((r) => Number(r.id));
}

async function hierarchyScope(managerUserId) {
  const directRows = await queryTolerant(`SELECT user_id FROM finance_employee_responsibilities WHERE manager_user_id=$1::bigint AND active=TRUE`, [managerUserId]);
  const directIds = directRows.map((r) => Number(r.user_id));
  const visited = new Set(directIds);
  const all = [...directIds];
  let frontier = [...directIds];
  let depth = 0;
  while (frontier.length && depth < HIERARCHY_MAX_DEPTH) {
    const rows = await queryTolerant(`SELECT user_id FROM finance_employee_responsibilities WHERE manager_user_id=ANY($1::bigint[]) AND active=TRUE`, [frontier]);
    const next = rows.map((r) => Number(r.user_id)).filter((id) => !visited.has(id));
    next.forEach((id) => {
      visited.add(id);
      all.push(id);
    });
    frontier = next;
    depth += 1;
  }
  if (visited.has(Number(managerUserId))) {
    console.warn(`Reporting hierarchy cycle detected for manager ${managerUserId}; scoping to direct reports only.`);
    return { ids: directIds, cycle: true };
  }
  return { ids: all, cycle: false };
}

async function buildSubmissionQueue({ reportIds }) {
  const journalScope = scopeClause(reportIds, "j.preparer_user_id", 1);
  const journals = await queryTolerant(
    `SELECT j.id, j.journal_reference, j.status, j.accounting_period, j.preparer_user_id, u.name preparer_name, fr.finance_function FROM finance_journals j LEFT JOIN users u ON u.id=j.preparer_user_id LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=j.preparer_user_id AND fr.active=TRUE WHERE j.status NOT IN ('draft','approved','rejected','returned','published','posted') AND ${journalScope.sql} ORDER BY j.submitted_at DESC NULLS LAST LIMIT 200`,
    journalScope.params
  );
  const reconScope = scopeClause(reportIds, "r.owner_user_id", 1);
  const reconciliations = await queryTolerant(
    `SELECT r.id, r.control_name, r.status, r.accounting_period, r.owner_user_id, u.name owner_name, fr.finance_function FROM finance_reconciliations r LEFT JOIN users u ON u.id=r.owner_user_id LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=r.owner_user_id AND fr.active=TRUE WHERE r.status NOT IN ('draft','approved','rejected','returned','published') AND ${reconScope.sql} ORDER BY r.id DESC LIMIT 200`,
    reconScope.params
  );
  const closeScope = scopeClause(reportIds, "ct.owner_user_id", 1);
  const monthEnd = await queryTolerant(
    `SELECT ct.id, ct.task_reference, ct.status, ct.review_status, cp.period_key, ct.owner_user_id, u.name owner_name, fr.finance_function FROM finance_close_tasks ct JOIN finance_close_periods cp ON cp.id=ct.period_id LEFT JOIN users u ON u.id=ct.owner_user_id LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=ct.owner_user_id AND fr.active=TRUE WHERE ct.requires_review=TRUE AND ct.review_status='pending' AND ct.status NOT IN ('completed','closed') AND ${closeScope.sql} ORDER BY ct.id DESC LIMIT 200`,
    closeScope.params
  );
  const groups = new Map();
  const groupOf = (financeFunction) => {
    const key = financeFunction || "Unassigned";
    if (!groups.has(key)) groups.set(key, { financeFunction: key, journals: [], reconciliations: [], monthEnd: [] });
    return groups.get(key);
  };
  journals.forEach((x) => groupOf(x.finance_function).journals.push(x));
  reconciliations.forEach((x) => groupOf(x.finance_function).reconciliations.push(x));
  monthEnd.forEach((x) => groupOf(x.finance_function).monthEnd.push(x));
  return {
    byFunction: [...groups.values()],
    items: { journals: journals.length, reconciliations: reconciliations.length, monthEnd: monthEnd.length },
  };
}

async function buildReportCentre({ scopeIds }) {
  const scope = scopeClause(scopeIds, "s.created_by", 1);
  const recentReports = await queryTolerant(
    `SELECT s.id, s.name, s.report_type, s.output_format, s.last_run_at, s.last_run_status, s.active, s.created_by, u.name created_by_name FROM finance_scheduled_reports s LEFT JOIN users u ON u.id=s.created_by WHERE ${scope.sql} ORDER BY s.created_at DESC LIMIT 20`,
    scope.params
  );
  return { availableReportTypes: [...reportingService.REPORT_TYPES], recentReports };
}

async function buildEmailAllocationStatus() {
  const activeRules = await queryTolerant(`SELECT id, finance_function, office_code, work_item_type, recipient_user_ids, active FROM finance_email_allocation_rules WHERE active=TRUE ORDER BY created_at DESC LIMIT 100`);
  const optOutCounts = await queryTolerant(`SELECT category, COUNT(*)::int count FROM finance_email_opt_outs WHERE opted_back_in_at IS NULL GROUP BY category`);
  const recentFailures = await queryTolerant(`SELECT l.id, l.recipient_user_id, u.email recipient_email, u.name recipient_name, l.email_type, l.task_id, l.status, l.sent_at FROM finance_email_delivery_log l LEFT JOIN users u ON u.id=l.recipient_user_id WHERE l.delivered=FALSE ORDER BY l.sent_at DESC LIMIT 20`);
  return { activeRules, optOutCounts, recentFailures };
}

async function buildFeedbackInbox({ scopeIds }) {
  const recipientScope = scopeClause(scopeIds, "f.recipient_user_id", 1);
  const authorScope = scopeClause(scopeIds, "f.author_user_id", 2);
  return queryTolerant(
    `SELECT f.id, f.thread_id, f.author_user_id, au.name author_name, f.recipient_user_id, ru.name recipient_name, f.work_item_id, f.work_item_type, f.period_key, f.remark_text, f.rating, f.created_at FROM finance_feedback_entries f LEFT JOIN users au ON au.id=f.author_user_id LEFT JOIN users ru ON ru.id=f.recipient_user_id WHERE (${recipientScope.sql} OR ${authorScope.sql}) ORDER BY f.created_at DESC LIMIT 50`,
    [...recipientScope.params, ...authorScope.params]
  );
}

async function buildTaskProgressOverview({ reportIds, periodKey }) {
  const taskScope = scopeClause(reportIds, "t.assigned_to_user_id", 1);
  const tasks = await queryTolerant(
    `SELECT t.id, t.ticket_ref, t.title, t.status, t.priority, t.assigned_to_user_id, u.name assignee_name, t.progress_percentage, t.partially_complete, t.due_at, t.effective_due_at, t.last_progress_update_at FROM tickets t LEFT JOIN users u ON u.id=t.assigned_to_user_id WHERE t.workspace='FIN' AND t.status NOT IN ('Resolved','Closed') AND t.archived_at IS NULL AND ${taskScope.sql} ORDER BY COALESCE(t.last_progress_update_at, t.updated_at) DESC LIMIT 100`,
    taskScope.params
  );
  const timeScope = scopeClause(reportIds, "e.user_id", 3);
  const { from, to } = monthBounds(periodKey);
  const timeSummary = await queryTolerant(
    `SELECT e.user_id, u.name user_name, SUM(e.duration_minutes)::int total_minutes, COUNT(*)::int entry_count FROM finance_time_tracking_entries e LEFT JOIN users u ON u.id=e.user_id WHERE e.start_time >= $1::timestamptz AND e.start_time < $2::timestamptz AND ${timeScope.sql} GROUP BY e.user_id, u.name`,
    [from, to, ...timeScope.params]
  );
  return { tasks, timeSummary, period: periodKey };
}

async function buildCorrectiveActions({ reportIds }) {
  const scope = scopeClause(reportIds, "cap.employee_user_id", 1);
  return queryTolerant(
    `SELECT cap.id, cap.employee_user_id, u.name employee_name, cap.period_key, cap.description, cap.target_improvement_score, cap.review_date, cap.mentor_user_id, m.name mentor_name, cap.status, cap.created_at FROM finance_corrective_action_plans cap LEFT JOIN users u ON u.id=cap.employee_user_id LEFT JOIN users m ON m.id=cap.mentor_user_id WHERE cap.status='active' AND ${scope.sql} ORDER BY cap.review_date ASC LIMIT 100`,
    scope.params
  );
}

async function buildDelegatedAuthoritySummary({ managerUserId }) {
  const granted = await queryTolerant(
    `SELECT da.id, da.delegator_user_id, da.delegate_user_id, u.name delegate_name, da.scope, da.expires_at, da.reason, da.created_at FROM finance_delegated_authority da LEFT JOIN users u ON u.id=da.delegate_user_id WHERE da.delegator_user_id=$1::bigint AND da.revoked_at IS NULL AND da.expires_at>NOW() ORDER BY da.expires_at ASC`,
    [managerUserId]
  );
  const received = await queryTolerant(
    `SELECT da.id, da.delegator_user_id, u.name delegator_name, da.delegate_user_id, da.scope, da.expires_at, da.reason, da.created_at FROM finance_delegated_authority da LEFT JOIN users u ON u.id=da.delegator_user_id WHERE da.delegate_user_id=$1::bigint AND da.revoked_at IS NULL AND da.expires_at>NOW() ORDER BY da.expires_at ASC`,
    [managerUserId]
  );
  return { granted, received };
}

async function buildKpiPerformance({ reportIds, periodKey }) {
  const scores = await reportingService.employeeOverallScores(periodKey, periodKey, reportIds);
  const userIds = [...scores.keys()];
  if (!userIds.length) return { period: periodKey, targetScore: TARGET_KPI_SCORE, employees: [] };
  const rows = await queryTolerant(
    `SELECT u.id, u.name, fr.finance_function FROM users u LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=u.id AND fr.active=TRUE WHERE u.id=ANY($1::bigint[])`,
    [userIds]
  );
  const thresholdCache = new Map();
  const thresholdsFor = async (financeFunction) => {
    const key = financeFunction || null;
    if (!thresholdCache.has(key)) thresholdCache.set(key, await reportingService.gradingThresholds(key));
    return thresholdCache.get(key);
  };
  const employees = [];
  for (const row of rows) {
    const score = scores.get(Number(row.id));
    if (score === undefined) continue;
    const thresholds = await thresholdsFor(row.finance_function);
    const projectedScore = round1(score);
    const atRiskFlag = projectedScore < TARGET_KPI_SCORE;
    employees.push({
      userId: Number(row.id),
      name: row.name,
      financeFunction: row.finance_function || null,
      projectedScore,
      gradingBand: reportingService.classifyScore(score, thresholds),
      atRiskFlag,
      shortfall: atRiskFlag ? round1(TARGET_KPI_SCORE - projectedScore) : 0,
    });
  }
  return { period: periodKey, targetScore: TARGET_KPI_SCORE, employees };
}

async function buildAdvancedDashboard({ managerUserId, period, requestingUser }) {
  const requester = requestingUser || { id: managerUserId };
  const requesterId = Number(requester.id);
  const targetId = Number(managerUserId);
  if (!Number.isFinite(requesterId) || !Number.isFinite(targetId)) throw fail(400, "INVALID_MANAGER_USER_ID", "A valid manager user id is required.");

  const periodKey = period || currentPeriodKey();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) throw fail(400, "INVALID_PERIOD", "Period must be a valid YYYY-MM month key.");

  const cacheKey = `${targetId}|${periodKey}|${requesterId}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.at <= CACHE_TTL_MS) return cached.response;

  const context = await resolveContext(requester);
  const profileRow = await requesterProfile(requesterId);
  const profile = {
    id: requesterId,
    name: requester.name || profileRow.name || null,
    department: requester.department !== undefined ? requester.department : profileRow.department,
    role: requester.role || profileRow.role || null,
  };

  const isSuperadmin = requester.role === "superadmin" || profile.role === "superadmin";
  const level = context.accessLevel;
  if (requesterId !== targetId && !isSuperadmin && !GLOBAL_LEVELS.has(level)) {
    if (HOD_LEVELS.has(level)) {
      const deptIds = await departmentUserIds(profile.department);
      if (!deptIds.includes(targetId)) throw fail(403, "DASHBOARD_SCOPE_DENIED", "Dashboard access is limited to your own reporting scope.");
    } else {
      const allowed = [requesterId, ...(context.reportingScope || []).map(Number)];
      if (!allowed.includes(targetId)) throw fail(403, "DASHBOARD_SCOPE_DENIED", "Dashboard access is limited to your own reporting scope.");
    }
  }

  let scopeIds = null;
  if (!isSuperadmin && !GLOBAL_LEVELS.has(level)) {
    if (HOD_LEVELS.has(level)) {
      scopeIds = await departmentUserIds(profile.department);
      if (!scopeIds.length) scopeIds = [requesterId];
    } else {
      const hierarchy = await hierarchyScope(targetId);
      scopeIds = [targetId, ...hierarchy.ids];
    }
  }
  const reportIds = scopeIds === null ? null : scopeIds.filter((id) => id !== targetId);

  const base = await financeManagerDashboard.buildManagerDashboard({ managerUserId: targetId, period: periodKey });

  const errors = [];
  const safe = async (name, fn) => {
    try {
      return await withTimeout(fn(), PANEL_TIMEOUT_MS);
    } catch (err) {
      errors.push({ group: name, error: err.message });
      return null;
    }
  };

  const [submissionQueue, reportCentre, emailAllocationStatus, feedbackInbox, taskProgressOverview, correctiveActions, delegatedAuthoritySummary, kpiPerformance] = await Promise.all([
    safe("submissionQueue", () => buildSubmissionQueue({ reportIds })),
    safe("reportCentre", () => buildReportCentre({ scopeIds })),
    safe("emailAllocationStatus", () => buildEmailAllocationStatus()),
    safe("feedbackInbox", () => buildFeedbackInbox({ scopeIds })),
    safe("taskProgressOverview", () => buildTaskProgressOverview({ reportIds, periodKey })),
    safe("correctiveActions", () => buildCorrectiveActions({ reportIds })),
    safe("delegatedAuthoritySummary", () => buildDelegatedAuthoritySummary({ managerUserId: targetId })),
    safe("kpiPerformance", () => buildKpiPerformance({ reportIds, periodKey })),
  ]);

  const scopedStaff = reportIds === null ? base.staff : base.staff.filter((emp) => reportIds.includes(Number(emp.id)));
  const scopedOverdue = reportIds === null ? base.overdueByEmployee : base.overdueByEmployee.filter((x) => reportIds.includes(Number(x.userId)));
  const scopedSummary = {
    ...(base.summary || {}),
    active_staff: scopedStaff.length,
    totalOverdue: scopedOverdue.reduce((sum, x) => sum + (x.items || []).length, 0),
  };

  const allErrors = [...(base._errors || []), ...errors];
  const response = {
    staff: scopedStaff,
    summary: scopedSummary,
    overdueByEmployee: scopedOverdue,
    reviewQueues: base.reviewQueues,
    evidenceQueue: base.evidenceQueue,
    extensionsWithChains: base.extensionsWithChains,
    qualitySummary: base.qualitySummary,
    timelinessSummary: base.timelinessSummary,
    kpiRisk: base.kpiRisk,
    activityFeedPreview: base.activityFeedPreview,
    emailAllocationStatus: emailAllocationStatus || { activeRules: [], optOutCounts: [], recentFailures: [] },
    submissionQueue: submissionQueue || { byFunction: [], items: { journals: 0, reconciliations: 0, monthEnd: 0 } },
    reportCentre: reportCentre || { availableReportTypes: [...reportingService.REPORT_TYPES], recentReports: [] },
    feedbackInbox: feedbackInbox || [],
    taskProgressOverview: taskProgressOverview || { tasks: [], timeSummary: [], period: periodKey },
    correctiveActions: correctiveActions || [],
    delegatedAuthoritySummary: delegatedAuthoritySummary || { granted: [], received: [] },
    kpiPerformance: kpiPerformance || { period: periodKey, targetScore: TARGET_KPI_SCORE, employees: [] },
    cachedAt: new Date().toISOString(),
  };
  if (allErrors.length) response._errors = allErrors;

  if (!allErrors.length) {
    dashboardCache.set(cacheKey, { response, at: Date.now() });
    if (dashboardCache.size > CACHE_MAX_ENTRIES) {
      const oldest = dashboardCache.keys().next().value;
      dashboardCache.delete(oldest);
    }
  }
  return response;
}

module.exports = { buildAdvancedDashboard, TARGET_KPI_SCORE };