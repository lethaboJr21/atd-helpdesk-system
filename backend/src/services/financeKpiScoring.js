const pool = require("../db/pool");
const config = require("../config");
const financeKpiConfigService = require("./financeKpiConfigService");
const financePeriodService = require("./financePeriodService");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

const OBJECTIVE_WEIGHTS = {
  "Month-End Close": 30,
  "Reconciliation Control": 25,
  "Cut-off Accuracy": 15,
  "Financial Reporting Quality": 20,
  "Internal Finance Service Delivery": 10
};

const COMPLETE_STATUSES = new Set(["resolved","closed","completed","accepted","cancelled","canceled"]);
const WORK_ITEM_TYPES = new Set(["ticket","journal","reconciliation","month_end"]);

async function calculateTimeliness({completedAt, effectiveDueAt, originalDueAt, hasApprovedExtension, dependencyType, latePenaltyPct, addBackPct}) {
  if (!completedAt || !effectiveDueAt) return null;
  const completed = new Date(completedAt).getTime();
  const effectiveDue = new Date(effectiveDueAt).getTime();
  if (completed <= effectiveDue) return 100;
  if (hasApprovedExtension) {
    if (dependencyType === "external" || dependencyType === "other") {
      return addBackPct ?? config.financeAdvanced.crossDepartmentAddBackPct;
    }
    return 100;
  }
  return 100 - (latePenaltyPct ?? config.financeAdvanced.lateSubmissionPenaltyPct);
}

async function resolveScoringParameters(financeFunction, cache) {
  const defaults = { latePenaltyPct: config.financeAdvanced.lateSubmissionPenaltyPct, addBackPct: config.financeAdvanced.crossDepartmentAddBackPct };
  if (financeFunction == null || String(financeFunction).trim() === "") return { ...defaults, source: "env_defaults" };
  const functionKey = String(financeFunction).trim();
  if (cache && cache.has(functionKey)) return cache.get(functionKey);
  let row = null;
  try {
    row = (await pool.query(
      `SELECT late_submission_penalty_pct,cross_department_add_back_pct FROM finance_scoring_parameter_overrides WHERE finance_function=$1`,
      [functionKey]
    )).rows[0] ?? null;
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) throw error;
  }
  const resolved = row == null
    ? { ...defaults, source: "env_defaults" }
    : {
        latePenaltyPct: row.late_submission_penalty_pct ?? defaults.latePenaltyPct,
        addBackPct: row.cross_department_add_back_pct ?? defaults.addBackPct,
        source: "function_override"
      };
  if (cache) cache.set(functionKey, resolved);
  return resolved;
}

async function resolveQualitySource({workItemId, workItemType}) {
  let allocation = null;
  try {
    allocation = (await pool.query(
      `SELECT rating FROM finance_manager_quality_allocations WHERE work_item_id=$1 AND work_item_type=$2`,
      [workItemId, workItemType]
    )).rows[0] ?? null;
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) throw error;
  }
  if (allocation != null) return { qualityRating: Number(allocation.rating), source: "manager_allocation" };
  if (workItemType === "ticket") {
    try {
      const review = (await pool.query(
        `SELECT rating FROM finance_task_reviews WHERE ticket_id=$1 ORDER BY id DESC LIMIT 1`,
        [workItemId]
      )).rows[0];
      if (review != null && review.rating != null) return { qualityRating: Number(review.rating), source: "task_review" };
    } catch (error) {
      if (!["42P01", "42703"].includes(error.code)) throw error;
    }
  }
  return { qualityRating: null, source: null };
}

async function calculateItemScore(timelinessScore, qualityScore) {
  const t = timelinessScore != null ? Number(timelinessScore) : 0;
  const q = qualityScore != null ? Number(qualityScore) : 0;
  return Math.round((t * 0.50 + q * 0.50) * 100) / 100;
}


async function calculateReviewerTimeliness({reviewCompletedAt, reviewDeadline}) {
  if (!reviewCompletedAt || !reviewDeadline) return null;
  return new Date(reviewCompletedAt).getTime() <= new Date(reviewDeadline).getTime() ? 100 : 0;
}

