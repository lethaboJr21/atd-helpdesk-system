const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeScheduledReportService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;
const hods = financeAccess.requireHodScope;

function isElevated(req) {
  return req.user.role === "superadmin" || ["manager", "workspace_manager", "security_admin", "auditor", "director", "executive"].includes(req.financeAccess?.accessLevel);
}

router.post("/distribution-lists", hods, async (req, res, next) => {
  try {
    const list = await service.createDistributionList({ ...(req.body || {}), managedBy: req.user.id });
    logFinanceAction(req, "distribution_list_create", list?.id);
    res.status(201).json(list);
  } catch (error) { next(error); }
});

router.put("/distribution-lists/:id", hods, async (req, res, next) => {
  try {
    const result = await service.updateDistributionList(Number(req.params.id), req.body || {}, req.user.id);
    logFinanceAction(req, "distribution_list_update", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.get("/distribution-lists", async (req, res, next) => {
  try {
    const distributionLists = await service.getDistributionLists({ managedBy: isElevated(req) ? (req.query.managedBy ? Number(req.query.managedBy) : undefined) : req.user.id });
    logFinanceAction(req, "distribution_lists_list");
    res.json({ distributionLists });
  } catch (error) { next(error); }
});

router.post("/", managers, async (req, res, next) => {
  try {
    const report = await service.createScheduledReport({ ...(req.body || {}), createdBy: req.user.id });
    logFinanceAction(req, "scheduled_report_create", report?.id);
    res.status(201).json(report);
  } catch (error) { next(error); }
});

router.put("/:id", managers, async (req, res, next) => {
  try {
    const result = await service.updateScheduledReport(Number(req.params.id), req.body || {}, req.user.id);
    logFinanceAction(req, "scheduled_report_update", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/:id/deactivate", managers, async (req, res, next) => {
  try {
    const result = await service.deactivateScheduledReport(Number(req.params.id), req.user.id);
    logFinanceAction(req, "scheduled_report_deactivate", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const scheduledReports = await service.getScheduledReports({
      activeOnly: req.query.activeOnly === "true" ? true : req.query.activeOnly === "false" ? false : undefined,
      createdBy: isElevated(req) ? (req.query.createdBy ? Number(req.query.createdBy) : undefined) : req.user.id,
    });
    logFinanceAction(req, "scheduled_reports_list");
    res.json({ scheduledReports });
  } catch (error) { next(error); }
});

module.exports = router;