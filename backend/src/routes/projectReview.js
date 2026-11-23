const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { scanCodebase, listFindings } = require("../services/projectReviewScannerService");

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

function adminGuard(req, res, next) {
  if (!ADMIN_ROLES.has(req.user?.role)) {
    return res.status(403).json({ error: "Admin role required." });
  }
  next();
}

router.use(auth);
router.use(adminGuard);

router.post("/scan", async (req, res) => {
  try {
    const scope = req.body?.scope || "full";
    const timeBudgetMs = parseInt(req.body?.timeBudgetMs || process.env.PROJECT_REVIEW_TIME_BUDGET_MS || "60000", 10);

    setImmediate(async () => {
      try {
        await scanCodebase(scope, timeBudgetMs);
      } catch (e) {
        console.error("Project review scan failed:", e);
      }
    });

    return res.status(202).json({ status: "started", message: "Scan initiated. Findings will be available on completion." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to start scan." });
  }
});

router.get("/findings", async (req, res) => {
  try {
    const filters = {
      classification: req.query.classification || null,
      impact: req.query.impact || null,
      scanId: req.query.scanId || null,
    };
    const pagination = {
      page: req.query.page || "1",
      limit: req.query.limit || "50",
    };
    const result = await listFindings(filters, pagination);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve findings." });
  }
});

module.exports = router;