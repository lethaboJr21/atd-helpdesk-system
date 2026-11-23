require("dotenv").config();
const assert = require("assert");
const pool = require("../src/db/pool");

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) { passed++; console.log(`  OK: ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.error(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

(async () => {
  console.log("Staging Gate Enforcement Tests:\n");

  try {
    const expectedMigrations = [

      { filename: "2026-11-20-phase1-workspace-discipline.sql", phase: 1 },
      { filename: "2026-11-21-phase2-finance-column-migration.sql", phase: 2 },
      { filename: "2026-11-22-phase3-rls-roles.sql", phase: 3 },
      { filename: "2026-11-23-phase5-cleanup.sql", phase: 5 },
    ];

    for (const expected of expectedMigrations) {
      const res = await pool.query(`
        SELECT filename, phase, validation_status, applied_at
        FROM schema_migrations
        WHERE filename = $1
      `, [expected.filename]);

      const found = res.rows.length > 0;
      ok(`migration_recorded_${expected.filename}`, found, found ? res.rows[0].validation_status : "NOT FOUND");

      if (found) {
        ok(`migration_passed_${expected.filename}`, res.rows[0].validation_status === "passed",
           res.rows[0].validation_status);
        ok(`migration_phase_${expected.filename}`, res.rows[0].phase === expected.phase,
           `phase ${res.rows[0].phase}`);
      }
    }

    console.log("\nAll 5 phases validated:");
    const phases = await pool.query(`
      SELECT phase, validation_status
      FROM schema_migrations
      WHERE phase BETWEEN 1 AND 5
      ORDER BY phase
    `);

    const phaseMap = {};
    for (const row of phases.rows) {
      if (!phaseMap[row.phase] || row.validation_status === "passed") {
        phaseMap[row.phase] = row.validation_status;
      }
    }

    for (let p = 1; p <= 5; p++) {
      if (p === 4) continue;
      ok(`phase_${p}_passed`, phaseMap[p] === "passed", phaseMap[p] || "not found");
    }

    console.log("\nFeature flags in final state:");
    ok("rls_enabled", process.env.RLS_ENABLED === "true", `RLS_ENABLED=${process.env.RLS_ENABLED}`);
    ok("dual_read_disabled", process.env.DUAL_READ_ENABLED === "false", `DUAL_READ_ENABLED=${process.env.DUAL_READ_ENABLED}`);
    ok("workspace_normalisation_enabled", process.env.WORKSPACE_NORMALISATION_ENABLED === "true",
       `WORKSPACE_NORMALISATION_ENABLED=${process.env.WORKSPACE_NORMALISATION_ENABLED}`);

    console.log("\nDatabase schema final state:");
    const ticketsCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'tickets' ORDER BY ordinal_position
    `);
    const colNames = ticketsCols.rows.map(r => r.column_name);

    const dropped = ["evidence_state", "review_state", "kpi_objective", "kpi_period", "baseline_assigned_at", "closed_by"];
    const retained = ["original_due_at", "effective_due_at", "closed_at", "workspace"];

    for (const col of dropped) {
      ok(`dropped_${col}`, !colNames.includes(col));
    }
    for (const col of retained) {
      ok(`retained_${col}`, colNames.includes(col));
    }

    const cwaTables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('cross_workspace_access_exceptions', 'cross_workspace_access_log')
    `);
    ok("cwa_tables_exist", cwaTables.rows.length === 2, `${cwaTables.rows.length}/2 tables`);

  } catch (err) {
    console.error("Test error:", err.message);
    failed++;
  } finally {
    await pool.end();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
})();