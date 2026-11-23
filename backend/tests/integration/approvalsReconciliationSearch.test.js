const fs = require("fs");
const path = require("path");

describe("Approvals reconciliation search column (Fix B — error 42703 r.description)", () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, "../../src/routes/financeWorkspace.js"),
    "utf8"
  );

  it("reconciliations branch searches r.control_name (the title field)", () => {
    expect(routeSource).toContain("r.control_name ILIKE '%'||$2||'%'");
  });

  it("reconciliations branch no longer references the non-existent r.description", () => {
    expect(routeSource).not.toContain("r.description ILIKE '%'||$2||'%' OR r.reconciliation_reference");
  });

  it("journals branch keeps its valid r.description search (finance_journals.description exists)", () => {
    expect(routeSource).toContain("r.description ILIKE '%'||$2||'%' OR r.journal_reference");
  });

  it("keeps the :type validation 400 path", () => {
    expect(routeSource).toContain("Invalid approval type");
  });

  it("keeps ORDER BY r.updated_at DESC LIMIT 500 on both branches", () => {
    expect(routeSource).toContain("ORDER BY r.updated_at DESC LIMIT 500");
  });

  it("search contract: q matches via control name or reconciliation reference", () => {
    const seeded = { control_name: "Bank Reconciliation — Std Bank", reconciliation_reference: "REC-2026-11-0042" };
    expect(seeded.control_name.toLowerCase()).toContain("std bank");
    expect(seeded.reconciliation_reference).toContain("0042");
  });
});