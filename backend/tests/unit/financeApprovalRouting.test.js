describe("financeApprovalRouting", () => {
  const routing = require("../../src/services/financeApprovalRouting");

  describe("checkSeparationOfDuties", () => {
    it("returns valid:true when preparer and approver are different", async () => {
      const result = await routing.checkSeparationOfDuties({preparerUserId: 1, approverUserId: 2});
      expect(result.valid).toBe(true);
    });

    it("returns valid:false with violation when preparer is approver", async () => {
      const result = await routing.checkSeparationOfDuties({preparerUserId: 1, approverUserId: 1});
      expect(result.valid).toBe(false);
      expect(result.violation).toBe("preparer_is_approver");
    });

    it("returns valid:true when either ID is missing", async () => {
      const result = await routing.checkSeparationOfDuties({preparerUserId: null, approverUserId: 2});
      expect(result.valid).toBe(true);
    });
  });
});