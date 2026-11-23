const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeManagementDashboardService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;

router.get("/", managers, async (req, res, next) => {
  try {
    const dashboard = await service.buildAdvancedDashboard({
      managerUserId: req.query.managerUserId ? Number(req.query.managerUserId) : req.user.id,
      period: req.query.period,
      requestingUser: { id: req.user.id, role: req.user.role, name: req.user.name, department: req.user.department, financeAccess: req.financeAccess },
    });
    logFinanceAction(req, "management_dashboard_view", req.query.managerUserId || req.user.id);
    res.json(dashboard);
  } catch (error) { next(error); }
});

module.exports = router;