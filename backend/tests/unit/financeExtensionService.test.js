describe("financeExtensionService", () => {
  const extension = require("../../src/services/financeExtensionService");

  describe("createExtensionRequest validation", () => {
    it("rejects reason shorter than 5 characters", async () => {
      await expect(extension.createExtensionRequest({
        workItemId: 1, workItemType: "ticket",
        requestedDueAt: "2026-11-30T00:00:00Z", reason: "no", requestedBy: 1
      })).rejects.toThrow("at least 5 characters");
    });

    it("rejects invalid work item type", async () => {
      await expect(extension.createExtensionRequest({
        workItemId: 1, workItemType: "invalid_type",
        requestedDueAt: "2026-11-30T00:00:00Z", reason: "valid reason", requestedBy: 1
      })).rejects.toThrow("Invalid work item type");
    });
  });
});