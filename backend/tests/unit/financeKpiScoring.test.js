describe("financeKpiScoring", () => {
  const scoring = require("../../src/services/financeKpiScoring");

  describe("calculateTimeliness", () => {
    it("returns 100 when completed by effective due date", async () => {
      const result = await scoring.calculateTimeliness({
        completedAt: "2026-11-10T00:00:00Z",
        effectiveDueAt: "2026-11-15T00:00:00Z",
        originalDueAt: "2026-11-15T00:00:00Z",
        hasApprovedExtension: false
      });
      expect(result).toBe(100);
    });

    it("returns 50 when completed after effective due date without approved extension", async () => {
      const result = await scoring.calculateTimeliness({
        completedAt: "2026-11-20T00:00:00Z",
        effectiveDueAt: "2026-11-15T00:00:00Z",
        originalDueAt: "2026-11-15T00:00:00Z",
        hasApprovedExtension: false
      });
      expect(result).toBe(50);
    });

    it("returns 100 when completed within approved extension due date", async () => {
      const result = await scoring.calculateTimeliness({
        completedAt: "2026-11-18T00:00:00Z",
        effectiveDueAt: "2026-11-20T00:00:00Z",
        originalDueAt: "2026-11-15T00:00:00Z",
        hasApprovedExtension: true
      });
      expect(result).toBe(100);
    });

    it("returns null when completedAt is missing", async () => {
      const result = await scoring.calculateTimeliness({
        completedAt: null,
        effectiveDueAt: "2026-11-15T00:00:00Z",
        originalDueAt: "2026-11-15T00:00:00Z",
        hasApprovedExtension: false
      });
      expect(result).toBeNull();
    });
  });

  describe("calculateItemScore", () => {
    it("calculates (timeliness * 0.50) + (quality * 0.50)", async () => {
      const result = await scoring.calculateItemScore(80, 60);
      expect(result).toBe(70);
    });

    it("handles boundary value 0", async () => {
      const result = await scoring.calculateItemScore(0, 0);
      expect(result).toBe(0);
    });

    it("handles boundary value 100", async () => {
      const result = await scoring.calculateItemScore(100, 100);
      expect(result).toBe(100);
    });

    it("handles null quality (treats as 0)", async () => {
      const result = await scoring.calculateItemScore(100, null);
      expect(result).toBe(50);
    });
  });

  describe("calculateReviewerTimeliness", () => {
    it("returns 100 when review completed before deadline", async () => {
      const result = await scoring.calculateReviewerTimeliness({
        reviewCompletedAt: "2026-11-10T00:00:00Z",
        reviewDeadline: "2026-11-15T00:00:00Z"
      });
      expect(result).toBe(100);
    });

    it("returns 0 when review completed after deadline", async () => {
      const result = await scoring.calculateReviewerTimeliness({
        reviewCompletedAt: "2026-11-20T00:00:00Z",
        reviewDeadline: "2026-11-15T00:00:00Z"
      });
      expect(result).toBe(0);
    });

    it("returns null when inputs are missing", async () => {
      const result = await scoring.calculateReviewerTimeliness({
        reviewCompletedAt: null,
        reviewDeadline: null
      });
      expect(result).toBeNull();
    });
  });

  describe("OBJECTIVE_WEIGHTS", () => {
    it("contains the 5 governed objectives with correct weights", () => {
      expect(scoring.OBJECTIVE_WEIGHTS).toEqual({
        "Month-End Close": 30,
        "Reconciliation Control": 25,
        "Cut-off Accuracy": 15,
        "Financial Reporting Quality": 20,
        "Internal Finance Service Delivery": 10
      });
    });

    it("weights sum to 100", () => {
      const total = Object.values(scoring.OBJECTIVE_WEIGHTS).reduce((s, w) => s + w, 0);
      expect(total).toBe(100);
    });
  });
});