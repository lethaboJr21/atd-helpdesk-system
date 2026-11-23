const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeKpiConfigService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;

router.post("/definitions", managers, async (req, res, next) => {
  try {
    const definition = await service.createKpiDefinition({ ...(req.body || {}), createdBy: req.user.id });
    logFinanceAction(req, "kpi_definition_create", definition?.id);
    res.status(201).json(definition);
  } catch (error) { next(error); }
});

router.get("/definitions", async (req, res, next) => {
  try {
    const definitions = await service.getKpiDefinitions({
      financeFunctionId: req.query.financeFunctionId,
      periodKey: req.query.periodKey,
      activeOnly: req.query.activeOnly !== "false",
    });
    logFinanceAction(req, "kpi_definitions_list");
    res.json({ definitions });
  } catch (error) { next(error); }
});

router.get("/definitions/weight-check", async (req, res, next) => {
  try {
    const result = await service.checkWeightSum({ financeFunctionId: req.query.financeFunctionId, periodKey: req.query.periodKey });
    logFinanceAction(req, "kpi_weight_check", req.query.periodKey || null);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/definitions/carry-forward", managers, async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await service.carryForwardDefinitions(body.fromPeriodKey, body.toPeriodKey, req.user.id);
    logFinanceAction(req, "kpi_definitions_carry_forward", `${body.fromPeriodKey}->${body.toPeriodKey}`);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.put("/definitions/:id", managers, async (req, res, next) => {
  try {
    const result = await service.updateKpiDefinition(Number(req.params.id), req.body || {}, req.user.id);
    logFinanceAction(req, "kpi_definition_update", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/definitions/:id/deactivate", managers, async (req, res, next) => {
  try {
    const result = await service.deactivateKpiDefinition(Number(req.params.id), req.user.id);
    logFinanceAction(req, "kpi_definition_deactivate", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/grading-bands", managers, async (req, res, next) => {
  try {
    const result = await service.createGradingBandConfig(req.body || {});
    logFinanceAction(req, "grading_band_create", result?.id);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.post("/corrective-actions", managers, async (req, res, next) => {
  try {
    const plan = await service.createCorrectiveActionPlan({ ...(req.body || {}), createdBy: req.user.id });
    logFinanceAction(req, "corrective_action_create", plan?.id);
    res.status(201).json(plan);
  } catch (error) { next(error); }
});

router.get("/corrective-actions", async (req, res, next) => {
  try {
    const correctiveActions = await service.getCorrectiveActionPlans({
      employeeUserId: req.query.employeeUserId,
      periodKey: req.query.periodKey,
      status: req.query.status,
    });
    logFinanceAction(req, "corrective_actions_list");
    res.json({ correctiveActions });
  } catch (error) { next(error); }
});

router.put("/corrective-actions/:id", managers, async (req, res, next) => {
  try {
    const result = await service.updateCorrectiveActionPlan(Number(req.params.id), req.body || {}, req.user.id);
    logFinanceAction(req, "corrective_action_update", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

module.exports = router;