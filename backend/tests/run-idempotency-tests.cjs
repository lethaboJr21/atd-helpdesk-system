require("dotenv").config();
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const pool = require("../src/db/pool");

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) { passed++; console.log(`  OK: ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.error(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

const MIGRATIONS_DIR = path.join(__dirname, "..", "src", "db", "migrations");

const PHASE_MIGRATIONS = [
  { file: "2026-11-19-00-schema-migrations-registry.sql", phase: 0 },
  { file: "2026-11-20-phase1-workspace-discipline.sql", phase: 1 },
  { file: "2026-11-21-phase2-finance-column-migration.sql", phase: 2 },
  { file: "2026-11-22-phase3-rls-roles.sql", phase: 3 },
  { file: "2026-11-22b-cross-workspace-access-tables.sql", phase: 3 },
  { file: "2026-11-23-phase5-cleanup.sql", phase: 5 },
];

(async () => {
  console.log("Migration Idempotency Tests:\n");

  try {
    for (const { file, phase } of PHASE_MIGRATIONS) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const exists = fs.existsSync(filePath);
      ok(`file_exists_${file}`, exists);

      if (!exists) continue;

      const content = fs.readFileSync(filePath, "utf8");

      const hasBegin = content.includes("BEGIN");
      const hasCommit = content.includes("COMMIT");
      ok(`transaction_wrapped_${file}`, hasBegin && hasCommit,
         hasBegin && hasCommit ? "BEGIN/COMMIT present" : "missing BEGIN or COMMIT");

      const usesIfExists = content.includes("IF NOT EXISTS") || content.includes("IF EXISTS");
      const usesOnConflict = content.includes("ON CONFLICT");
      const usesDropIfExists = content.includes("DROP TABLE IF EXISTS") || content.includes("DROP COLUMN IF EXISTS") || content.includes("DROP POLICY IF EXISTS") || content.includes("DROP TRIGGER IF EXISTS");
      const isIdempotent = usesIfExists || usesOnConflict || usesDropIfExists;
      ok(`idempotent_constructs_${file}`, isIdempotent,
         isIdempotent ? "uses idempotent constructs" : "NO idempotent constructs found");

      const hasHeader = content.includes("-- Migration:") || content.includes("-- Phase:");
      ok(`header_comment_${file}`, hasHeader);
    }

    console.log("\nRegistry records all applied migrations:");
    const regEntries = await pool.query(`
      SELECT filename, phase, validation_status FROM schema_migrations
      ORDER BY phase, filename
    `);

    for (const row of regEntries.rows) {
      console.log(`  ${row.filename} | phase ${row.phase} | ${row.validation_status}`);
    }

    ok("registry_has_entries", regEntries.rows.length > 0, `${regEntries.rows.length} entries`);

    const phase5Entry = regEntries.rows.find(r => r.filename.includes("phase5"));
    ok("phase5_passed", phase5Entry?.validation_status === "passed",
        phase5Entry ? phase5Entry.validation_status : "not found");

  } catch (err) {
    console.error("Test error:", err.message);
    failed++;
  } finally {
    await pool.end();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
})();