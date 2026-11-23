const express = require("express");
const router = express.Router();

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { createNotification } = require("../utils/notifications");
const { createNotifications } = require("../services/notificationService");

const LINE_ASSISTANCE_STATIONS = new Set([
  "MES",
  "PLC-RSB assembly",
  "PLC-SRS - Finished RSB Electronic Storage with Robot lift",
  "Qmuzik App on the line",
  "Blowmoulding station",
  "RSB",
  "Thermoforming",
  "Checking Fixtures",
  "Jigs tools",
  "Other",
]);

router.post(
  "/assistance-alerts",
  auth,
  allowRoles("user", "operator", "agent", "manager", "admin", "superadmin"),
  async (req, res, next) => {
    try {
      const station = String(req.body?.station || "").trim();
      if (!LINE_ASSISTANCE_STATIONS.has(station)) {
        return res.status(400).json({ error: "Select a valid production station." });
      }

      const requester = await pool.query(
        `SELECT id, name, department
         FROM users
         WHERE id = $1 AND status = 'active' AND archived_at IS NULL`,
        [req.user.id]
      );
      const employee = requester.rows[0];
      if (!employee) {
        return res.status(403).json({ error: "An active employee account is required." });
      }

      const department = String(employee.department || "").toLowerCase();
      if (!department.includes("production") && !department.includes("pdm")) {
        return res.status(403).json({ error: "Station assistance is available to Production and PDM employees." });
      }

      const alert = `${employee.name || "A line employee"} needs a supervisor at ${station}.`;
      const supervisors = await pool.query(
        `SELECT id
         FROM users
         WHERE status = 'active'
           AND archived_at IS NULL
           AND LOWER(BTRIM(department)) = 'production'
           AND LOWER(BTRIM(job_title)) IN (
             'production supervisor',
             'senior production supervisor'
           )`
      );

      if (!supervisors.rowCount) {
        return res.status(409).json({ error: "No active Production supervisors are available to notify." });
      }

      const notifications = await createNotifications({
        recipientUserIds: supervisors.rows.map((supervisor) => supervisor.id),
        type: "warning",
        module: "production",
        message: alert,
        targetType: "station_assistance",
        targetUrl: "/line-assistance",
      });

      return res.status(201).json({
        station,
        supervisorsNotified: notifications.length,
        message: "Production supervisors have been notified.",
      });
    } catch (error) {
      return next(error);
    }
  }
);

// ✅ GET /api/production
// Fetches production metrics.
router.get(
  "/",
  auth,
  allowRoles("superadmin", "admin", "manager", "operator", "user"),
  async (_req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM production_metrics
        ORDER BY id DESC
        `
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("Fetch production data error:", err);
      return res.status(500).json({
        error: "Failed to fetch production data",
      });
    }
  }
);

// ✅ POST /api/production
// Inserts production metric and notifies manager if scrap or OEE is concerning.
router.post(
  "/",
  auth,
  allowRoles("superadmin", "admin", "operator", "manager", "user"),
  async (req, res) => {
    const { machine, plan, actual, scrap, oee } = req.body;

    // ✅ Validate minimum required fields
    if (!machine) {
      return res.status(400).json({
        error: "machine is required",
      });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO production_metrics (
          machine,
          plan,
          actual,
          scrap,
          oee
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          machine,
          Number(plan || 0),
          Number(actual || 0),
          Number(scrap || 0),
          Number(oee || 0),
        ]
      );

      const savedMetric = result.rows[0];

      // ✅ Create notification if scrap is high
      if (Number(savedMetric.scrap || 0) > 0) {
        await createNotification({
          message: `Production scrap recorded on ${savedMetric.machine}: ${savedMetric.scrap}`,
          type: Number(savedMetric.scrap) > 10 ? "critical" : "warning",
          targetRole: "manager",
        });
      }

      // ✅ Create notification if OEE is low
      if (Number(savedMetric.oee || 0) > 0 && Number(savedMetric.oee) < 75) {
        await createNotification({
          message: `Low OEE detected on ${savedMetric.machine}: ${savedMetric.oee}%`,
          type: "warning",
          targetRole: "manager",
        });
      }

      return res.status(201).json(savedMetric);
    } catch (err) {
      console.error("Insert production data error:", err);
      return res.status(500).json({
        error: "Failed to insert production data",
      });
    }
  }
);

module.exports = router;
