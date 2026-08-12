"use strict";

const express = require("express");
const auth = require("../middleware/auth");
const pool = require("../db/pool");
const { config, runEmailIntake } = require("../services/emailTicketIntake");

const router = express.Router();
const OPERATIONS_ROLES = new Set(["agent", "operator", "manager", "admin", "superadmin"]);

router.use(auth);
router.use((req, res, next) => {
  if (!OPERATIONS_ROLES.has(req.user?.role)) return res.status(403).json({ error: "Helpdesk operations access required." });
  return next();
});

router.get("/status", async (_req, res) => {
  try {
    const settings = config();
    const result = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM email_ticket_intake
       GROUP BY status ORDER BY status`
    );
    return res.json({ enabled: settings.enabled, mailbox: settings.mailbox, intervalMs: settings.intervalMs,
      counts: Object.fromEntries(result.rows.map((row) => [row.status, row.count])) });
  } catch (error) {
    return res.status(500).json({ error: "Email intake status could not be loaded." });
  }
});

router.post("/run", async (_req, res) => {
  try {
    return res.json(await runEmailIntake());
  } catch (error) {
    console.error("Manual email intake failed:", error);
    return res.status(500).json({ error: "Email intake failed.", detail: error.message });
  }
});

module.exports = router;