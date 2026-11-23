const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { generateConformanceReport, validateConformance, detectRedundantWidgets } = require("../services/dashboardConformanceService");

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

function adminGuard(req, res, next) {
  if (!ADMIN_ROLES.has(req.user?.role)) {
    return res.status(403).json({ error: "Admin role required." });
  }
  next();
}

router.use(auth);
router.use(adminGuard);

router.get("/conformance-report", (req, res) => {
  try {
    const report = generateConformanceReport();
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate conformance report." });
  }
});

router.get("/conformance/:dashboardId", (req, res) => {
  try {
    const result = validateConformance(req.params.dashboardId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to validate conformance." });
  }
});

router.get("/redundant-widgets/:dashboardId", (req, res) => {
  try {
    const widgets = detectRedundantWidgets(req.params.dashboardId);
    return res.json({ dashboardId: req.params.dashboardId, redundantWidgets: widgets });
  } catch (error) {
    return res.status(500).json({ error: "Failed to detect redundant widgets." });
  }
});

module.exports = router;