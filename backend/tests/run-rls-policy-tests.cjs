require("dotenv").config();
const assert = require("assert");
const pool = require("../src/db/pool");

const SHARED_TABLES = ["tickets", "ticket_history", "ticket_comments", "ticket_attachments", "email_ticket_intake"];
const ROLES = ["finance_reader", "finance_writer", "it_reader", "it_writer", "pdm_reader", "pdm_writer"];

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) { passed++; console.log(`  OK: ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.error(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

async function setRole(client, role) {
  await client.query(`SET ROLE ${role}`);
}

async function setWorkspace(client, workspace) {
  await client.query(`SET app.workspace = '${workspace}'`);
}

async function reset(client) {
  await client.query("RESET ROLE");
  await client.query("RESET app.workspace");
}

(async () => {
  console.log("RLS Policy Tests:\n");

  try {
    const rlsCheck = await pool.query(`
      SELECT pc.relname AS table_name, pc.relrowsecurity, pc.relforcerowsecurity
      FROM pg_class pc
      JOIN pg_namespace pn ON pn.oid = pc.relnamespace
      WHERE pn.nspname = 'public'
        AND pc.relkind = 'r'
        AND pc.relname = ANY($1::text[])
      ORDER BY pc.relname
    `, [SHARED_TABLES]);

    console.log("RLS enabled on shared tables:");
    for (const row of rlsCheck.rows) {
      ok(`rls_enabled_${row.table_name}`, row.relrowsecurity, row.relrowsecurity ? "enabled" : "NOT enabled");
    }

    console.log("\nFORCE RLS on critical tables:");
    const criticalTables = ["tickets", "ticket_history", "ticket_comments", "email_ticket_intake"];
    for (const row of rlsCheck.rows) {
      if (criticalTables.includes(row.table_name)) {
        ok(`force_rls_${row.table_name}`, row.relforcerowsecurity, row.relforcerowsecurity ? "forced" : "NOT forced");
      }
    }

    console.log("\nRole existence:");
    for (const role of ROLES) {
      const res = await pool.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role]);
      ok(`role_${role}_exists`, res.rows.length > 0);
    }

    console.log("\nWorkspace isolation — tickets:");
    const finCount = await pool.query("SELECT count(*)::int AS n FROM tickets WHERE workspace='FIN'");
    const itCount = await pool.query("SELECT count(*)::int AS n FROM tickets WHERE workspace='IT'");

    const client = await pool.connect();
    try {
      await setRole(client, "finance_reader");
      await setWorkspace(client, "FIN");
      const finSeen = await client.query("SELECT count(*)::int AS n FROM tickets");
      ok("finance_reader_FIN_sees_finance_tickets", finSeen.rows[0].n === finCount.rows[0].n,
         `saw ${finSeen.rows[0].n}, expected ${finCount.rows[0].n}`);

      await reset(client);
      await setRole(client, "finance_reader");
      await setWorkspace(client, "IT");
      const finSeesIt = await client.query("SELECT count(*)::int AS n FROM tickets");
      ok("finance_reader_IT_sees_it_tickets", finSeesIt.rows[0].n === itCount.rows[0].n,
         `saw ${finSeesIt.rows[0].n}, expected ${itCount.rows[0].n} (session-variable-driven)`);

      await reset(client);
      await setRole(client, "it_reader");
      await setWorkspace(client, "IT");
      const itSeen = await client.query("SELECT count(*)::int AS n FROM tickets");
      ok("it_reader_IT_sees_it_tickets", itSeen.rows[0].n === itCount.rows[0].n,
         `saw ${itSeen.rows[0].n}, expected ${itCount.rows[0].n}`);

      await reset(client);
      await setRole(client, "it_reader");
      await setWorkspace(client, "FIN");
      const itSeesFin = await client.query("SELECT count(*)::int AS n FROM tickets");
      ok("it_reader_FIN_sees_finance_tickets", itSeesFin.rows[0].n === finCount.rows[0].n,
         `saw ${itSeesFin.rows[0].n}, expected ${finCount.rows[0].n} (session-variable-driven)`);

      await reset(client);
      await setRole(client, "finance_reader");
      const noWs = await client.query("SELECT count(*)::int AS n FROM tickets");
      ok("finance_reader_no_workspace_sees_zero", noWs.rows[0].n === 0, `saw ${noWs.rows[0].n} rows (FORCE RLS)`);

      await reset(client);
    } finally {
      client.release();
    }

    console.log("\nWorkspace isolation — ticket_history:");
    const histClient = await pool.connect();
    try {
      const histFin = await pool.query("SELECT count(*)::int AS n FROM ticket_history WHERE workspace='FIN'");
      const histIt = await pool.query("SELECT count(*)::int AS n FROM ticket_history WHERE workspace='IT'");

      await setRole(histClient, "finance_reader");
      await setWorkspace(histClient, "FIN");
      const histFinSeen = await histClient.query("SELECT count(*)::int AS n FROM ticket_history");
      ok("history_finance_reader_FIN", histFinSeen.rows[0].n === histFin.rows[0].n,
         `saw ${histFinSeen.rows[0].n}, expected ${histFin.rows[0].n}`);

      await reset(histClient);
      await setRole(histClient, "it_reader");
      await setWorkspace(histClient, "IT");
      const histItSeen = await histClient.query("SELECT count(*)::int AS n FROM ticket_history");
      ok("history_it_reader_IT", histItSeen.rows[0].n === histIt.rows[0].n,
         `saw ${histItSeen.rows[0].n}, expected ${histIt.rows[0].n}`);

      await reset(histClient);
    } finally {
      histClient.release();
    }

    console.log("\nWorkspace isolation — ticket_comments:");
    const cmtClient = await pool.connect();
    try {
      const cmtFin = await pool.query("SELECT count(*)::int AS n FROM ticket_comments WHERE workspace='FIN'");
      const cmtIt = await pool.query("SELECT count(*)::int AS n FROM ticket_comments WHERE workspace='IT'");

      await setRole(cmtClient, "finance_reader");
      await setWorkspace(cmtClient, "FIN");
      const cmtFinSeen = await cmtClient.query("SELECT count(*)::int AS n FROM ticket_comments");
      ok("comments_finance_reader_FIN", cmtFinSeen.rows[0].n === cmtFin.rows[0].n,
         `saw ${cmtFinSeen.rows[0].n}, expected ${cmtFin.rows[0].n}`);

      await reset(cmtClient);
      await setRole(cmtClient, "it_reader");
      await setWorkspace(cmtClient, "IT");
      const cmtItSeen = await cmtClient.query("SELECT count(*)::int AS n FROM ticket_comments");
      ok("comments_it_reader_IT", cmtItSeen.rows[0].n === cmtIt.rows[0].n,
         `saw ${cmtItSeen.rows[0].n}, expected ${cmtIt.rows[0].n}`);

      await reset(cmtClient);
    } finally {
      cmtClient.release();
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