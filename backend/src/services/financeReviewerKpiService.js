"use strict";
const pool = require("../db/pool");
const config = require("../config");
const financeAccess = require("../middleware/financeAccess");
const financePeriodService = require("./financePeriodService");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const MANAGER_LEVELS = new Set(["manager", "workspace_manager", "security_admin"]);
const TARGET_THRESHOLD = 80;

async function holdsManagerScope(userId) {
  let role = null;
  try {
    const profile = await pool.query(`SELECT role FROM users WHERE id=$1::bigint`, [userId]);
    role = profile.rows[0]?.role ?? null;
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) throw error;
  }
  if (role === "superadmin") return true;
  try {
    const context = await financeAccess.resolve({ user: { id: userId, role } });
    return MANAGER_LEVELS.has(context.accessLevel);
  } catch (error) {
    return false;
  }
}

async function loadScoredReviews(reviewerId, monthlyKeys) {
  const rows = (await pool.query(
    `SELECT s.work_item_id,s.work_item_type,s.reviewer_timeliness_score,s.period_key,s.objective_name,s.calculated_at,
      COALESCE(t.ticket_ref,j.journal_reference,rc.reconciliation_reference,ct.task_reference) reference,
      COALESCE(t.title,j.description,rc.control_name,ct.title) title,
      COALESCE(tr.submitted_at,ja.reviewed_at,rc.reviewed_at,ct.reviewed_at) review_completed_at
     FROM finance_kpi_item_scores s
     LEFT JOIN tickets t ON s.work_item_type='ticket' AND t.id=s.work_item_id
     LEFT JOIN finance_journals j ON s.work_item_type='journal' AND j.id=s.work_item_id
     LEFT JOIN finance_reconciliations rc ON s.work_item_type='reconciliation' AND rc.id=s.work_item_id
     LEFT JOIN finance_close_tasks ct ON s.work_item_type='month_end' AND ct.id=s.work_item_id
     LEFT JOIN LATERAL (SELECT r.submitted_at FROM finance_task_reviews r WHERE r.ticket_id=s.work_item_id ORDER BY r.id DESC LIMIT 1) tr ON s.work_item_type='ticket'
     LEFT JOIN LATERAL (SELECT a.created_at reviewed_at FROM finance_journal_workflow_audits a WHERE a.journal_id=s.work_item_id AND a.action='approve' ORDER BY a.created_at DESC LIMIT 1) ja ON s.work_item_type='journal'
     WHERE s.reviewer_user_id=$1::bigint AND s.period_key=ANY($2::text[]) AND s.reviewer_timeliness_score IS NOT NULL
     ORDER BY s.calculated_at DESC`,
    [reviewerId, monthlyKeys]
  )).rows;
  return rows.map((row) => ({
    itemId: Number(row.work_item_id),
    itemType: row.work_item_type,
    reference: row.reference ?? null,
    title: row.title ?? null,
    reviewerTimelinessScore: Number(row.reviewer_timeliness_score),
    periodKey: row.period_key,
    objectiveName: row.objective_name ?? null,
    reviewCompletedAt: row.review_completed_at ?? null
  }));
}