async function scoreWorkItem({workItemId, workItemType, completedAt, effectiveDueAt, originalDueAt, hasApprovedExtension, dependencyType, latePenaltyPct, addBackPct, qualityRating, qualitySource, reviewerUserId, reviewCompletedAt, reviewDeadline, periodKey, objectiveName, reason, actorUserId}) {
  const timelinessScore = await calculateTimeliness({completedAt, effectiveDueAt, originalDueAt, hasApprovedExtension, dependencyType, latePenaltyPct, addBackPct});
  const qualityScore = qualityRating != null ? Number(qualityRating) * 20 : null;
  const itemScore = qualityScore != null ? await calculateItemScore(timelinessScore, qualityScore) : null;
  const reviewerTimelinessScore = reviewerUserId ? await calculateReviewerTimeliness({reviewCompletedAt, reviewDeadline}) : null;

  const existing = (await pool.query(
    `SELECT timeliness_score,quality_score,item_score,reviewer_timeliness_score FROM finance_kpi_item_scores WHERE work_item_id=$1 AND work_item_type=$2 AND period_key=$3`,
    [workItemId, workItemType, periodKey]
  )).rows[0];

  const mergedReviewerScore = reviewerTimelinessScore ?? (existing ? existing.reviewer_timeliness_score : null);
  const reviewerChanged = existing != null && existing.reviewer_timeliness_score != mergedReviewerScore;
  if (existing && existing.timeliness_score == timelinessScore && existing.quality_score == (qualityScore ?? existing.quality_score) && !reviewerChanged) {
    return {unchanged: true, score: existing};
  }

  const effectiveReason = reason ?? (reviewerChanged && reviewerUserId ? "review_completed" : "recalculation");

  if (existing) {
    await pool.query(
      `INSERT INTO finance_kpi_score_audit(work_item_id,work_item_type,previous_timeliness,previous_quality,previous_item_score,new_timeliness,new_quality,new_item_score,reason,actor_user_id,previous_reviewer_timeliness,new_reviewer_timeliness)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [workItemId, workItemType, existing.timeliness_score, existing.quality_score, existing.item_score, timelinessScore, qualityScore, itemScore, effectiveReason, actorUserId ?? null, reviewerChanged ? existing.reviewer_timeliness_score : null, reviewerChanged ? mergedReviewerScore : null]
    );
  }

  const result = await pool.query(
    `INSERT INTO finance_kpi_item_scores(work_item_id,work_item_type,timeliness_score,quality_score,item_score,reviewer_user_id,reviewer_timeliness_score,period_key,objective_name,calculated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT ON CONSTRAINT finance_kpi_item_scores_work_item_id_work_item_type_period_key_key DO UPDATE SET
       timeliness_score=EXCLUDED.timeliness_score,quality_score=COALESCE(EXCLUDED.quality_score,finance_kpi_item_scores.quality_score),
       item_score=COALESCE(EXCLUDED.item_score,finance_kpi_item_scores.item_score),reviewer_user_id=COALESCE(EXCLUDED.reviewer_user_id,finance_kpi_item_scores.reviewer_user_id),
       reviewer_timeliness_score=COALESCE(EXCLUDED.reviewer_timeliness_score,finance_kpi_item_scores.reviewer_timeliness_score),
       objective_name=COALESCE(EXCLUDED.objective_name,finance_kpi_item_scores.objective_name),calculated_at=NOW(),updated_at=NOW()
     RETURNING *`,
    [workItemId, workItemType, timelinessScore ?? 0, qualityScore, itemScore, reviewerUserId, reviewerTimelinessScore, periodKey, objectiveName]
  );
  return {unchanged: false, score: result.rows[0]};
}

function ticketSelectionArm(idPredicate) {
  return `SELECT 'ticket' AS type, t.id, t.assigned_to_user_id AS owner, t.effective_due_at, t.original_due_at, t.due_at, fto.kpi_objective, fto.kpi_period,
   t.status, t.closed_at AS completed_at, (SELECT rating FROM finance_task_reviews r WHERE r.ticket_id=t.id ORDER BY r.id DESC LIMIT 1) quality_rating,
   (SELECT submitted_at FROM finance_task_reviews r WHERE r.ticket_id=t.id ORDER BY r.id DESC LIMIT 1) review_completed_at,
   (SELECT reviewer_user_id FROM finance_task_reviews r WHERE r.ticket_id=t.id ORDER BY r.id DESC LIMIT 1) reviewer_user_id,
   (SELECT submitted_at FROM finance_task_reviews r WHERE r.ticket_id=t.id ORDER BY r.id DESC LIMIT 1) review_requested_at,
   ext.dependency_type, fto.finance_function, NULL::integer AS review_sla_hours
   FROM tickets t JOIN finance_ticket_operations fto ON fto.ticket_id=t.id
   LEFT JOIN LATERAL (SELECT e.dependency_type FROM finance_extension_requests e WHERE e.work_item_id=t.id AND e.work_item_type='ticket' AND e.status='approved' ORDER BY e.decided_at DESC LIMIT 1) ext ON TRUE
   WHERE fto.kpi_objective IS NOT NULL AND ($1::text[] IS NULL OR fto.kpi_period=ANY($1))${idPredicate}`;
}

function monthEndSelectionArm(idPredicate) {
  return `SELECT 'month_end' AS type, t.id, t.owner_user_id, t.effective_due_at, t.original_due_at, t.due_at, t.kpi_objective, t.kpi_period,
   t.status, t.closed_at AS completed_at, NULL AS quality_rating, t.reviewed_at AS review_completed_at,
   t.reviewer_user_id, t.created_at AS review_requested_at, ext.dependency_type, t.finance_function, NULL::integer AS review_sla_hours
   FROM finance_close_tasks t
   LEFT JOIN LATERAL (SELECT e.dependency_type FROM finance_extension_requests e WHERE e.work_item_id=t.id AND e.work_item_type='month_end' AND e.status='approved' ORDER BY e.decided_at DESC LIMIT 1) ext ON TRUE
   WHERE t.kpi_objective IS NOT NULL AND ($1::text[] IS NULL OR t.kpi_period=ANY($1))${idPredicate}`;
}

function journalSelectionArm(idPredicate) {
  return `SELECT 'journal' AS type, j.id, j.preparer_user_id AS owner, j.effective_due_at, j.original_due_at, j.due_at, j.kpi_objective, j.kpi_period,
   j.status, j.submitted_at AS completed_at, NULL AS quality_rating,
   appr.actor_user_id AS reviewer_user_id, appr.created_at AS review_completed_at, j.submitted_at AS review_requested_at,
   ext.dependency_type, NULL AS finance_function, lvl.review_sla_hours AS review_sla_hours
   FROM finance_journals j
   LEFT JOIN LATERAL (SELECT a.actor_user_id, a.created_at FROM finance_journal_workflow_audits a WHERE a.journal_id=j.id AND a.action='approve' ORDER BY a.created_at DESC LIMIT 1) appr ON TRUE
   LEFT JOIN LATERAL (SELECT e.dependency_type FROM finance_extension_requests e WHERE e.work_item_id=j.id AND e.work_item_type='journal' AND e.status='approved' ORDER BY e.decided_at DESC LIMIT 1) ext ON TRUE
   LEFT JOIN LATERAL (SELECT l.review_sla_hours FROM finance_journal_workflow_chains c JOIN finance_journal_workflow_levels l ON l.chain_id=c.id AND l.sequence_number=1 AND l.active=TRUE JOIN finance_employee_responsibilities fr ON fr.finance_function=c.finance_function AND fr.active=TRUE WHERE c.work_item_type='journal' AND c.confidentiality_level=j.confidentiality_level AND c.active=TRUE AND fr.user_id=j.preparer_user_id LIMIT 1) lvl ON TRUE
   WHERE j.kpi_objective IS NOT NULL AND j.status IN ('approved','published','posted') AND j.submitted_at IS NOT NULL
   AND COALESCE(j.effective_due_at, j.original_due_at, j.due_at) IS NOT NULL
   AND ($1::text[] IS NULL OR j.kpi_period=ANY($1))${idPredicate}`;
}

function reconciliationSelectionArm(idPredicate) {
  return `SELECT 'reconciliation' AS type, r.id, r.owner_user_id AS owner, r.effective_due_at, r.original_due_at, r.due_at, r.kpi_objective, r.kpi_period,
   r.status, COALESCE(r.reviewed_at, r.approved_at, r.closed_at) AS completed_at, NULL AS quality_rating,
   r.reviewer_user_id, r.reviewed_at AS review_completed_at, r.created_at AS review_requested_at,
   ext.dependency_type, NULL AS finance_function, NULL::integer AS review_sla_hours
   FROM finance_reconciliations r
   LEFT JOIN LATERAL (SELECT e.dependency_type FROM finance_extension_requests e WHERE e.work_item_id=r.id AND e.work_item_type='reconciliation' AND e.status='approved' ORDER BY e.decided_at DESC LIMIT 1) ext ON TRUE
   WHERE r.kpi_objective IS NOT NULL AND r.status IN ('approved','posted')
   AND COALESCE(r.reviewed_at, r.approved_at, r.closed_at) IS NOT NULL
   AND COALESCE(r.effective_due_at, r.original_due_at, r.due_at) IS NOT NULL
   AND ($1::text[] IS NULL OR r.kpi_period=ANY($1))${idPredicate}`;
}

async function scoreSelectionRow(item, {reason, actorUserId, parameterCache, warnState}) {
  const completedAt = item.type === "ticket" || item.type === "month_end"
    ? (COMPLETE_STATUSES.has(String(item.status).toLowerCase()) ? (item.completed_at || new Date().toISOString()) : null)
    : item.completed_at;
  const hasApprovedExtension = item.effective_due_at && item.original_due_at && new Date(item.effective_due_at).getTime() !== new Date(item.original_due_at).getTime();
  const parameters = await resolveScoringParameters(item.finance_function, parameterCache);
  const quality = await resolveQualitySource({workItemId: item.id, workItemType: item.type});
  const slaHours = Number(item.review_sla_hours ?? config.financeAdvanced.defaultReviewSlaHours);
  let reviewDeadline = null;
  if (item.review_requested_at != null && Number.isFinite(slaHours) && slaHours > 0) {
    reviewDeadline = new Date(new Date(item.review_requested_at).getTime() + slaHours * 3600000).toISOString();
  } else if (item.reviewer_user_id != null && warnState && !warnState.reviewerSlaWarningIssued) {
    warnState.reviewerSlaWarningIssued = true;
    console.warn("KPI scoring: reviewer score withheld because no review SLA is resolvable (EX-6.2.1).");
  }
  return scoreWorkItem({
    workItemId: item.id, workItemType: item.type, completedAt,
    effectiveDueAt: item.effective_due_at || item.due_at, originalDueAt: item.original_due_at || item.due_at,
    hasApprovedExtension, dependencyType: item.dependency_type,
    latePenaltyPct: parameters.latePenaltyPct, addBackPct: parameters.addBackPct,
    qualityRating: quality.qualityRating, qualitySource: quality.source,
    reviewerUserId: item.reviewer_user_id, reviewCompletedAt: item.review_completed_at, reviewDeadline,
    periodKey: item.kpi_period, objectiveName: item.kpi_objective, reason, actorUserId
  });
}

async function aggregateObjectiveScores({employeeUserId, periodKey}) {
  const resolvedPeriod = periodKey != null ? financePeriodService.resolvePeriodKey(periodKey) : null;
  const monthlyKeys = resolvedPeriod != null ? resolvedPeriod.monthlyKeys : [];
  const objectives = await pool.query(`SELECT name,weight FROM finance_kpi_objectives WHERE active=TRUE ORDER BY weight DESC`);
  const totalWeight = objectives.rows.reduce((s, o) => s + Number(o.weight), 0);
  if (totalWeight === 0) return {objectives: [], overallScore: null, weightWarning: true, gradingBand: null, riskProjection: null};

  const weightWarning = Math.abs(totalWeight - 100) > 0.01;
  const normaliser = totalWeight > 0 ? 100 / totalWeight : 1;
  const results = [];
  let totalItemCount = 0;

  for (const obj of objectives.rows) {
    const scores = (await pool.query(
      `SELECT item_score FROM finance_kpi_item_scores WHERE objective_name=$1 AND period_key=ANY($2) AND work_item_id IN (
        SELECT fto.ticket_id FROM finance_ticket_operations fto JOIN tickets t ON t.id=fto.ticket_id WHERE t.assigned_to_user_id=$3::bigint AND fto.kpi_objective=$1
        UNION SELECT id FROM finance_journals WHERE preparer_user_id=$3::bigint AND kpi_objective=$1
        UNION SELECT id FROM finance_reconciliations WHERE owner_user_id=$3::bigint AND kpi_objective=$1
        UNION SELECT id FROM finance_close_tasks WHERE owner_user_id=$3::bigint AND kpi_objective=$1
      )`, [obj.name, monthlyKeys, employeeUserId]
    )).rows;
    const values = scores.map((r) => Number(r.item_score || 0));
    if (obj.name === config.financeAdvanced.reviewerObjectiveName) {
      const reviewerScores = (await pool.query(
        `SELECT reviewer_timeliness_score FROM finance_kpi_item_scores WHERE objective_name=$1 AND reviewer_user_id=$2::bigint AND period_key=ANY($3)`,
        [obj.name, employeeUserId, monthlyKeys]
      )).rows;
      for (const r of reviewerScores) values.push(Number(r.reviewer_timeliness_score || 0));
    }
    const periodScore = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const normalisedWeight = Number(obj.weight) * normaliser;
    totalItemCount += values.length;

    await pool.query(
      `INSERT INTO finance_kpi_objective_aggregates(objective_name,weight,period_score,employee_user_id,period_key,calculated_at)
       VALUES($1,$2,$3,$4,$5,NOW())
       ON CONFLICT(objective_name,employee_user_id,period_key) DO UPDATE SET weight=EXCLUDED.weight,period_score=EXCLUDED.period_score,calculated_at=NOW(),updated_at=NOW()`,
      [obj.name, normalisedWeight, Math.round(periodScore * 100) / 100, employeeUserId, periodKey]
    );
    results.push({name: obj.name, weight: normalisedWeight, periodScore: Math.round(periodScore * 100) / 100, itemCount: values.length});
  }

  if (resolvedPeriod != null && resolvedPeriod.cadence !== "monthly" && totalItemCount === 0) {
    return {objectives: results, overallScore: null, weightWarning, gradingBand: null, riskProjection: null, reason: "insufficient_data"};
  }

  const overallScore = results.reduce((s, r) => s + r.periodScore * r.weight / 100, 0);
  const roundedOverall = Math.round(overallScore * 100) / 100;
  let gradingBand = null;
  try {
    const functionConfig = (await pool.query(
      `SELECT g.id FROM finance_grading_band_configs g JOIN finance_functions f ON f.id=g.finance_function_id
       JOIN finance_employee_responsibilities fr ON fr.finance_function=f.name AND fr.active=TRUE
       WHERE fr.user_id=$1::bigint AND g.active=TRUE LIMIT 1`,
      [employeeUserId]
    )).rows[0];
    gradingBand = await financeKpiConfigService.assignGradingBand(roundedOverall, functionConfig?.id ?? null);
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) console.warn("Grading band assignment skipped:", error.message);
  }
  const targetThreshold = 80;
  const shortfall = Math.round((targetThreshold - roundedOverall) * 100) / 100;
  const riskProjection = {projectedScore: roundedOverall, targetThreshold, shortfall, atRisk: shortfall > 0};
  return {objectives: results, overallScore: roundedOverall, weightWarning, gradingBand, riskProjection};
}

async function projectKpiRisk({employeeUserId, periodKey, targetThreshold = 80}) {
  const current = await aggregateObjectiveScores({employeeUserId, periodKey});
  if (current.overallScore == null) return {canProject: false, reason: "insufficient_data"};
  const shortfall = targetThreshold - current.overallScore;
  return {
    canProject: true,
    projectedScore: current.overallScore,
    targetThreshold,
    shortfall: Math.round(shortfall * 100) / 100,
    atRisk: shortfall > 0,
    objectives: current.objectives
  };
}

async function recalculateAllScores(periodKey, options = {}) {
  const reason = options.reason ?? "recalculation";
  const actorUserId = options.actorUserId ?? null;
  const periodFilter = periodKey != null && String(periodKey).trim() !== "" ? financePeriodService.containedMonthlyKeys(periodKey) : null;
  const parameterCache = new Map();
  const skipped = {};
  const workItems = [];
  const selections = [
    { key: "tickets_and_month_end", sql: `${ticketSelectionArm("")}\nUNION ALL\n${monthEndSelectionArm("")}`, params: [periodFilter] },
    { key: "journals", sql: journalSelectionArm(""), params: [periodFilter] },
    { key: "reconciliations", sql: reconciliationSelectionArm(""), params: [periodFilter] }
  ];
  for (const selection of selections) {
    try {
      workItems.push(...(await pool.query(selection.sql, selection.params)).rows);
    } catch (error) {
      if (!["42P01", "42703"].includes(error.code)) throw error;
      skipped[selection.key] = error.code;
      console.warn(`KPI recalculation skipped ${selection.key}: ${error.message}`);
    }
  }
  let recalculated = 0;
  const warnState = { reviewerSlaWarningIssued: false };
  for (const item of workItems) {
    const result = await scoreSelectionRow(item, {reason, actorUserId, parameterCache, warnState});
    if (!result.unchanged) recalculated++;
  }
  const response = { totalItems: workItems.length, recalculated };
  if (Object.keys(skipped).length) response.skipped = skipped;
  return response;
}

async function recalculateWorkItemScore({workItemId, workItemType, reason}) {
  if (workItemId == null) throw fail(400, "WORK_ITEM_ID_REQUIRED", "workItemId is required.");
  if (!WORK_ITEM_TYPES.has(workItemType)) throw fail(400, "INVALID_WORK_ITEM_TYPE", "workItemType must be ticket, journal, reconciliation or month_end.");
  const arms = {
    ticket: { sql: ticketSelectionArm(" AND t.id=$2::bigint"), params: [null, workItemId] },
    month_end: { sql: monthEndSelectionArm(" AND t.id=$2::bigint"), params: [null, workItemId] },
    journal: { sql: journalSelectionArm(" AND j.id=$2::bigint"), params: [null, workItemId] },
    reconciliation: { sql: reconciliationSelectionArm(" AND r.id=$2::bigint"), params: [null, workItemId] }
  };
  const arm = arms[workItemType];
  let rows = [];
  try {
    rows = (await pool.query(arm.sql, arm.params)).rows;
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) throw error;
    return { unchanged: true, score: null, skipped: error.code };
  }
  if (!rows.length) return { unchanged: true, score: null };
  return scoreSelectionRow(rows[0], {reason: reason ?? "recalculation", actorUserId: null, parameterCache: new Map(), warnState: {reviewerSlaWarningIssued: false}});
}

module.exports = {calculateTimeliness, resolveScoringParameters, resolveQualitySource, calculateItemScore, calculateReviewerTimeliness, scoreWorkItem, aggregateObjectiveScores, projectKpiRisk, recalculateAllScores, recalculateWorkItemScore, OBJECTIVE_WEIGHTS};