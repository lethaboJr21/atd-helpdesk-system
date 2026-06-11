const express = require("express");
const router = express.Router();

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { createNotification } = require("../utils/notifications");

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
