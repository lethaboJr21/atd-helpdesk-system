const express = require("express");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeTaskProgressService");
const router = express.Router();

function isElevated(req) {
  return req.user.role === "superadmin" || ["manager", "workspace_manager", "security_admin", "auditor", "director", "executive"].includes(req.financeAccess?.accessLevel);
}

router.post("/update", async (req, res, next) => {
  try {
    const result = await service.updateProgress({ ...(req.body || {}), actorUserId: req.user.id });
    logFinanceAction(req, "task_progress_update", `${(req.body || {}).taskType || ""}:${(req.body || {}).taskId ?? ""}`);
    res.json(result);
  } catch (error) { next(error); }
});

router.get("/history/:taskType/:taskId", async (req, res, next) => {
  try {
    const history = await service.getProgressHistory({ taskId: Number(req.params.taskId), taskType: req.params.taskType, limit: req.query.limit });
    logFinanceAction(req, "task_progress_history", `${req.params.taskType}:${req.params.taskId}`);
    res.json({ history });
  } catch (error) { next(error); }
});

router.post("/time-log", async (req, res, next) => {
  try {
    const entry = await service.logTime({ ...(req.body || {}), userId: req.user.id });
    logFinanceAction(req, "time_log_create", entry?.id);
    res.status(201).json(entry);
  } catch (error) { next(error); }
});

router.get("/time-entries", async (req, res, next) => {
  try {
    const entries = await service.getTimeEntries({
      taskId: req.query.taskId ? Number(req.query.taskId) : undefined,
      taskType: req.query.taskType,
      userId: req.query.userId && isElevated(req) ? Number(req.query.userId) : req.user.id,
      dateRange: req.query.from || req.query.to ? { from: req.query.from, to: req.query.to } : undefined,
    });
    logFinanceAction(req, "time_entries_list");
    res.json({ entries });
  } catch (error) { next(error); }
});

router.get("/time-summary", async (req, res, next) => {
  try {
    const summary = await service.getTimeSummary({
      userId: req.query.userId && isElevated(req) ? Number(req.query.userId) : req.user.id,
      periodKey: req.query.periodKey,
    });
    logFinanceAction(req, "time_summary_view", req.query.periodKey || null);
    res.json(summary);
  } catch (error) { next(error); }
});

module.exports = router;