const express = require("express");
const financeAccess = require("../middleware/financeAccess");
const { logFinanceAction } = require("../utils/financeActionLog");
const service = require("../services/financeDelegatedAuthorityService");
const router = express.Router();
const managers = financeAccess.requireManagerScope;

router.post("/", managers, async (req, res, next) => {
  try {
    const body = req.body || {};
    const delegation = await service.grantDelegation({
      delegatorUserId: req.user.id,
      delegateUserId: body.delegateUserId,
      scope: body.scope,
      expiresAt: body.expiresAt,
      reason: body.reason,
    });
    logFinanceAction(req, "delegation_grant", delegation?.id);
    res.status(201).json(delegation);
  } catch (error) { next(error); }
});

router.delete("/:id", managers, async (req, res, next) => {
  try {
    const result = await service.revokeDelegation(Number(req.params.id), req.user.id, (req.body || {}).reason);
    logFinanceAction(req, "delegation_revoke", req.params.id);
    res.json(result);
  } catch (error) { next(error); }
});

router.get("/active", async (req, res, next) => {
  try {
    const canViewAll = req.user.role === "superadmin" || ["workspace_manager", "security_admin", "auditor", "director", "executive"].includes(req.financeAccess?.accessLevel);
    const delegatorUserId = req.query.delegatorUserId ? Number(req.query.delegatorUserId) : undefined;
    const delegateUserId = req.query.delegateUserId ? Number(req.query.delegateUserId) : undefined;
    if (!canViewAll) {
      for (const target of [delegatorUserId, delegateUserId]) {
        if (target !== undefined && String(target) !== String(req.user.id)) service.assertWithinAuthority(req.financeAccess, target);
      }
    }
    if (delegatorUserId === undefined && delegateUserId === undefined) {
      if (canViewAll) {
        const delegations = await service.getActiveDelegations({});
        logFinanceAction(req, "delegations_list");
        return res.json({ delegations });
      }
      const granted = await service.getActiveDelegations({ delegatorUserId: req.user.id });
      const received = await service.getActiveDelegations({ delegateUserId: req.user.id });
      logFinanceAction(req, "delegations_list_own");
      return res.json({ granted, received });
    }
    const delegations = await service.getActiveDelegations({ delegatorUserId, delegateUserId });
    logFinanceAction(req, "delegations_list", `${delegatorUserId ?? "*"}->${delegateUserId ?? "*"}`);
    res.json({ delegations });
  } catch (error) { next(error); }
});

module.exports = router;