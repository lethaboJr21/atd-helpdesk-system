const fs = require("fs");
const path = require("path");

describe("KPI score query type consistency (Fix A — error 42804)", () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, "../../src/routes/financeWorkspace.js"),
    "utf8"
  );
  const scoringSource = fs.readFileSync(
    path.join(__dirname, "../../src/services/financeKpiScoring.js"),
    "utf8"
  );

  describe("/kpi-scores work-item UNION", () => {
    it("casts $2::bigint on the tickets branch", () => {
      expect(routeSource).toContain("assigned_to_user_id=$2::bigint");
    });

    it("casts $2::bigint on the finance_close_tasks branch", () => {
      expect(routeSource).toContain("finance_close_tasks WHERE owner_user_id=$2::bigint");
    });

    it("has no uncast $2 comparison remaining in the UNION", () => {
      expect(routeSource).not.toContain("assigned_to_user_id=$2 UNION");
      expect(routeSource).not.toContain("owner_user_id=$2 UNION");
    });

    it("keeps the manager-scope 403 guard for other users' scores", () => {
      expect(routeSource).toContain("Manager scope required to view other employee KPI scores.");
    });
  });

  describe("aggregateObjectiveScores four-way UNION (repairs /my-kpi)", () => {
    it("casts $3::bigint on the tickets branch", () => {
      expect(scoringSource).toContain("t.assigned_to_user_id=$3::bigint");
    });

    it("casts $3::bigint on the journals branch", () => {
      expect(scoringSource).toContain("preparer_user_id=$3::bigint");
    });

    it("casts $3::bigint on the reconciliations branch", () => {
      expect(scoringSource).toContain("finance_reconciliations WHERE owner_user_id=$3::bigint");
    });

    it("casts $3::bigint on the close tasks branch", () => {
      expect(scoringSource).toContain("finance_close_tasks WHERE owner_user_id=$3::bigint");
    });

    it("has no uncast $3 comparison remaining", () => {
      expect(scoringSource).not.toContain("assigned_to_user_id=$3 AND");
      expect(scoringSource).not.toContain("preparer_user_id=$3 AND");
      expect(scoringSource).not.toMatch(/owner_user_id=\$3 AND/);
    });
  });

  describe("parameterized query discipline (RC-1)", () => {
    it("uses $1/$2 placeholders, not string interpolation, in /kpi-scores", () => {
      expect(routeSource).toContain("WHERE s.period_key=$1");
    });
  });
});