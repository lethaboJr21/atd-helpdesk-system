const express = require("express");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const crossWorkspaceAccess = require("../services/crossWorkspaceAccess");
const router = express.Router();

const managerRoles = ["manager", "admin", "superadmin"];

router.get("/", auth, allowRoles(...managerRoles), async (req, res, next) => {
  try {
    const filters = {
      granteeUserId: req.query.granteeUserId ? Number(req.query.granteeUserId) : null,
      targetWorkspace: req.query.targetWorkspace || null,
      activeOnly: req.query.activeOnly === "true",
      limit: req.query.limit ? Math.min(Number(req.query.limit), 500) : 100,
    };
    const exceptions = await crossWorkspaceAccess.listExceptions(filters);
    res.json({ exceptions });
  } catch (e) { next(e); }
});

router.get("/:id", auth, allowRoles(...managerRoles), async (req, res, next) => {
  try {
    const exception = await crossWorkspaceAccess.getExceptionById(Number(req.params.id));
    if (!exception) return res.status(404).json({ code: "EXCEPTION_NOT_FOUND", error: "Cross-workspace exception not found." });
    res.json({ exception });
  } catch (e) { next(e); }
});

router.post("/", auth, allowRoles(...managerRoles), async (req, res, next) => {
  try {
    const { granteeUserId, targetWorkspace, expiresAt, reason } = req.body;
    if (!granteeUserId || !targetWorkspace || !expiresAt || !reason) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "granteeUserId, targetWorkspace, expiresAt, and reason are required."
      });
    }
    const exception = await crossWorkspaceAccess.grantException(
      req.user.id, Number(granteeUserId), targetWorkspace, expiresAt, reason
    );
    res.status(201).json({ exception });
  } catch (e) {
    if (["EXCEPTION_EXPIRY_REQUIRED", "EXCEPTION_EXPIRY_TOO_FAR"].includes(e.code)) {
      return res.status(400).json({ code: e.code, error: e.message });
    }
    next(e);
  }
});

router.delete("/:id", auth, allowRoles(...managerRoles), async (req, res, next) => {
  try {
    const exception = await crossWorkspaceAccess.revokeException(Number(req.params.id), req.user.id);
    res.json({ exception, revoked: true });
  } catch (e) {
    if (e.code === "CROSS_WORKSPACE_ACCESS_DENIED") {
      return res.status(404).json({ code: "EXCEPTION_NOT_FOUND", error: e.message });
    }
    next(e);
  }
});

router.get("/check/:userId/:targetWorkspace", auth, async (req, res, next) => {
  try {
    const result = await crossWorkspaceAccess.checkException(
      Number(req.params.userId), req.params.targetWorkspace
    );
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;