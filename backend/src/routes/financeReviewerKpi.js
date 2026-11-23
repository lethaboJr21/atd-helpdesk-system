const express = require("express");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeReviewerKpiService");
const router = express.Router();

router.get("/projection", async (req, res, next) => {
  try {
    const projection = await service.getReviewerKpiProjection({
      reviewerUserId: req.query.reviewerUserId != null ? Number(req.query.reviewerUserId) : req.user.id,
      periodKey: req.query.period,
      requestingUser: req.user
    });
    logFinanceAction(req, "reviewer_kpi_projection_view", req.query.period || null);
    res.json(projection);
  } catch (error) { next(error); }
});

module.exports = router;