const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

// ✅ GET all production metrics
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM production_metrics ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch production data" });
  }
});

// ✅ INSERT production metric
router.post("/", async (req, res) => {
  const { machine, plan, actual, scrap, oee } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO production_metrics (machine, plan, actual, scrap, oee)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [machine, plan, actual, scrap, oee]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to insert production data" });
  }
});

module.exports = router;
