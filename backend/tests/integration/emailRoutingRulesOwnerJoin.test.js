const fs = require("fs");
const path = require("path");

describe("Email routing rules owner join (Fix C — error 42703 r.owner_user_id)", () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, "../../src/routes/financeWorkspace.js"),
    "utf8"
  );

  it("email-intake/rules joins users on r.owner_user_id to resolve owner_name", () => {
    expect(routeSource).toContain("LEFT JOIN users");
    expect(routeSource).toMatch(/ON o\.id=r\.owner_user_id/);
  });

  it("owner join resolves owner_name in the SELECT list", () => {
    expect(routeSource).toContain("owner_name");
  });

  it("alignment migration M1 exists and is idempotent", () => {
    const migrationPath = path.join(__dirname, "../../src/db/migrations/2026-11-24-finance-owner-column-alignment.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);
    const migration = fs.readFileSync(migrationPath, "utf8");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS owner_user_id BIGINT");
    expect(migration).toContain("SET owner_user_id = created_by");
    expect(migration).toContain("SET NOT NULL");
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("COMMIT;");
  });

  it("rollback migration drops only what M1 added", () => {
    const rollbackPath = path.join(__dirname, "../../src/db/migrations/2026-11-24-finance-owner-column-alignment-rollback.sql");
    expect(fs.existsSync(rollbackPath)).toBe(true);
    const rollback = fs.readFileSync(rollbackPath, "utf8");
    expect(rollback).toContain("DROP COLUMN IF EXISTS owner_user_id");
  });
});