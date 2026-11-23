const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeEnterpriseReportingService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;

function requestingUser(req) {
  return { id: req.user.id, role: req.user.role, name: req.user.name, department: req.user.department, financeAccess: req.financeAccess };
}

router.post("/generate", managers, async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await service.generateReport({
      reportType: body.reportType,
      parameters: body.parameters,
      outputFormat: body.outputFormat,
      requestingUser: requestingUser(req),
    });
    logFinanceAction(req, "report_generate", `${body.reportType}:${result?.filename || ""}`);
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    if (result.warnings && result.warnings.length) res.setHeader("X-Report-Warnings", JSON.stringify(result.warnings));
    if (result._errors && result._errors.length) res.setHeader("X-Report-Errors", JSON.stringify(result._errors));
    res.send(result.buffer);
  } catch (error) { next(error); }
});

router.get("/rollup", managers, async (req, res, next) => {
  try {
    const rollup = await service.getReportRollup({
      dimension: req.query.dimension,
      periodKey: req.query.periodKey,
      periodRange: req.query.from || req.query.to ? { from: req.query.from, to: req.query.to } : undefined,
      requestingUser: requestingUser(req),
    });
    logFinanceAction(req, "report_rollup", req.query.dimension || null);
    res.json(rollup);
  } catch (error) { next(error); }
});

router.get("/trend", managers, async (req, res, next) => {
  try {
    const trend = await service.getTrendAnalysis({
      metric: req.query.metric,
      periodKey: req.query.periodKey,
      periodRange: req.query.from || req.query.to ? { from: req.query.from, to: req.query.to } : undefined,
      dimension: req.query.dimension,
      dimensionValue: req.query.dimensionValue,
      requestingUser: requestingUser(req),
    });
    logFinanceAction(req, "report_trend", req.query.metric || null);
    res.json(trend);
  } catch (error) { next(error); }
});

module.exports = router;