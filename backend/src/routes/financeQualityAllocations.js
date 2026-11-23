const express = require("express");
const pool = require("../db/pool");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeQualityAllocationService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;
const hods = financeAccess.requireHodScope;

function guardWouldPass(guard, req) {
  return new Promise((resolve) => {
    const sink = { status: () => ({ json: () => resolve(false) }) };
    Promise.resolve(guard(req, sink, () => resolve(true))).catch(() => resolve(false));
  });
}

async function requireQualityRaterScope(req, res, next) {
  const [managerPasses, hodPasses] = await Promise.all([guardWouldPass(managers, req), guardWouldPass(hods, req)]);
  if (managerPasses || hodPasses) return next();
  let configuredApprover = false;
  try {
    const rows = await pool.query(`SELECT 1 FROM finance_final_approvers WHERE approver_user_id=$1::bigint AND active=TRUE LIMIT 1`, [req.user?.id]);
    configuredApprover = rows.rowCount > 0;
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) return next(error);
  }
  if (configuredApprover) return next();
  return res.status(403).json({ code: "QUALITY_ALLOCATION_AUTHORITY_REQUIRED", error: "Manager, HOD or configured final-approver authority is required to allocate quality." });
}

router.get("/queue", managers, async (req, res, next) => {
  try {
    const q = req.query || {};
    const queue = await service.getQualityRatingQueue({
      requestingUser: req.user,
      itemType: q.itemType,
      periodKey: q.periodKey,
      includeRated: q.includeRated === "true"
    });
    logFinanceAction(req, "quality_rating_queue_view", q.periodKey || null);
    res.json(queue);
  } catch (error) { next(error); }
});

router.post("/", requireQualityRaterScope, async (req, res, next) => {
  try {
    const b = req.body || {};
    const result = await service.recordQualityAllocation({
      workItemId: b.workItemId,
      workItemType: b.workItemType,
      rating: b.rating != null ? Number(b.rating) : undefined,
      justification: b.justification ?? null,
      raterUserId: req.user.id
    });
    logFinanceAction(req, "quality_allocation_record", `${b.workItemType}:${b.workItemId}`);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

router.get("/:workItemType/:workItemId", async (req, res, next) => {
  try {
    const allocation = await service.getQualityAllocation({
      requestingUser: req.user,
      workItemType: req.params.workItemType,
      workItemId: req.params.workItemId
    });
    logFinanceAction(req, "quality_allocation_view", `${req.params.workItemType}:${req.params.workItemId}`);
    res.json(allocation);
  } catch (error) { next(error); }
});

module.exports = router;