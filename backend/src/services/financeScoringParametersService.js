const pool = require("../db/pool");
const config = require("../config");
const financeKpiScoring = require("./financeKpiScoring");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

async function queryTolerant(sql, params) {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return [];
    throw error;
  }
}

async function recordGovernance(recordId, action, actorUserId, detail) {
  try {
    await pool.query(
      `INSERT INTO finance_governance_actions(record_type,record_id,action,actor_user_id,reason,detail) VALUES('scoring_parameter_override',$1,$2,$3,NULL,$4::jsonb)`,
      [recordId, action, actorUserId ?? null, JSON.stringify(detail ?? {})]
    );
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) console.warn("Scoring parameter governance audit failed:", error.message);
  }
}

function validatePct(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw fail(400, "SCORING_PARAMETER_OUT_OF_RANGE", `${field} must be an integer between 0 and 100.`);
  }
  return n;
}

function mapOverride(row) {
  return {
    id: row.id,
    financeFunction: row.finance_function,
    lateSubmissionPenaltyPct: row.late_submission_penalty_pct,
    crossDepartmentAddBackPct: row.cross_department_add_back_pct,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getScoringParameters() {
  const overrides = await queryTolerant(`SELECT * FROM finance_scoring_parameter_overrides ORDER BY finance_function`);
  return {
    defaults: {
      lateSubmissionPenaltyPct: config.financeAdvanced.lateSubmissionPenaltyPct,
      crossDepartmentAddBackPct: config.financeAdvanced.crossDepartmentAddBackPct
    },
    overrides: overrides.map(mapOverride),
    reviewSla: {
      defaultReviewSlaHours: config.financeAdvanced.defaultReviewSlaHours,
      reviewerObjectiveName: config.financeAdvanced.reviewerObjectiveName
    }
  };
}

async function setFunctionOverride({financeFunction, lateSubmissionPenaltyPct, crossDepartmentAddBackPct, updatedBy}) {
  if (financeFunction == null || String(financeFunction).trim() === "") {
    throw fail(400, "SCORING_PARAMETER_FIELDS_REQUIRED", "A finance function is required.");
  }
  const hasLate = lateSubmissionPenaltyPct != null;
  const hasAddBack = crossDepartmentAddBackPct != null;
  if (!hasLate && !hasAddBack) {
    throw fail(400, "SCORING_PARAMETER_FIELDS_REQUIRED", "At least one of lateSubmissionPenaltyPct or crossDepartmentAddBackPct is required.");
  }
  const latePct = hasLate ? validatePct(lateSubmissionPenaltyPct, "lateSubmissionPenaltyPct") : null;
  const addBackPct = hasAddBack ? validatePct(crossDepartmentAddBackPct, "crossDepartmentAddBackPct") : null;
  const previous = (await queryTolerant(`SELECT * FROM finance_scoring_parameter_overrides WHERE finance_function=$1`, [financeFunction]))[0] ?? null;
  const result = await pool.query(
    `INSERT INTO finance_scoring_parameter_overrides(finance_function,late_submission_penalty_pct,cross_department_add_back_pct,updated_by,updated_at)
     VALUES($1,$2,$3,$4::bigint,NOW())
     ON CONFLICT(finance_function) DO UPDATE SET
       late_submission_penalty_pct=COALESCE(EXCLUDED.late_submission_penalty_pct,finance_scoring_parameter_overrides.late_submission_penalty_pct),
       cross_department_add_back_pct=COALESCE(EXCLUDED.cross_department_add_back_pct,finance_scoring_parameter_overrides.cross_department_add_back_pct),
       updated_by=EXCLUDED.updated_by,updated_at=NOW()
     RETURNING *`,
    [financeFunction, latePct, addBackPct, updatedBy ?? null]
  );
  const override = mapOverride(result.rows[0]);
  await recordGovernance(override.id, "set", updatedBy, {
    financeFunction,
    previous: previous == null ? null : { lateSubmissionPenaltyPct: previous.late_submission_penalty_pct, crossDepartmentAddBackPct: previous.cross_department_add_back_pct },
    new: { lateSubmissionPenaltyPct: override.lateSubmissionPenaltyPct, crossDepartmentAddBackPct: override.crossDepartmentAddBackPct }
  });
  const recalculation = await financeKpiScoring.recalculateAllScores(null, { reason: "penalty_configuration_change" });
  return { override, recalculation };
}

async function clearFunctionOverride(financeFunction, clearedBy) {
  if (financeFunction == null || String(financeFunction).trim() === "") {
    throw fail(400, "SCORING_PARAMETER_FIELDS_REQUIRED", "A finance function is required.");
  }
  const result = await pool.query(`DELETE FROM finance_scoring_parameter_overrides WHERE finance_function=$1 RETURNING *`, [financeFunction]);
  if (!result.rowCount) {
    throw fail(404, "SCORING_PARAMETER_OVERRIDE_NOT_FOUND", "No scoring parameter override is configured for this finance function.");
  }
  const override = mapOverride(result.rows[0]);
  await recordGovernance(override.id, "cleared", clearedBy, {
    financeFunction,
    previous: { lateSubmissionPenaltyPct: override.lateSubmissionPenaltyPct, crossDepartmentAddBackPct: override.crossDepartmentAddBackPct },
    new: null
  });
  const recalculation = await financeKpiScoring.recalculateAllScores(null, { reason: "penalty_configuration_change" });
  return { cleared: true, recalculation };
}

module.exports = { getScoringParameters, setFunctionOverride, clearFunctionOverride };