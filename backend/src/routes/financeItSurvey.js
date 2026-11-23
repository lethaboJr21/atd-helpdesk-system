const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeItSurveyService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;

router.get("/applicability/:itTicketId", async (req, res, next) => {
  try {
    const applicability = await service.checkSurveyApplicability({ itTicketId: Number(req.params.itTicketId), financeUserId: req.user.id });
    logFinanceAction(req, "it_survey_applicability_check", req.params.itTicketId);
    res.json(applicability);
  } catch (error) { next(error); }
});

router.post("/submit", async (req, res, next) => {
  try {
    const body = req.body || {};
    const survey = await service.submitSurvey({ ...body, financeUserId: req.user.id, consentToIdentity: Boolean(body.consentToIdentity) });
    logFinanceAction(req, "it_survey_submit", body.itTicketId ?? null);
    res.status(201).json(survey);
  } catch (error) { next(error); }
});

router.get("/aggregations", managers, async (req, res, next) => {
  try {
    const aggregations = await service.getSurveyAggregations({ periodKey: req.query.periodKey, category: req.query.category, requestingUserContext: { isFinanceManagement: true } });
    logFinanceAction(req, "it_survey_aggregations", req.query.periodKey || null);
    res.json(aggregations);
  } catch (error) { next(error); }
});

router.get("/:itTicketId", async (req, res, next) => {
  try {
    const survey = await service.getSurvey(Number(req.params.itTicketId));
    logFinanceAction(req, "it_survey_view", req.params.itTicketId);
    res.json(survey);
  } catch (error) { next(error); }
});

module.exports = router;