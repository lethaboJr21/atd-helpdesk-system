require("dotenv").config();
const assert = require("assert");
const pool = require("../src/db/pool");

const MIGRATED_COLUMNS = [
  "evidence_state",
  "review_state",
  "kpi_objective",
  "kpi_period",
  "baseline_assigned_at",
  "original_due_at",
  "effective_due_at",
  "closed_at",
  "closed_by",
];

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) { passed++; console.log(`  OK: ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.error(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

(async () => {
  console.log("Data Parity Tests (Post-Phase 5):\n");

  try {
    const finTickets = await pool.query(`
      SELECT t.id, t.workspace FROM tickets t WHERE t.workspace = 'FIN' ORDER BY t.id
    `);
    ok("finance_tickets_exist", finTickets.rows.length > 0, `${finTickets.rows.length} Finance tickets`);

    console.log("\nfto row exists for every Finance ticket:");
    for (const ticket of finTickets.rows) {
      const fto = await pool.query(
        `SELECT * FROM finance_ticket_operations WHERE ticket_id = $1`, [ticket.id]
      );
      ok(`fto_exists_ticket_${ticket.id}`, fto.rows.length === 1);
    }

    console.log("\nfto columns populated (non-null where expected):");
    for (const col of MIGRATED_COLUMNS) {
      const colExists = await pool.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'finance_ticket_operations' AND column_name = $1
      `, [col]);
      ok(`fto_column_${col}_exists`, colExists.rows.length > 0);

      if (colExists.rows.length > 0) {
        const populated = await pool.query(`
          SELECT count(*)::int AS n FROM finance_ticket_operations
          WHERE ${col} IS NOT NULL
        `);
        ok(`fto_column_${col}_has_data`, populated.rows[0].n >= 0, `${populated.rows[0].n} non-null values`);
      }
    }

    console.log("\nDropped columns absent from tickets:");
    const droppedCols = ["evidence_state", "review_state", "kpi_objective", "kpi_period", "baseline_assigned_at", "closed_by"];
    for (const col of droppedCols) {
      const colExists = await pool.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = $1
      `, [col]);
      ok(`tickets_column_${col}_dropped`, colExists.rows.length === 0);
    }

    console.log("\nRetained shared columns present on tickets:");
    const retainedCols = ["original_due_at", "effective_due_at", "closed_at"];
    for (const col of retainedCols) {
      const colExists = await pool.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = $1
      `, [col]);
      ok(`tickets_column_${col}_retained`, colExists.rows.length > 0);
    }

    console.log("\nShared column parity (tickets == fto for Finance tickets):");
    for (const col of retainedCols) {
      const mismatches = await pool.query(`
        SELECT count(*)::int AS n
        FROM tickets t
        JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
        WHERE t.workspace = 'FIN'
          AND t.${col} IS DISTINCT FROM fto.${col}
      `);
      ok(`parity_${col}`, mismatches.rows[0].n === 0, `${mismatches.rows[0].n} mismatches`);
    }

  } catch (err) {
    console.error("Test error:", err.message);
    failed++;
  } finally {
    await pool.end();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
})();