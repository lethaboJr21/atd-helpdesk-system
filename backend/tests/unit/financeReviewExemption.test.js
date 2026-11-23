describe("financeReviewExemption", () => {
  const exemption = require("../../src/services/financeReviewExemption");

  describe("grantExemption validation", () => {
    it("rejects reason shorter than 5 characters", async () => {
      await expect(exemption.grantExemption({
        workItemId: 1, workItemType: "journal", reason: "no", approverUserId: 1
      })).rejects.toThrow("at least 5 characters");
    });
  });

  describe("revokeExemption validation", () => {
    it("rejects revocation reason shorter than 5 characters", async () => {
      await expect(exemption.revokeExemption({
        workItemId: 1, workItemType: "journal", revocationReason: "no", revokedBy: 1
      })).rejects.toThrow("at least 5 characters");
    });
  });
});