const pool = require("../db/pool");
const { sendEmail } = require("./email");
const financePeriodService = require("./financePeriodService");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const DEFAULT_BANDS = { excellent: 90, meets: 80, below: 60 };

async function createKpiDefinition({name, description, financeFunctionId, targetValue, unit, weight, periodKey, measurementCadence, gradingBandConfigId, createdBy}) {
  if (!name || !periodKey || !createdBy) throw fail(400, "KPI_DEFINITION_FIELDS_REQUIRED", "Name, periodKey and createdBy are required.");
  const cadence = measurementCadence ?? "monthly";
  financePeriodService.assertValidCadence(cadence);
  financePeriodService.resolvePeriodKey(periodKey);
  const w = Number(weight ?? 0);
  if (!Number.isFinite(w) || w < 0 || w > 100) throw fail(400, "KPI_WEIGHT_OUT_OF_RANGE", "KPI weight must be between 0 and 100.");
  if (financeFunctionId != null) {
    const fn = await pool.query(`SELECT id FROM finance_functions WHERE id=$1`, [financeFunctionId]);
    if (!fn.rowCount) throw fail(400, "FINANCE_FUNCTION_NOT_FOUND", "The specified finance function does not exist.");
  }
  const duplicate = await pool.query(
    `SELECT id FROM finance_kpi_definitions WHERE name=$1 AND finance_function_id IS NOT DISTINCT FROM $2::bigint AND period_key=$3 AND active=TRUE`,
    [name, financeFunctionId ?? null, periodKey]
  );
  if (duplicate.rowCount) throw fail(409, "KPI_DEFINITION_DUPLICATE", "An active KPI definition with this name, function and period already exists.");
  const result = await pool.query(
    `INSERT INTO finance_kpi_definitions(name,description,finance_function_id,target_value,unit,weight,period_key,measurement_cadence,grading_band_config_id,active,created_by)
     VALUES($1,$2,$3::bigint,$4::numeric,$5,$6,$7,$8,$9::bigint,TRUE,$10::bigint) RETURNING *`,
    [name, description ?? null, financeFunctionId ?? null, targetValue ?? null, unit ?? null, w, periodKey, cadence, gradingBandConfigId ?? null, createdBy]
  );
  return result.rows[0];
}

async function updateKpiDefinition(id, patch, updatedBy) {
  const fields = [];
  const params = [];
  const map = { name: "name", description: "description", financeFunctionId: "finance_function_id", targetValue: "target_value", unit: "unit", weight: "weight", periodKey: "period_key", gradingBandConfigId: "grading_band_config_id", active: "active", measurementCadence: "measurement_cadence" };
  for (const [key, column] of Object.entries(map)) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, key)) {
      if (key === "weight") {
        const w = Number(patch.weight);
        if (!Number.isFinite(w) || w < 0 || w > 100) throw fail(400, "KPI_WEIGHT_OUT_OF_RANGE", "KPI weight must be between 0 and 100.");
        params.push(w);
      } else if (key === "measurementCadence") {
        financePeriodService.assertValidCadence(patch[key]);
        params.push(patch[key]);
      } else {
        params.push(patch[key] ?? null);
      }
      fields.push(`${column}=$${params.length}`);
    }
  }
  if (!fields.length) {
    const current = await pool.query(`SELECT * FROM finance_kpi_definitions WHERE id=$1`, [id]);
    if (!current.rowCount) throw fail(404, "KPI_DEFINITION_NOT_FOUND", "KPI definition not found.");
    return current.rows[0];
  }
  params.push(id);
  const result = await pool.query(
    `UPDATE finance_kpi_definitions SET ${fields.join(",")},updated_at=NOW() WHERE id=$${params.length} RETURNING *`,
    params
  );
  if (!result.rowCount) throw fail(404, "KPI_DEFINITION_NOT_FOUND", "KPI definition not found.");
  return result.rows[0];
}

