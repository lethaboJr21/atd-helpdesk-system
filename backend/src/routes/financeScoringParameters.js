const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeScoringParametersService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;
const hods = financeAccess.requireHodScope;

router.get("/", managers, async (req, res, next) => {
  try {
    const parameters = await service.getScoringParameters();
    logFinanceAction(req, "scoring_parameters_view");
    res.json(parameters);
  } catch (error) { next(error); }
});

router.put("/overrides", hods, async (req, res, next) => {
  try {
    const b = req.body || {};
    const result = await service.setFunctionOverride({
      financeFunction: b.financeFunction,
      lateSubmissionPenaltyPct: b.lateSubmissionPenaltyPct,
      crossDepartmentAddBackPct: b.crossDepartmentAddBackPct,
      updatedBy: req.user.id
    });
    logFinanceAction(req, "scoring_parameter_override_set", b.financeFunction || null);
    res.json(result);
  } catch (error) { next(error); }
});

router.delete("/overrides/:financeFunction", hods, async (req, res, next) => {
  try {
    const result = await service.clearFunctionOverride(req.params.financeFunction, req.user.id);
    logFinanceAction(req, "scoring_parameter_override_clear", req.params.financeFunction);
    res.json(result);
  } catch (error) { next(error); }
});

module.exports = router;