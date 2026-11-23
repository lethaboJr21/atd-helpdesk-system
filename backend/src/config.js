require("dotenv").config();

function parsedFinancePct(envVar, key, fallback) {
  const raw = process.env[envVar];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    console.warn(`Invalid ${envVar} "${raw}" for financeAdvanced.${key} — falling back to ${fallback}.`);
    return fallback;
  }
  return value;
}

const config = {
  rlsEnabled: process.env.RLS_ENABLED === "true",
  dualReadEnabled: process.env.DUAL_READ_ENABLED === "true",
  workspaceNormalisationEnabled:
    process.env.WORKSPACE_NORMALISATION_ENABLED === "true",
  crossWorkspaceExceptionMaxDays: parseInt(
    process.env.CROSS_WORKSPACE_EXCEPTION_MAX_DAYS || "90",
    10
  ),
  dbRoleDefault: process.env.DB_ROLE_DEFAULT || "helpdesk_app",

  pulse: {
    hubUrl: process.env.PULSE_HUB_URL || "http://127.0.0.1:3099/api/errors/ingest",
    errorRetentionDays: parseInt(
      process.env.PULSE_ERROR_RETENTION_DAYS || "90",
      10
    ),
    dedupWindowMs: parseInt(
      process.env.PULSE_DEDUP_WINDOW_MS || "300000",
      10
    ),
    rateLimitPerMin: parseInt(
      process.env.PULSE_RATE_LIMIT_PER_MIN || "60",
      10
    ),
    bufferMax: parseInt(process.env.PULSE_BUFFER_MAX || "100", 10),
    dualWrite: process.env.PULSE_DUAL_WRITE === "true",
  },

  itDashboard: {
    ageingThresholdDays: parseInt(
      process.env.IT_DASHBOARD_AGEING_THRESHOLD_DAYS || "7",
      10
    ),
    slaAtRiskMinutes: parseInt(
      process.env.IT_DASHBOARD_SLA_AT_RISK_MINUTES || "60",
      10
    ),
    socketEnabled: process.env.IT_DASHBOARD_SOCKET_ENABLED === "true",
    pollIntervalMs: parseInt(
      process.env.IT_DASHBOARD_POLL_INTERVAL_MS || "30000",
      10
    ),
  },

  catalogue: {
    fallbackCategoryService:
      process.env.CATALOGUE_FALLBACK_CATEGORY_SERVICE || "Other",
    fallbackCategoryIncident:
      process.env.CATALOGUE_FALLBACK_CATEGORY_INCIDENT || "Other",
  },

  projectReview: {
    timeBudgetMs: parseInt(
      process.env.PROJECT_REVIEW_TIME_BUDGET_MS || "60000",
      10
    ),
  },

  financeAdvanced: {
    feedbackEditWindowMinutes: parseInt(
      process.env.FINANCE_FEEDBACK_EDIT_WINDOW_MINUTES || "30",
      10
    ),
    delegationMaxDays: parseInt(
      process.env.FINANCE_DELEGATION_MAX_DAYS || "30",
      10
    ),
    scheduledReportRetryMax: parseInt(
      process.env.FINANCE_SCHEDULED_REPORT_RETRY_MAX || "3",
      10
    ),
    scheduledReportCheckIntervalCron:
      process.env.FINANCE_SCHEDULED_REPORT_CHECK_CRON || "*/5 * * * *",
    itSurveyExpiryDays: parseInt(
      process.env.FINANCE_IT_SURVEY_EXPIRY_DAYS || "14",
      10
    ),
    lateSubmissionPenaltyPct: parsedFinancePct(
      "FINANCE_LATE_SUBMISSION_PENALTY_PCT",
      "lateSubmissionPenaltyPct",
      50
    ),
    crossDepartmentAddBackPct: parsedFinancePct(
      "FINANCE_CROSS_DEPARTMENT_ADD_BACK_PCT",
      "crossDepartmentAddBackPct",
      50
    ),
    defaultReviewSlaHours: parseInt(
      process.env.FINANCE_DEFAULT_REVIEW_SLA_HOURS || "48",
      10
    ),
    reviewerObjectiveName:
      process.env.FINANCE_REVIEWER_OBJECTIVE_NAME ||
      "Internal Finance Service Delivery",
  },
};

module.exports = config;