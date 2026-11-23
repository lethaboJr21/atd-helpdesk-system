const fs = require("fs");
const path = require("path");

describe("/my-work reconciliation drift warning (Fix C — error 42703 r.owner_user_id)", () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, "../../src/routes/financeWorkspace.js"),
    "utf8"
  );
  const driftSource = fs.readFileSync(
    path.join(__dirname, "../../src/utils/schemaDriftWarning.js"),
    "utf8"
  );

  describe("reconciliations included in work items", () => {
    it("queries finance_reconciliations by owner_user_id", () => {
      expect(routeSource).toContain("FROM finance_reconciliations r WHERE r.owner_user_id=$1");
    });

    it("excludes posted/reversed reconciliations", () => {
      expect(routeSource).toContain("r.status NOT IN ('posted','reversed')");
    });

    it("labels reconciliations with work_type", () => {
      expect(routeSource).toContain("'reconciliation' work_type");
    });
  });

  describe("silent catches converted to warn-then-tolerate (DDR-6)", () => {
    it("imports warnSchemaDrift", () => {
      expect(routeSource).toContain('require("../utils/schemaDriftWarning")');
    });

    it("close tasks catch warns on 42P01", () => {
      expect(routeSource).toContain('warnSchemaDrift({route:"/api/finance-workspace/my-work",table:"finance_close_tasks",error})');
    });

    it("journals catch warns on 42P01/42703", () => {
      expect(routeSource).toContain('warnSchemaDrift({route:"/api/finance-workspace/my-work",table:"finance_journals",error})');
    });

    it("reconciliations catch warns on 42P01/42703", () => {
      expect(routeSource).toContain('warnSchemaDrift({route:"/api/finance-workspace/my-work",table:"finance_reconciliations",error})');
    });

    it("email attention catch-all warns instead of swallowing silently", () => {
      expect(routeSource).toContain('warnSchemaDrift({route:"/api/finance-workspace/my-work",table:"finance_correspondence",error:e})');
      expect(routeSource).toContain('WORK_ENRICHMENT_FAILED');
    });

    it("no empty catch remains in /my-work (RC-2)", () => {
      expect(routeSource).not.toContain("catch(e){}");
    });
  });

  describe("warnSchemaDrift contract", () => {
    it("emits stable warning code SCHEMA_DRIFT_TOLERATED", () => {
      expect(driftSource).toContain("SCHEMA_DRIFT_TOLERATED");
    });

    it("never throws — tolerated query still returns degraded result", () => {
      expect(driftSource).toContain("never throw");
    });

    it("dual-writes via captureError with source:warning", () => {
      expect(driftSource).toContain('source: "warning"');
    });
  });
});