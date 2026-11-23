const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeEmailAllocationService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;

router.post("/rules", managers, async (req, res, next) => {
  try {
    const rule = await service.createAllocationRule({ ...(req.body || {}), createdBy: req.user.id });
    logFinanceAction(req, "email_allocation_rule_create", rule?.id);
    res.status(201).json(rule);
  } catch (error) { next(error); }
});

router.put("/rules/:id", managers, async (req, res, next) => {
  try {
    const result = await service.updateAllocationRule(Number(req.params.id), req.body || {}, req.user.id);
    logFinanceAction(req, "email_allocation_rule_update", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/rules/:id/deactivate", managers, async (req, res, next) => {
  try {
    const result = await service.deactivateAllocationRule(Number(req.params.id), req.user.id);
    logFinanceAction(req, "email_allocation_rule_deactivate", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/opt-out", async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await service.optOut({ userId: req.user.id, category: body.category });
    logFinanceAction(req, "email_opt_out", body.category || null);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.post("/opt-back-in", async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await service.optBackIn({ userId: req.user.id, category: body.category });
    logFinanceAction(req, "email_opt_back_in", body.category || null);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

module.exports = router;