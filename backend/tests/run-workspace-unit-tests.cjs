const assert = require("assert");
const path = require("path");

const {
  scopeTo,
  scopeToMultiple,
  resolveWorkspaceFromRequest,
  normaliseWorkspaceCode,
  buildScopedQuery,
  CANONICAL_CODES,
  WorkspaceContextRequiredError,
  WorkspaceCodeUnrecognisedError,
} = require("../src/services/workspaceQueryService");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  OK: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log("normaliseWorkspaceCode:");
test("maps 'finance' -> 'FIN'", () => assert.strictEqual(normaliseWorkspaceCode("finance"), "FIN"));
test("maps 'finance department' -> 'FIN'", () => assert.strictEqual(normaliseWorkspaceCode("finance department"), "FIN"));
test("maps 'FIN' -> 'FIN'", () => assert.strictEqual(normaliseWorkspaceCode("FIN"), "FIN"));
test("maps 'it' -> 'IT'", () => assert.strictEqual(normaliseWorkspaceCode("it"), "IT"));
test("maps 'IT Service Request' -> 'IT'", () => assert.strictEqual(normaliseWorkspaceCode("IT Service Request"), "IT"));
test("maps 'ERP / Syspro' -> 'IT'", () => assert.strictEqual(normaliseWorkspaceCode("ERP / Syspro"), "IT"));
test("maps 'process engineering (pdm)' -> 'PDM'", () => assert.strictEqual(normaliseWorkspaceCode("process engineering (pdm)"), "PDM"));
test("maps 'pdm' -> 'PDM'", () => assert.strictEqual(normaliseWorkspaceCode("pdm"), "PDM"));
test("returns null for 'unknown'", () => assert.strictEqual(normaliseWorkspaceCode("unknown"), null));
test("returns null for null", () => assert.strictEqual(normaliseWorkspaceCode(null), null));
test("returns null for undefined", () => assert.strictEqual(normaliseWorkspaceCode(undefined), null));
test("returns null for empty", () => assert.strictEqual(normaliseWorkspaceCode(""), null));
test("case-insensitive: 'FINANCE' -> 'FIN'", () => assert.strictEqual(normaliseWorkspaceCode("FINANCE"), "FIN"));

console.log("\nscopeTo:");
test("generates SQL for FIN", () => {
  const r = scopeTo("FIN");
  assert.strictEqual(r.sql, "t.workspace = $1");
  assert.deepStrictEqual(r.params, ["FIN"]);
});
test("generates SQL with custom alias", () => {
  const r = scopeTo("IT", { alias: "tickets" });
  assert.strictEqual(r.sql, "tickets.workspace = $1");
  assert.deepStrictEqual(r.params, ["IT"]);
});
test("respects paramStart", () => {
  const r = scopeTo("PDM", { paramStart: 3 });
  assert.strictEqual(r.sql, "t.workspace = $3");
  assert.deepStrictEqual(r.params, ["PDM"]);
});
test("normalises legacy codes", () => {
  const r = scopeTo("finance");
  assert.deepStrictEqual(r.params, ["FIN"]);
});
test("throws for empty input", () => {
  assert.throws(() => scopeTo(""), WorkspaceContextRequiredError);
});
test("throws for unknown code", () => {
  assert.throws(() => scopeTo("UNKNOWN"), WorkspaceCodeUnrecognisedError);
});

console.log("\nscopeToMultiple:");
test("generates IN clause", () => {
  const r = scopeToMultiple(["IT", "PDM"]);
  assert.strictEqual(r.sql, "t.workspace IN ($1, $2)");
  assert.deepStrictEqual(r.params, ["IT", "PDM"]);
});
test("respects paramStart", () => {
  const r = scopeToMultiple(["FIN", "IT"], { paramStart: 5 });
  assert.strictEqual(r.sql, "t.workspace IN ($5, $6)");
  assert.deepStrictEqual(r.params, ["FIN", "IT"]);
});
test("normalises legacy codes", () => {
  const r = scopeToMultiple(["finance", "it"]);
  assert.deepStrictEqual(r.params, ["FIN", "IT"]);
});
test("throws for empty array", () => {
  assert.throws(() => scopeToMultiple([]), WorkspaceContextRequiredError);
});

console.log("\nbuildScopedQuery:");
test("adds WHERE when no WHERE exists", () => {
  const r = buildScopedQuery("SELECT * FROM tickets t", "FIN");
  assert.ok(r.sql.includes("WHERE t.workspace = $1"));
  assert.deepStrictEqual(r.params, ["FIN"]);
});
test("adds AND when WHERE exists", () => {
  const r = buildScopedQuery("SELECT * FROM tickets t WHERE t.status = 'Open'", "FIN");
  assert.ok(r.sql.includes("AND t.workspace = $1"));
  assert.deepStrictEqual(r.params, ["FIN"]);
});

console.log("\nresolveWorkspaceFromRequest:");
test("resolves from user.workspace", () => {
  assert.strictEqual(resolveWorkspaceFromRequest({ user: { workspace: "finance" } }), "FIN");
});
test("resolves from user.department", () => {
  assert.strictEqual(resolveWorkspaceFromRequest({ user: { department: "IT" } }), "IT");
});
test("resolves from financeAccess.isFinanceUser", () => {
  assert.strictEqual(resolveWorkspaceFromRequest({ user: {}, financeAccess: { isFinanceUser: true } }), "FIN");
});
test("resolves from role 'finance_manager'", () => {
  assert.strictEqual(resolveWorkspaceFromRequest({ user: { role: "finance_manager" } }), "FIN");
});
test("resolves from role 'agent' to IT", () => {
  assert.strictEqual(resolveWorkspaceFromRequest({ user: { role: "agent" } }), "IT");
});
test("throws when unresolvable", () => {
  assert.throws(() => resolveWorkspaceFromRequest({ user: {} }), WorkspaceContextRequiredError);
});

console.log("\nCANONICAL_CODES:");
test("contains all 5 codes", () => {
  assert.strictEqual(CANONICAL_CODES.length, 5);
  for (const c of ["IT", "HR", "FIN", "FAC", "PDM"]) {
    assert.ok(CANONICAL_CODES.includes(c), `Missing ${c}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);