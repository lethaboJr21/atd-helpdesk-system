const express = require("express");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const hrWorkspaceService = require("../services/hrWorkspaceService");

const router = express.Router();
router.use(auth);

router.get("/requests", async (req, res, next) => {
  try {
    res.json(await hrWorkspaceService.listRequests(req.user));
  } catch (error) {
    next(error);
  }
});

router.put("/approval-setting", allowRoles("admin", "superadmin"), async (req, res, next) => {
  try {
    res.json(await hrWorkspaceService.setManagerApprovalEnabled(
      req.body?.enabled,
      req.user
    ));
  } catch (error) {
    next(error);
  }
});

router.get("/employees", async (req, res, next) => {
  try {
    res.json({ employees: await hrWorkspaceService.listDirectoryEmployees(req.user) });
  } catch (error) {
    next(error);
  }
});

router.post("/requests", async (req, res, next) => {
  try {
    const request = await hrWorkspaceService.createRequest(req.body, req.user);
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:requestId/onboarding-step", async (req, res, next) => {
  try {
    res.json(await hrWorkspaceService.updateOnboardingStep(
      req.params.requestId,
      req.body,
      req.user
    ));
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:requestId/issuance-signature", async (req, res, next) => {
  try {
    res.json(await hrWorkspaceService.saveDeviceIssuanceSignature(
      req.params.requestId,
      req.body,
      req.user
    ));
  } catch (error) {
    next(error);
  }
});

router.get("/requests/:requestId/issuance", async (req, res, next) => {
  try {
    res.json(await hrWorkspaceService.getDeviceIssuance(
      req.params.requestId,
      req.user
    ));
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:requestId/review", async (req, res, next) => {
  try {
    const request = await hrWorkspaceService.reviewRequest(
      req.params.requestId,
      req.body.decision,
      req.body.note,
      req.user
    );
    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:requestId/it-ticket", async (req, res, next) => {
  try {
    const result = await hrWorkspaceService.linkItTicket(
      req.params.requestId,
      req.body.ticketId,
      req.user
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