const PENDING_ARMS = {
  journal: (reviewerId, defaultSlaHours) => pool.query(
    `SELECT j.id item_id,'journal' item_type,j.journal_reference reference,j.description title,
      COALESCE(lvl.reviewer_user_id,lvl.approver_user_id) reviewer_user_id,
      j.submitted_at awaiting_review_since,
      (j.submitted_at+(COALESCE(NULLIF(lvl.review_sla_hours,0),$2)*INTERVAL '1 hour')) review_deadline
     FROM finance_journals j
     JOIN LATERAL (SELECT l.reviewer_user_id,l.approver_user_id,l.review_sla_hours FROM finance_journal_workflow_chains c JOIN finance_journal_workflow_levels l ON l.chain_id=c.id AND l.sequence_number=1 AND l.active=TRUE JOIN finance_employee_responsibilities fr ON fr.finance_function=c.finance_function AND fr.active=TRUE WHERE c.work_item_type='journal' AND c.confidentiality_level=j.confidentiality_level AND c.active=TRUE AND fr.user_id=j.preparer_user_id LIMIT 1) lvl ON TRUE
     WHERE j.status IN ('submitted','under_review') AND j.submitted_at IS NOT NULL
      AND COALESCE(lvl.reviewer_user_id,lvl.approver_user_id)=$1::bigint
      AND (j.submitted_at+(COALESCE(NULLIF(lvl.review_sla_hours,0),$2)*INTERVAL '1 hour'))<NOW()`,
    [reviewerId, defaultSlaHours]
  ),
  ticket: (reviewerId, defaultSlaHours) => pool.query(
    `SELECT t.id item_id,'ticket' item_type,t.ticket_ref reference,t.title title,
      tr.reviewer_user_id,tr.created_at awaiting_review_since,
      (tr.created_at+($2*INTERVAL '1 hour')) review_deadline
     FROM tickets t
     JOIN LATERAL (SELECT r.reviewer_user_id,r.created_at,r.submitted_at FROM finance_task_reviews r WHERE r.ticket_id=t.id ORDER BY r.id DESC LIMIT 1) tr ON TRUE
     WHERE tr.submitted_at IS NULL AND tr.reviewer_user_id=$1::bigint AND tr.created_at IS NOT NULL
      AND (tr.created_at+($2*INTERVAL '1 hour'))<NOW()`,
    [reviewerId, defaultSlaHours]
  ),
  reconciliation: (reviewerId, defaultSlaHours) => pool.query(
    `SELECT r.id item_id,'reconciliation' item_type,r.reconciliation_reference reference,r.control_name title,
      r.reviewer_user_id,r.created_at awaiting_review_since,
      (r.created_at+($2*INTERVAL '1 hour')) review_deadline
     FROM finance_reconciliations r
     WHERE r.reviewer_user_id=$1::bigint AND r.reviewed_at IS NULL AND r.created_at IS NOT NULL
      AND (r.created_at+($2*INTERVAL '1 hour'))<NOW()`,
    [reviewerId, defaultSlaHours]
  ),
  month_end: (reviewerId, defaultSlaHours) => pool.query(
    `SELECT t.id item_id,'month_end' item_type,t.task_reference reference,t.title title,
      t.reviewer_user_id,t.created_at awaiting_review_since,
      (t.created_at+($2*INTERVAL '1 hour')) review_deadline
     FROM finance_close_tasks t
     WHERE t.reviewer_user_id=$1::bigint AND t.reviewed_at IS NULL AND t.created_at IS NOT NULL
      AND (t.created_at+($2*INTERVAL '1 hour'))<NOW()`,
    [reviewerId, defaultSlaHours]
  )
};

async function loadPendingOverdueReviews(reviewerId, defaultSlaHours) {
  const pending = [];
  for (const type of Object.keys(PENDING_ARMS)) {
    try {
      const rows = (await PENDING_ARMS[type](reviewerId, defaultSlaHours)).rows;
      for (const row of rows) {
        pending.push({
          itemId: Number(row.item_id),
          itemType: row.item_type,
          reference: row.reference ?? null,
          title: row.title ?? null,
          reviewerUserId: row.reviewer_user_id != null ? Number(row.reviewer_user_id) : reviewerId,
          awaitingReviewSince: row.awaiting_review_since ?? null,
          reviewDeadline: row.review_deadline ?? null,
          overdueReview: true
        });
      }
    } catch (error) {
      if (!["42P01", "42703"].includes(error.code)) throw error;
      console.warn(`Reviewer KPI projection omitted pending ${type} reviews: ${error.message}`);
    }
  }
  return pending;
}

async function getReviewerKpiProjection({ reviewerUserId, periodKey, requestingUser } = {}) {
  if (requestingUser == null || !Number.isFinite(Number(requestingUser.id))) throw fail(403, "PROJECTION_REQUESTER_REQUIRED", "A requesting user is required.");
  if (reviewerUserId == null || !Number.isFinite(Number(reviewerUserId))) throw fail(400, "REVIEWER_USER_ID_REQUIRED", "reviewerUserId is required.");
  const reviewerId = Number(reviewerUserId);
  const requesterId = Number(requestingUser.id);
  if (reviewerId !== requesterId && !(await holdsManagerScope(requesterId))) {
    throw fail(403, "FINANCE_KPI_OWNER_SCOPE_DENIED", "Reviewer KPI projections are visible only to the reviewer or Finance management.");
  }
  const resolvedPeriod = financePeriodService.resolvePeriodKey(periodKey);
  const items = await loadScoredReviews(reviewerId, resolvedPeriod.monthlyKeys);
  const configuredSla = Number(config.financeAdvanced.defaultReviewSlaHours);
  const defaultSlaHours = Number.isFinite(configuredSla) && configuredSla > 0 ? configuredSla : null;
  const pendingOverdueReviews = await loadPendingOverdueReviews(reviewerId, defaultSlaHours);
  const values = items.map((item) => item.reviewerTimelinessScore);
  const denominator = values.length + pendingOverdueReviews.length;
  const projectedScore = denominator > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / denominator) * 100) / 100 : null;
  const atRisk = pendingOverdueReviews.length > 0 || (projectedScore != null && projectedScore < TARGET_THRESHOLD);
  return {
    reviewerUserId: reviewerId,
    periodKey: resolvedPeriod.periodKey,
    reviewerObjectiveName: config.financeAdvanced.reviewerObjectiveName,
    items,
    pendingOverdueReviews,
    projectedScore,
    targetThreshold: TARGET_THRESHOLD,
    atRisk,
    generatedAt: new Date().toISOString()
  };
}

module.exports = { getReviewerKpiProjection };