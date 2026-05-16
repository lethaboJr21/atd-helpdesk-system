const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { sendApprovalEmail } = require("../services/email");

// ✅ IMPORT MIDDLEWARE
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

// ✅ GET logs (Managers, Admins, Superadmins)
router.get(
  "/",
  auth,
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM production_logs ORDER BY id DESC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  }
);

// ✅ INSERT log (Operators, Admins, Superadmins ONLY)
router.post(
  "/",
  auth,
  allowRoles("superadmin", "admin", "operator"),
  async (req, res) => {
    const { hour, problem, ng_pcs, scrap_desc } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO production_logs (hour, problem, ng_pcs, scrap_desc)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [hour, problem, ng_pcs, scrap_desc]
      );

      // Send approval email
      if (ng_pcs > 10) {
        await sendApprovalEmail(result.rows[0]);
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to insert log" });
    }
  }
);

module.exports = router;