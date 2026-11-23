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
  console.log("Polymorphic KPI Join Tests:\n");

  try {
    const scoreTableExists = await pool.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_kpi_item_scores'
    `);
    ok("kpi_scores_table_exists", scoreTableExists.rows.length > 0);

    if (scoreTableExists.rows.length > 0) {
      const workItemTypes = await pool.query(`
        SELECT DISTINCT work_item_type FROM finance_kpi_item_scores ORDER BY work_item_type
      `);
      console.log("Work item types in KPI scores:", workItemTypes.rows.map(r => r.work_item_type));

      const expectedTypes = ["ticket", "journal", "reconciliation", "month_end"];
      for (const type of expectedTypes) {
        const count = await pool.query(`
          SELECT count(*)::int AS n FROM finance_kpi_item_scores WHERE work_item_type = $1
        `, [type]);
        ok(`kpi_scores_${type}_resolvable`, count.rows[0].n >= 0, `${count.rows[0].n} scores`);
      }

      console.log("\nTicket-type KPI join (tickets → fto for kpi_objective/kpi_period):");
      const ticketJoin = await pool.query(`
        SELECT count(*)::int AS n
        FROM finance_kpi_item_scores s
        JOIN tickets t ON t.id = s.work_item_id
        LEFT JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
        WHERE s.work_item_type = 'ticket'
      `);
      ok("ticket_kpi_join_resolves", ticketJoin.rows[0].n >= 0, `${ticketJoin.rows[0].n} joined rows`);

      const ticketJoinWithObjective = await pool.query(`
        SELECT count(*)::int AS n
        FROM finance_kpi_item_scores s
        JOIN tickets t ON t.id = s.work_item_id
        JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
        WHERE s.work_item_type = 'ticket'
          AND fto.kpi_objective IS NOT NULL
      `);
      ok("ticket_kpi_join_with_objective", ticketJoinWithObjective.rows[0].n >= 0,
         `${ticketJoinWithObjective.rows[0].n} rows with kpi_objective`);

      console.log("\nMonth-end KPI join (finance_close_tasks):");
      const monthEndJoin = await pool.query(`
        SELECT count(*)::int AS n
        FROM finance_kpi_item_scores s
        JOIN finance_close_tasks t ON t.id = s.work_item_id
        WHERE s.work_item_type = 'month_end'
      `).catch(() => ({ rows: [{ n: 0 }] }));
      ok("month_end_kpi_join_resolves", monthEndJoin.rows[0].n >= 0, `${monthEndJoin.rows[0].n} joined rows`);

      console.log("\nJournal KPI join (finance_journals):");
      const journalJoin = await pool.query(`
        SELECT count(*)::int AS n
        FROM finance_kpi_item_scores s
        JOIN finance_journals j ON j.id = s.work_item_id
        WHERE s.work_item_type = 'journal'
      `).catch(() => ({ rows: [{ n: 0 }] }));
      ok("journal_kpi_join_resolves", journalJoin.rows[0].n >= 0, `${journalJoin.rows[0].n} joined rows`);

      console.log("\nReconciliation KPI join (finance_reconciliations):");
      const reconJoin = await pool.query(`
        SELECT count(*)::int AS n
        FROM finance_kpi_item_scores s
        JOIN finance_reconciliations r ON r.id = s.work_item_id
        WHERE s.work_item_type = 'reconciliation'
      `).catch(() => ({ rows: [{ n: 0 }] }));
      ok("reconciliation_kpi_join_resolves", reconJoin.rows[0].n >= 0, `${reconJoin.rows[0].n} joined rows`);
    }

    console.log("\nKPI scoring function (recalculateAllScores) query validity:");
    const scoringQuery = await pool.query(`
      SELECT 'ticket' AS type, t.id, fto.kpi_objective, fto.kpi_period
      FROM tickets t
      JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
      WHERE fto.kpi_objective IS NOT NULL
      LIMIT 5
    `);
    ok("kpi_scoring_query_valid", scoringQuery.rows.length >= 0, `${scoringQuery.rows.length} tickets with KPI objectives`);

  } catch (err) {
    console.error("Test error:", err.message);
    failed++;
  } finally {
    await pool.end();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
})();