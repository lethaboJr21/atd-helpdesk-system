const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { sendApprovalEmail } = require("../services/email");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

// GET /api/logs
router.get(
  "/",
  auth,
  allowRoles("superadmin", "admin", "manager"),
  async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM production_logs ORDER BY id DESC"
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("Fetch logs error:", err);
      return res.status(500).json({ error: "Failed to fetch logs" });
    }
  }
);

// POST /api/logs
router.post(
  "/",
  auth,
  allowRoles("superadmin", "admin", "operator"),
  async (req, res) => {
    const { hour, problem, ng_pcs, scrap_desc } = req.body;

    if (!hour || !problem) {
      return res.status(400).json({
        error: "hour and problem are required",
      });
    }

    try {
      const logResult = await pool.query(
        `
        INSERT INTO production_logs (hour, problem, ng_pcs, scrap_desc)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [hour, problem, ng_pcs || 0, scrap_desc || ""]
      );

      const savedLog = logResult.rows[0];

      const ngPieces = Number(ng_pcs || 0);

      const alertType =
        ngPieces > 10 ? "critical" : ngPieces > 5 ? "warning" : "normal";

      const message = `NG issue detected: ${ngPieces}`;

      if (ngPieces > 10) {
        try {
          await sendApprovalEmail({
            name: "Production Alert",
            email: process.env.EMAIL_USER,
            ...savedLog,
          });
        } catch (emailErr) {
          console.error("Email alert failed:", emailErr);
        }
      }

      const notificationResult = await pool.query(
        `
        INSERT INTO notifications (message, type, user_id, is_read)
        VALUES ($1, $2, NULL, false)
        RETURNING id, user_id, message, type, is_read, created_at
        `,
        [message, alertType]
      );

      const savedNotification = notificationResult.rows[0];

      const io = req.app.get("io");

      if (io) {
        io.emit("new-log", {
          log: savedLog,
          notification: savedNotification,
        });
      }

      return res.status(201).json(savedLog);
    } catch (err) {
      console.error("Insert log error:", err);
      return res.status(500).json({ error: "Failed to insert log" });
    }
  }
);

module.exports = router;