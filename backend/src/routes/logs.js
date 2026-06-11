const express = require("express");
const router = express.Router();

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { createNotification } = require("../utils/notifications");

// ✅ GET /api/logs
// Fetches production logbook entries.
// Managers/admins can view production issues.
router.get(
  "/",
  auth,
  allowRoles("superadmin", "admin", "manager", "operator"),
  async (_req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM production_logs
        ORDER BY id DESC
        `
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("Fetch logs error:", err);
      return res.status(500).json({
        error: "Failed to fetch logs",
      });
    }
  }
);

// ✅ POST /api/logs
// Creates a new production logbook issue.
// Operators can create logs; managers/admins receive notifications.
router.post(
  "/",
  auth,
  allowRoles("superadmin", "admin", "operator", "manager"),
  async (req, res) => {
    const { hour, problem, ng_pcs, scrap_desc } = req.body;

    // ✅ Validate minimum required fields
    if (!hour || !problem) {
      return res.status(400).json({
        error: "hour and problem are required",
      });
    }

    try {
      // ✅ Insert production log entry
      const logResult = await pool.query(
        `
        INSERT INTO production_logs (
          hour,
          problem,
          ng_pcs,
          scrap_desc
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [hour, problem, Number(ng_pcs || 0), scrap_desc || ""]
      );

      const savedLog = logResult.rows[0];
      const ngPieces = Number(savedLog.ng_pcs || 0);

      // ✅ Determine notification severity
      const alertType =
        ngPieces > 10 ? "critical" : ngPieces > 5 ? "warning" : "production_issue";

      // ✅ Create manager/supervisor in-app notification
      const savedNotification = await createNotification({
        message: `New production issue logged for hour ${savedLog.hour}: ${savedLog.problem}. NG pieces: ${ngPieces}`,
        type: alertType,
        targetRole: "manager",
      });

      // ✅ Also notify admins
      await createNotification({
        message: `Production log created by ${req.user.email || "operator"}: ${savedLog.problem}`,
        type: "production_log",
        targetRole: "admin",
      });

      // ✅ Emit real-time notification if Socket.IO is configured
      const io = req.app.get("io");

      if (io && savedNotification) {
        io.emit("new-log", {
          log: savedLog,
          notification: savedNotification,
        });
      }

      return res.status(201).json(savedLog);
    } catch (err) {
      console.error("Insert log error:", err);
      return res.status(500).json({
        error: "Failed to insert log",
      });
    }
  }
);

module.exports = router;