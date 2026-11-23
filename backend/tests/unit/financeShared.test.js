describe("financeShared utilities", () => {
  const { csvExport, deriveWorkItemFlags, formatFinanceDate, formatElapsed, workItemTone } = require("../../../frontend/src/utils/financeShared");

  describe("deriveWorkItemFlags", () => {
    it("flags overdue when effective due date is in the past", () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const flags = deriveWorkItemFlags({ due_at: past, effective_due_at: past, elapsedPercent: 80 });
      expect(flags.isOverdue).toBe(true);
    });

    it("flags dueWithin24h when due within 24 hours", () => {
      const soon = new Date(Date.now() + 3600000).toISOString();
      const flags = deriveWorkItemFlags({ due_at: soon, effective_due_at: soon, elapsedPercent: 30 });
      expect(flags.dueWithin24h).toBe(true);
      expect(flags.isOverdue).toBe(false);
    });

    it("flags evidenceRequired when evidence_state is required", () => {
      const future = new Date(Date.now() + 86400000 * 7).toISOString();
      const flags = deriveWorkItemFlags({ due_at: future, evidence_state: "required" });
      expect(flags.evidenceRequired).toBe(true);
    });

    it("flags halfElapsed when elapsedPercent >= 50 and not overdue", () => {
      const future = new Date(Date.now() + 86400000 * 7).toISOString();
      const flags = deriveWorkItemFlags({ due_at: future, elapsedPercent: 60 });
      expect(flags.halfElapsed).toBe(true);
    });
  });

  describe("formatFinanceDate", () => {
    it("returns formatted date string for valid date", () => {
      const result = formatFinanceDate("2026-11-15T00:00:00Z");
      expect(result).toContain("2026");
    });

    it("returns 'No due date' for null", () => {
      expect(formatFinanceDate(null)).toBe("No due date");
    });
  });

  describe("workItemTone", () => {
    it("returns overdue tone for overdue items", () => {
      expect(workItemTone({ isOverdue: true })).toContain("border-red-200");
    });

    it("returns 24h tone for due-within-24h items", () => {
      expect(workItemTone({ isOverdue: false, dueWithin24h: true })).toContain("border-amber-200");
    });

    it("returns half-elapsed tone for 50%+ items", () => {
      expect(workItemTone({ isOverdue: false, dueWithin24h: false, elapsedPercent: 60 })).toContain("border-sky-200");
    });

    it("returns default tone for normal items", () => {
      expect(workItemTone({ isOverdue: false, dueWithin24h: false, elapsedPercent: 20 })).toContain("border-slate-200");
    });
  });
});