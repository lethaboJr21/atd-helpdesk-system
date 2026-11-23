const express = require("express");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const itDashboardService = require("../services/itDashboardService");
const router = express.Router();

router.use(auth, allowRoles("manager", "admin", "superadmin"));

router.get("/metrics", async (req, res, next) => {
  try {
    const { range, customFrom, customTo, priority, status, agentId, category } = req.query;
    const metrics = await itDashboardService.getMetrics(range || "7d", { priority, status, agentId, category }, customFrom, customTo);
    res.json(metrics);
  } catch (e) { next(e); }
});

router.get("/agent-workload", async (req, res, next) => {
  try {
    const workload = await itDashboardService.getAgentWorkload(req.query.range || "7d");
    res.json({ agents: workload });
  } catch (e) { next(e); }
});

router.get("/ageing-tickets", async (req, res, next) => {
  try {
    const tickets = await itDashboardService.getAgeingTickets(Number(req.query.thresholdDays) || 7, req.query.range || "7d");
    res.json({ tickets });
  } catch (e) { next(e); }
});

router.get("/trends", async (req, res, next) => {
  try {
    const trends = await itDashboardService.getTrends(req.query.range || "30d");
    res.json({ trends });
  } catch (e) { next(e); }
});

router.get("/drilldown", async (req, res, next) => {
  try {
    const { metric, range, priority, status, agentId, category, customFrom, customTo } = req.query;
    const tickets = await itDashboardService.getDrilldown(metric || "open", range || "7d", { priority, status, agentId, category, customFrom, customTo });
    res.json({ metric, tickets });
  } catch (e) { next(e); }
});

router.get("/task-queue", async (req, res, next) => {
  try {
    const { priority, status, agentId, category } = req.query;
    const queue = await itDashboardService.getTaskQueue({ priority, status, agentId, category });
    res.json(queue);
  } catch (e) { next(e); }
});

module.exports = router;