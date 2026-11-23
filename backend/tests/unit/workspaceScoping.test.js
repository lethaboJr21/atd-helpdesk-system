const {
  scopeTo,
  scopeToMultiple,
  resolveWorkspaceFromRequest,
  normaliseWorkspaceCode,
  buildScopedQuery,
  CANONICAL_CODES,
  WorkspaceContextRequiredError,
  WorkspaceCodeUnrecognisedError,
} = require("../../src/services/workspaceQueryService");

describe("workspaceQueryService", () => {
  describe("normaliseWorkspaceCode", () => {
    it("maps legacy 'finance' to 'FIN'", () => {
      expect(normaliseWorkspaceCode("finance")).toBe("FIN");
    });

    it("maps legacy 'finance department' to 'FIN'", () => {
      expect(normaliseWorkspaceCode("finance department")).toBe("FIN");
    });

    it("maps 'FIN' to 'FIN' (already canonical)", () => {
      expect(normaliseWorkspaceCode("FIN")).toBe("FIN");
    });

    it("maps 'it' to 'IT'", () => {
      expect(normaliseWorkspaceCode("it")).toBe("IT");
    });

    it("maps 'IT Service Request' to 'IT'", () => {
      expect(normaliseWorkspaceCode("IT Service Request")).toBe("IT");
    });

    it("maps 'ERP / Syspro' to 'IT'", () => {
      expect(normaliseWorkspaceCode("ERP / Syspro")).toBe("IT");
    });

    it("maps 'process engineering (pdm)' to 'PDM'", () => {
      expect(normaliseWorkspaceCode("process engineering (pdm)")).toBe("PDM");
    });

    it("maps 'pdm' to 'PDM'", () => {
      expect(normaliseWorkspaceCode("pdm")).toBe("PDM");
    });

    it("returns null for unrecognised values", () => {
      expect(normaliseWorkspaceCode("unknown_workspace")).toBeNull();
    });

    it("returns null for null/undefined/empty", () => {
      expect(normaliseWorkspaceCode(null)).toBeNull();
      expect(normaliseWorkspaceCode(undefined)).toBeNull();
      expect(normaliseWorkspaceCode("")).toBeNull();
      expect(normaliseWorkspaceCode("  ")).toBeNull();
    });

    it("is case-insensitive", () => {
      expect(normaliseWorkspaceCode("FINANCE")).toBe("FIN");
      expect(normaliseWorkspaceCode("Finance")).toBe("FIN");
      expect(normaliseWorkspaceCode("IT")).toBe("IT");
      expect(normaliseWorkspaceCode("it")).toBe("IT");
    });
  });

  describe("scopeTo", () => {
    it("generates parameterised SQL for FIN", () => {
      const result = scopeTo("FIN");
      expect(result.sql).toBe("t.workspace = $1");
      expect(result.params).toEqual(["FIN"]);
    });

    it("generates parameterised SQL for IT with custom alias", () => {
      const result = scopeTo("IT", { alias: "tickets" });
      expect(result.sql).toBe("tickets.workspace = $1");
      expect(result.params).toEqual(["IT"]);
    });

    it("respects paramStart option", () => {
      const result = scopeTo("PDM", { paramStart: 3 });
      expect(result.sql).toBe("t.workspace = $3");
      expect(result.params).toEqual(["PDM"]);
    });

    it("normalises legacy codes before scoping", () => {
      const result = scopeTo("finance");
      expect(result.params).toEqual(["FIN"]);
    });

    it("throws WorkspaceContextRequiredError for empty input", () => {
      expect(() => scopeTo("")).toThrow(WorkspaceContextRequiredError);
      expect(() => scopeTo(null)).toThrow(WorkspaceContextRequiredError);
    });

    it("throws WorkspaceCodeUnrecognisedError for unknown code", () => {
      expect(() => scopeTo("UNKNOWN")).toThrow(WorkspaceCodeUnrecognisedError);
    });
  });

  describe("scopeToMultiple", () => {
    it("generates IN clause for multiple workspaces", () => {
      const result = scopeToMultiple(["IT", "PDM"]);
      expect(result.sql).toBe("t.workspace IN ($1, $2)");
      expect(result.params).toEqual(["IT", "PDM"]);
    });

    it("respects paramStart option", () => {
      const result = scopeToMultiple(["FIN", "IT"], { paramStart: 5 });
      expect(result.sql).toBe("t.workspace IN ($5, $6)");
      expect(result.params).toEqual(["FIN", "IT"]);
    });

    it("normalises legacy codes", () => {
      const result = scopeToMultiple(["finance", "it"]);
      expect(result.params).toEqual(["FIN", "IT"]);
    });

    it("throws for empty array", () => {
      expect(() => scopeToMultiple([])).toThrow(WorkspaceContextRequiredError);
    });
  });

  describe("buildScopedQuery", () => {
    it("adds WHERE when base query has no WHERE", () => {
      const result = buildScopedQuery("SELECT * FROM tickets t", "FIN");
      expect(result.sql).toContain("WHERE t.workspace = $1");
      expect(result.params).toEqual(["FIN"]);
    });

    it("adds AND when base query already has WHERE", () => {
      const result = buildScopedQuery("SELECT * FROM tickets t WHERE t.status = 'Open'", "FIN");
      expect(result.sql).toContain("AND t.workspace = $1");
      expect(result.params).toEqual(["FIN"]);
    });
  });

  describe("resolveWorkspaceFromRequest", () => {
    it("resolves from user.workspace", () => {
      const req = { user: { workspace: "finance" } };
      expect(resolveWorkspaceFromRequest(req)).toBe("FIN");
    });

    it("resolves from user.department when workspace is absent", () => {
      const req = { user: { department: "IT" } };
      expect(resolveWorkspaceFromRequest(req)).toBe("IT");
    });

    it("resolves from financeAccess.isFinanceUser", () => {
      const req = { user: {}, financeAccess: { isFinanceUser: true } };
      expect(resolveWorkspaceFromRequest(req)).toBe("FIN");
    });

    it("resolves from role containing 'finance'", () => {
      const req = { user: { role: "finance_manager" } };
      expect(resolveWorkspaceFromRequest(req)).toBe("FIN");
    });

    it("resolves from role containing 'agent' to IT", () => {
      const req = { user: { role: "agent" } };
      expect(resolveWorkspaceFromRequest(req)).toBe("IT");
    });

    it("throws when workspace cannot be resolved", () => {
      const req = { user: {} };
      expect(() => resolveWorkspaceFromRequest(req)).toThrow(WorkspaceContextRequiredError);
    });
  });

  describe("CANONICAL_CODES", () => {
    it("contains all 5 workspace codes", () => {
      expect(CANONICAL_CODES).toHaveLength(5);
      expect(CANONICAL_CODES).toContain("IT");
      expect(CANONICAL_CODES).toContain("HR");
      expect(CANONICAL_CODES).toContain("FIN");
      expect(CANONICAL_CODES).toContain("FAC");
      expect(CANONICAL_CODES).toContain("PDM");
    });
  });
});