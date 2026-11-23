const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeJournalWorkflowService");
const seedingService = require("../services/financeChainSeedingService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;
const hods = financeAccess.requireHodScope;

router.post("/chains", managers, async (req, res, next) => {
  try {
    const chain = await service.createWorkflowChain({ ...(req.body || {}), createdBy: req.user.id });
    logFinanceAction(req, "workflow_chain_create", chain?.id);
    res.status(201).json(chain);
  } catch (error) { next(error); }
});

router.post("/chains/:chainId/levels", managers, async (req, res, next) => {
  try {
    const level = await service.addWorkflowLevel({ ...(req.body || {}), chainId: Number(req.params.chainId) });
    logFinanceAction(req, "workflow_level_add", req.params.chainId);
    res.status(201).json(level);
  } catch (error) { next(error); }
});

router.get("/chains", async (req, res, next) => {
  try {
    const chain = await service.getWorkflowChain({
      financeFunction: req.query.financeFunction,
      workItemType: req.query.workItemType,
      confidentialityLevel: req.query.confidentialityLevel,
    });
    logFinanceAction(req, "workflow_chain_view", req.query.financeFunction || null);
    res.json({ chain });
  } catch (error) { next(error); }
});

router.post("/journals/:journalId/submit", async (req, res, next) => {
  try {
    const result = await service.submitJournal({ journalId: Number(req.params.journalId), submitterUserId: req.user.id });
    logFinanceAction(req, "journal_submit", req.params.journalId);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/journals/:journalId/approve", async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await service.approveLevel({ journalId: Number(req.params.journalId), approverUserId: req.user.id, level: body.level, reason: body.reason, delegationId: body.delegationId });
    logFinanceAction(req, "journal_approve", req.params.journalId);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/journals/:journalId/reject", async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await service.rejectJournal({ journalId: Number(req.params.journalId), rejectorUserId: req.user.id, level: body.level, reason: body.reason });
    logFinanceAction(req, "journal_reject", req.params.journalId);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/journals/:journalId/return", async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await service.returnJournal({ journalId: Number(req.params.journalId), returnerUserId: req.user.id, level: body.level, reason: body.reason });
    logFinanceAction(req, "journal_return", req.params.journalId);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/journals/:journalId/resubmit", async (req, res, next) => {
  try {
    const result = await service.resubmitJournal({ journalId: Number(req.params.journalId), submitterUserId: req.user.id });
    logFinanceAction(req, "journal_resubmit", req.params.journalId);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/journals/:journalId/publish", managers, async (req, res, next) => {
  try {
    const result = await service.publishJournal({ journalId: Number(req.params.journalId), publisherUserId: req.user.id });
    logFinanceAction(req, "journal_publish", req.params.journalId);
    res.json(result);
  } catch (error) { next(error); }
});

router.get("/journals/:journalId/history", async (req, res, next) => {
  try {
    const history = await service.getWorkflowHistory(Number(req.params.journalId));
    logFinanceAction(req, "journal_history_view", req.params.journalId);
    res.json({ history });
  } catch (error) { next(error); }
});

router.get("/reviewer-mappings", async (req, res, next) => {
  try {
    const mappings = await seedingService.getReviewerMappings();
    logFinanceAction(req, "reviewer_mappings_view");
    res.json({ mappings });
  } catch (error) { next(error); }
});

router.put("/reviewer-mappings/:financeFunction", hods, async (req, res, next) => {
  try {
    const b = req.body || {};
    const result = await seedingService.updateReviewerMapping({
      financeFunction: req.params.financeFunction,
      personVariants: b.personVariants,
      emailHint: b.emailHint,
      updatedBy: req.user.id
    });
    logFinanceAction(req, "reviewer_mapping_update", req.params.financeFunction);
    res.json(result);
  } catch (error) { next(error); }
});

router.get("/final-approvers", async (req, res, next) => {
  try {
    const approvers = await seedingService.getFinalApprovers();
    logFinanceAction(req, "final_approvers_view");
    res.json({ approvers });
  } catch (error) { next(error); }
});

router.put("/final-approvers/:scopeKey", hods, async (req, res, next) => {
  try {
    const b = req.body || {};
    const result = await seedingService.updateFinalApprover({
      scopeKey: req.params.scopeKey,
      personVariants: b.personVariants,
      emailHint: b.emailHint,
      updatedBy: req.user.id
    });
    logFinanceAction(req, "final_approver_update", req.params.scopeKey);
    res.json(result);
  } catch (error) { next(error); }
});

router.post("/seed-chains", hods, async (req, res, next) => {
  try {
    const b = req.body || {};
    const report = await seedingService.seedApprovalChains({
      confidentialityLevel: b.confidentialityLevel ?? "Internal",
      includeCfoLevel: Boolean(b.includeCfoLevel),
      dryRun: Boolean(b.dryRun),
      actorUserId: req.user.id
    });
    logFinanceAction(req, "chains_seed", b.dryRun ? "dry_run" : null);
    res.json(report);
  } catch (error) { next(error); }
});

module.exports = router;