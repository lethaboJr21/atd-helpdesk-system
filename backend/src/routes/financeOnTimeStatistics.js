const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeOnTimeStatsService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;

router.get("/", (req, res, next) => {
  if (req.query.dimension != null && String(req.query.dimension).trim() !== "") return managers(req, res, next);
  next();
}, async (req, res, next) => {
  try {
    const q = req.query || {};
    const statsWindow = {};
    if (q.periodKey != null) statsWindow.periodKey = q.periodKey;
    if (q.month != null) statsWindow.month = q.month;
    if (q.year != null) statsWindow.year = q.year;
    if (q.from != null) statsWindow.from = q.from;
    if (q.to != null) statsWindow.to = q.to;
    if (q.isoWeek != null) statsWindow.isoWeek = q.isoWeek;
    if (q.isoYear != null) statsWindow.isoYear = q.isoYear;
    if (q.day != null) statsWindow.day = q.day;
    const dimension = q.dimension != null && String(q.dimension).trim() !== "" ? String(q.dimension).trim() : undefined;
    const statistics = await service.getOnTimeStatistics({
      requestingUser: req.user,
      window: statsWindow,
      dimension,
      itemType: q.itemType,
      employeeUserId: q.employeeUserId,
      financeFunction: q.financeFunction,
      officeCode: q.officeCode,
      department: q.department
    });
    logFinanceAction(req, "on_time_statistics_view", q.periodKey || q.month || q.day || null);
    res.json(statistics);
  } catch (error) { next(error); }
});

router.get("/trend", managers, async (req, res, next) => {
  try {
    const q = req.query || {};
    let windows;
    if (q.windows != null && String(q.windows).trim() !== "") {
      try {
        windows = JSON.parse(q.windows);
      } catch (error) {
        throw Object.assign(new Error("windows must be a JSON array of window specs."), { status: 400, code: "INVALID_WINDOWS" });
      }
    } else {
      windows = { fromMonth: q.fromMonth, toMonth: q.toMonth };
    }
    const trend = await service.getOnTimeTrend({ requestingUser: req.user, windows, itemType: q.itemType });
    logFinanceAction(req, "on_time_trend_view", q.fromMonth && q.toMonth ? `${q.fromMonth}->${q.toMonth}` : null);
    res.json({ trend });
  } catch (error) { next(error); }
});

module.exports = router;