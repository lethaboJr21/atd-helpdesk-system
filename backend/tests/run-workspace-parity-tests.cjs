const assert = require("assert");
const pool = require("../src/db/pool");
const { scopeTo } = require("../src/services/workspaceQueryService");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  OK: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

async function countBy(sql, params = []) {
  const r = await pool.query(`SELECT COUNT(*)::int count FROM tickets t WHERE ${sql}`, params);
  return r.rows[0].count;
}

async function idsBy(sql, params = []) {
  const r = await pool.query(`SELECT t.id FROM tickets t WHERE ${sql} ORDER BY t.id`, params);
  return r.rows.map((x) => x.id);
}

async function main() {
  console.log("Post-Phase-1: legacy patterns no longer match (workspace normalised)");
  await test("LIKE '%finance%' returns 0 (values normalised to 'FIN')", async () => {
    const legacy = await countBy("LOWER(COALESCE(t.workspace,'')) LIKE '%finance%'");
    assert.strictEqual(legacy, 0, `Expected 0, got ${legacy}`);
  });
  await test("= 'finance' returns 0 (values normalised to 'FIN')", async () => {
    const legacy = await countBy("LOWER(COALESCE(t.workspace,'')) = 'finance'");
    assert.strictEqual(legacy, 0, `Expected 0, got ${legacy}`);
  });

  console.log("\nCanonical patterns return correct results");
  const finCount = await countBy("t.workspace = 'FIN'");
  const itCount = await countBy("t.workspace = 'IT'");
  const pdmCount = await countBy("t.workspace = 'PDM'");
  const hrCount = await countBy("t.workspace = 'HR'");
  const facCount = await countBy("t.workspace = 'FAC'");
  const totalCount = await countBy("TRUE");
  console.log(`    FIN=${finCount}, IT=${itCount}, PDM=${pdmCount}, HR=${hrCount}, FAC=${facCount}, total=${totalCount}`);

  await test("FIN > 0 (has Finance tickets)", () => assert.ok(finCount > 0));
  await test("IT > 0 (has IT tickets)", () => assert.ok(itCount > 0));
  await test("FIN + IT + PDM + HR + FAC = total", () => {
    assert.strictEqual(finCount + itCount + pdmCount + hrCount + facCount, totalCount);
  });

  console.log("\nLegacy <> 'finance' now returns ALL tickets (none match 'finance')");
  await test("<> 'finance' = total (no ticket has 'finance')", async () => {
    const legacy = await countBy("LOWER(COALESCE(t.workspace,'')) <> 'finance'");
    assert.strictEqual(legacy, totalCount);
  });

  console.log("\nscopeTo() generates correct SQL");
  await test("scopeTo('FIN') matches t.workspace = 'FIN'", async () => {
    const scope = scopeTo("FIN", { alias: "t", paramStart: 1 });
    const scoped = await idsBy(scope.sql, scope.params);
    const direct = await idsBy("t.workspace = 'FIN'");
    assert.deepStrictEqual(scoped, direct);
  });
  await test("scopeTo('IT') matches t.workspace = 'IT'", async () => {
    const scope = scopeTo("IT", { alias: "t", paramStart: 1 });
    const scoped = await idsBy(scope.sql, scope.params);
    const direct = await idsBy("t.workspace = 'IT'");
    assert.deepStrictEqual(scoped, direct);
  });
  await test("scopeTo('finance') normalises to FIN", async () => {
    const scope = scopeTo("finance", { alias: "t", paramStart: 1 });
    assert.deepStrictEqual(scope.params, ["FIN"]);
    const scoped = await idsBy(scope.sql, scope.params);
    assert.strictEqual(scoped.length, finCount);
  });

  console.log("\nAll workspace values are canonical codes");
  await test("no non-canonical workspace values", async () => {
    const r = await pool.query("SELECT DISTINCT t.workspace FROM tickets t WHERE t.workspace IS NOT NULL ORDER BY t.workspace");
    const codes = r.rows.map((x) => x.workspace);
    const canonical = ["FIN", "HR", "IT", "FAC", "PDM"];
    for (const code of codes) {
      assert.ok(canonical.includes(code), `Non-canonical workspace: ${code}`);
    }
  });

  console.log("\nNo NULL workspace values (Phase 1 NOT NULL constraint)");
  await test("no NULL workspace values", async () => {
    const nullCount = await countBy("t.workspace IS NULL");
    assert.strictEqual(nullCount, 0);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Fatal error:", e.message);
  await pool.end();
  process.exit(1);
});