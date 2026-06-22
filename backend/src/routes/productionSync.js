const router = require("express").Router();
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { getMssqlPool } = require("../db/mssqlPool");
const {
  syncBedlinerDailyProduction,
} = require("../services/syncBedlinerDailyProduction");

router.use(auth);

/**
 * ✅ Test MSSQL connection.
 */
router.get(
  "/test-mssql",
  allowRoles("superadmin", "admin", "manager"),
  async (_req, res) => {
    try {
      const pool = await getMssqlPool();

      const result = await pool.request().query(`
        SELECT
          DB_NAME() AS database_name,
          @@SERVERNAME AS server_name,
          GETDATE() AS server_time
      `);

      res.json({
        ok: true,
        message: "MSSQL connection successful",
        data: result.recordset[0],
      });
    } catch (err) {
      console.error("MSSQL test failed:", err);

      res.status(500).json({
        ok: false,
        error: "MSSQL connection failed",
        details: err.message,
      });
    }
  }
);

/**
 * ✅ Run Bedliner daily production sync manually.
 */
router.post(
  "/sync-bedliner-daily",
  allowRoles("superadmin", "admin", "manager"),
  async (_req, res) => {
    try {
      const result = await syncBedlinerDailyProduction();

      res.json({
        ok: true,
        message: "Bedliner daily production sync completed",
        synced: result.synced,
      });
    } catch (err) {
      console.error("Bedliner daily sync failed:", err);

      res.status(500).json({
        ok: false,
        error: "Bedliner daily production sync failed",
        details: err.message,
      });
    }
  }
);

/**
 * ✅ Read synced Bedliner daily production summary from PostgreSQL.
 */
router.get(
  "/bedliner-daily",
  allowRoles("superadmin", "admin", "manager", "agent", "operator"),
  async (req, res) => {
    const { fromDate, toDate } = req.query;

    const where = [`source_module = 'BEDLINER_ASSEMBLY'`];
    const params = [];
    let i = 1;

    if (fromDate) {
      where.push(`work_date >= $${i++}`);
      params.push(fromDate);
    }

    if (toDate) {
      where.push(`work_date <= $${i++}`);
      params.push(toDate);
    }

    try {
      const result = await require("../db/pool").query(
        `
        SELECT
        id,
        source_module,
        work_date::text AS work_date,
        total_scheduled_sequences,
        total_assembly_production,
        total_assembly_rejects,
        total_sequencing_rejects,
        total_call_offs,
        attainment_percent,
        assembly_reject_percent,
        sequencing_reject_percent,
        source_system,
        stored_procedure,
        synced_at
        FROM production_daily_summary_snapshot
        WHERE ${where.join(" AND ")}
        ORDER BY work_date DESC
        `,
        params
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Fetch Bedliner daily summary failed:", err);

      res.status(500).json({
        error: "Failed to fetch Bedliner daily summary",
      });
    }
  }
);

module.exports = router;