async function deactivateKpiDefinition(id, deactivatedBy) {
  const result = await pool.query(`UPDATE finance_kpi_definitions SET active=FALSE,updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
  if (!result.rowCount) throw fail(404, "KPI_DEFINITION_NOT_FOUND", "KPI definition not found.");
  return result.rows[0];
}

async function getKpiDefinitions({financeFunctionId, periodKey, activeOnly = true} = {}) {
  const clauses = [];
  const params = [];
  if (activeOnly) clauses.push(`active=TRUE`);
  if (financeFunctionId != null) { params.push(financeFunctionId); clauses.push(`finance_function_id=$${params.length}::bigint`); }
  if (periodKey != null) { params.push(periodKey); clauses.push(`period_key=$${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(`SELECT * FROM finance_kpi_definitions ${where} ORDER BY name`, params);
  return result.rows;
}

async function carryForwardDefinitions(fromPeriodKey, toPeriodKey, carriedBy) {
  if (!fromPeriodKey || !toPeriodKey) throw fail(400, "KPI_CARRY_FORWARD_PERIODS_REQUIRED", "Both source and target period keys are required.");
  if (fromPeriodKey === toPeriodKey) throw fail(400, "KPI_CARRY_FORWARD_SAME_PERIOD", "Source and target periods must differ.");
  financePeriodService.resolvePeriodKey(fromPeriodKey);
  financePeriodService.resolvePeriodKey(toPeriodKey);
  const result = await pool.query(
    `INSERT INTO finance_kpi_definitions(name,description,finance_function_id,target_value,unit,weight,period_key,measurement_cadence,grading_band_config_id,active,created_by)
     SELECT name,description,finance_function_id,target_value,unit,weight,$2,measurement_cadence,grading_band_config_id,TRUE,$3::bigint
     FROM finance_kpi_definitions WHERE period_key=$1 AND active=TRUE
     ON CONFLICT (name,finance_function_id,period_key) DO NOTHING
     RETURNING id,name,finance_function_id`,
    [fromPeriodKey, toPeriodKey, carriedBy]
  );
  return {carried: result.rowCount, definitions: result.rows};
}

async function createGradingBandConfig({name, financeFunctionId, excellentThreshold, meetsExpectationsThreshold, belowExpectationsThreshold}) {
  if (!name) throw fail(400, "GRADING_BAND_NAME_REQUIRED", "Grading band config name is required.");
  const result = await pool.query(
    `INSERT INTO finance_grading_band_configs(name,finance_function_id,excellent_threshold,meets_expectations_threshold,below_expectations_threshold,active)
     VALUES($1,$2::bigint,$3::numeric,$4::numeric,$5::numeric,TRUE) RETURNING *`,
    [name, financeFunctionId ?? null, excellentThreshold ?? 90, meetsExpectationsThreshold ?? 80, belowExpectationsThreshold ?? 60]
  );
  return result.rows[0];
}

async function resolveGradingBandConfig(gradingBandConfigId) {
  if (gradingBandConfigId != null) {
    const result = await pool.query(`SELECT * FROM finance_grading_band_configs WHERE id=$1 AND active=TRUE`, [gradingBandConfigId]);
    if (result.rowCount) return result.rows[0];
    throw fail(404, "GRADING_BAND_CONFIG_NOT_FOUND", "Grading band config not found.");
  }
  const fallback = await pool.query(`SELECT * FROM finance_grading_band_configs WHERE finance_function_id IS NULL AND active=TRUE ORDER BY id LIMIT 1`);
  if (fallback.rowCount) return fallback.rows[0];
  return DEFAULT_BANDS;
}

async function assignGradingBand(overallScore, gradingBandConfigId) {
  const config = await resolveGradingBandConfig(gradingBandConfigId);
  const excellent = Number(config.excellent_threshold ?? config.excellent ?? 90);
  const meets = Number(config.meets_expectations_threshold ?? config.meets ?? 80);
  const below = Number(config.below_expectations_threshold ?? config.below ?? 60);
  const score = Number(overallScore);
  if (score >= excellent) return {band: "Excellent", threshold: excellent};
  if (score >= meets) return {band: "Meets Expectations", threshold: meets};
  if (score >= below) return {band: "Below Expectations", threshold: below};
  return {band: "Unsatisfactory", threshold: below};
}

async function checkWeightSum({financeFunctionId, periodKey} = {}) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(weight),0) AS sum FROM finance_kpi_definitions WHERE active=TRUE AND finance_function_id IS NOT DISTINCT FROM $1::bigint AND period_key=$2`,
    [financeFunctionId ?? null, periodKey ?? null]
  );
  const sum = Number(result.rows[0].sum);
  return {sum, warning: Math.abs(sum - 100) > 0.01 ? "WEIGHT_SUM_WARNING" : null};
}

async function createCorrectiveActionPlan({employeeUserId, periodKey, description, targetImprovementScore, reviewDate, mentorUserId, createdBy}) {
  if (!employeeUserId || !periodKey || !description || targetImprovementScore == null || !reviewDate) throw fail(400, "CORRECTIVE_ACTION_FIELDS_REQUIRED", "Employee, period, description, target score and review date are required.");
  const result = await pool.query(
    `INSERT INTO finance_corrective_action_plans(employee_user_id,period_key,description,target_improvement_score,review_date,mentor_user_id,status,created_by)
     VALUES($1::bigint,$2,$3,$4::numeric,$5,$6::bigint,'active',$7::bigint) RETURNING *`,
    [employeeUserId, periodKey, description, targetImprovementScore, reviewDate, mentorUserId ?? null, createdBy]
  );
  const plan = result.rows[0];
  try {
    const employee = (await pool.query(`SELECT email,name FROM users WHERE id=$1`, [employeeUserId])).rows[0];
    if (employee?.email) {
      await sendEmail({
        to: employee.email,
        category: "finance_corrective_action",
        subject: "Finance performance: corrective action plan created",
        text: `A corrective action plan has been created for you.\n\nPeriod: ${periodKey}\nTarget improvement score: ${targetImprovementScore}\nReview date: ${reviewDate}\n\n${description}`,
        html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>Corrective action plan</h2><p>Period: ${periodKey}<br>Target improvement score: ${targetImprovementScore}<br>Review date: ${reviewDate}</p><p>${description}</p></div>`
      });
    }
  } catch (error) {
    console.warn("Corrective action plan notification failed:", error.message);
  }
  return plan;
}

