const express = require("express");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const errorLoggerService = require("../services/errorLoggerService");
const router = express.Router();

router.post("/errors/ingest", async (req, res, next) => {
  try {
    const { error, context } = req.body || {};
    const result = await errorLoggerService.captureError(error || req.body, context || {});
    res.status(202).json(result);
  } catch (e) { next(e); }
});

router.get("/errors", auth, allowRoles("developer", "admin", "superadmin"), async (req, res, next) => {
  try {
    const { severity, errorType, sourceFile, dateFrom, dateTo, resolutionStatus, page, limit } = req.query;
    const result = await errorLoggerService.listEntries(
      { severity, errorType, sourceFile, dateFrom, dateTo, resolutionStatus },
      { page: Number(page) || 1, limit: Number(limit) || 50 }
    );
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/errors/:correlationId", auth, allowRoles("developer", "admin", "superadmin"), async (req, res, next) => {
  try {
    const isDeveloper = ["developer", "admin", "superadmin"].includes(req.user.role);
    const detail = await errorLoggerService.getEntryDetail(req.params.correlationId, isDeveloper);
    if (!detail) return res.status(404).json({ error: "Error entry not found" });
    res.json(detail);
  } catch (e) { next(e); }
});

router.patch("/errors/:correlationId/root-cause", auth, allowRoles("developer", "admin", "superadmin"), async (req, res, next) => {
  try {
    const result = await errorLoggerService.confirmRootCause(req.params.correlationId, req.user.id, req.body);
    if (!result) return res.status(404).json({ error: "Root cause record not found" });
    res.json(result);
  } catch (e) { next(e); }
});

router.patch("/errors/:correlationId/resolution", auth, allowRoles("developer", "admin", "superadmin"), async (req, res, next) => {
  try {
    const result = await errorLoggerService.updateResolution(req.params.correlationId, req.body, req.user.id);
    if (!result) return res.status(404).json({ error: "Active error entry not found." });
    return res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;