async function getCorrectiveActionPlans({employeeUserId, periodKey, status} = {}) {
  const clauses = [];
  const params = [];
  if (employeeUserId != null) { params.push(employeeUserId); clauses.push(`employee_user_id=$${params.length}::bigint`); }
  if (periodKey != null) { params.push(periodKey); clauses.push(`period_key=$${params.length}`); }
  if (status != null) { params.push(status); clauses.push(`status=$${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(`SELECT * FROM finance_corrective_action_plans ${where} ORDER BY created_at DESC`, params);
  return result.rows;
}

async function updateCorrectiveActionPlan(id, patch, updatedBy) {
  if (!patch || !Object.keys(patch).length) throw fail(400, "CORRECTIVE_ACTION_PATCH_EMPTY", "No update fields provided.");
  if (patch.status != null && !["active", "completed", "cancelled"].includes(patch.status)) throw fail(400, "CORRECTIVE_ACTION_STATUS_INVALID", "Status must be active, completed or cancelled.");
  const fields = [];
  const params = [];
  const map = { description: "description", targetImprovementScore: "target_improvement_score", reviewDate: "review_date", mentorUserId: "mentor_user_id", status: "status" };
  for (const [key, column] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      params.push(patch[key] ?? null);
      fields.push(`${column}=$${params.length}`);
    }
  }
  if (!fields.length) throw fail(400, "CORRECTIVE_ACTION_PATCH_EMPTY", "No update fields provided.");
  params.push(id);
  const result = await pool.query(
    `UPDATE finance_corrective_action_plans SET ${fields.join(",")} WHERE id=$${params.length}::bigint RETURNING *`,
    params
  );
  if (!result.rowCount) throw fail(404, "CORRECTIVE_ACTION_PLAN_NOT_FOUND", "Corrective action plan not found.");
  return result.rows[0];
}

function assertNotSelfScoring(actorUserId, targetUserId) {
  if (actorUserId != null && targetUserId != null && String(actorUserId) === String(targetUserId)) {
    throw fail(403, "KPI_SELF_SCORING_PROHIBITED", "Employees may not score their own KPIs.");
  }
}

module.exports = {
  createKpiDefinition,
  updateKpiDefinition,
  deactivateKpiDefinition,
  getKpiDefinitions,
  carryForwardDefinitions,
  createGradingBandConfig,
  assignGradingBand,
  checkWeightSum,
  createCorrectiveActionPlan,
  getCorrectiveActionPlans,
  updateCorrectiveActionPlan,
  assertNotSelfScoring
};