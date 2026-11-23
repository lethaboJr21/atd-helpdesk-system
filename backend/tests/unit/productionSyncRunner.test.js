jest.setTimeout(30000);

jest.mock("../../src/services/syncBedlinerDailyProduction", () => ({
  syncBedlinerDailyProduction: jest.fn(),
}));

const { syncBedlinerDailyProduction } = require("../../src/services/syncBedlinerDailyProduction");
const { runBedlinerSync } = require("../../src/services/productionSyncRunner");

describe("productionSyncRunner (Fix D — single-flight coordinator)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("returns succeeded and logs PROD_SYNC_SUCCEEDED on success", async () => {
    syncBedlinerDailyProduction.mockResolvedValue({ synced: 120 });
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const result = await runBedlinerSync({ trigger: "scheduled" });
    expect(result.outcome).toBe("succeeded");
    expect(result.synced).toBe(120);
    expect(result.retriesConsumed).toBe(0);
    const logged = consoleSpy.mock.calls.map((c) => c[0]).find((l) => String(l).includes("PROD_SYNC_SUCCEEDED"));
    expect(logged).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it("skips (never queues) a second trigger while in flight", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    syncBedlinerDailyProduction.mockImplementationOnce(() => gate);
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const first = runBedlinerSync({ trigger: "scheduled" });
    const second = await runBedlinerSync({ trigger: "manual" });
    expect(second.outcome).toBe("skipped");
    expect(second.reason).toBe("overlap");
    const skippedLog = consoleSpy.mock.calls.map((c) => c[0]).find((l) => String(l).includes("PROD_SYNC_SKIPPED_OVERLAP"));
    expect(skippedLog).toBeTruthy();

    release({ synced: 1 });
    const firstResult = await first;
    expect(firstResult.outcome).toBe("succeeded");
    consoleSpy.mockRestore();
  });

  it("retries transient errors with backoff and recovers (fail→fail→succeed)", async () => {
    syncBedlinerDailyProduction
      .mockRejectedValueOnce(Object.assign(new Error("ConnectionError: request timed out"), { name: "ConnectionError" }))
      .mockRejectedValueOnce(Object.assign(new Error("ECONNRESET"), { name: "ConnectionError" }))
      .mockResolvedValueOnce({ synced: 5 });
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const result = await runBedlinerSync({ trigger: "scheduled" });
    expect(result.outcome).toBe("succeeded");
    expect(result.retriesConsumed).toBe(2);
    expect(syncBedlinerDailyProduction).toHaveBeenCalledTimes(3);
    consoleSpy.mockRestore();
  });

  it("fails after max retries on persistent transient errors and releases the lock", async () => {
    syncBedlinerDailyProduction.mockRejectedValue(Object.assign(new Error("request timed out"), { name: "TimeoutError" }));
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const result = await runBedlinerSync({ trigger: "scheduled" });
    expect(result.outcome).toBe("failed");
    expect(result.retriesConsumed).toBe(3);
    expect(syncBedlinerDailyProduction).toHaveBeenCalledTimes(4);
    const failedLog = consoleSpy.mock.calls.map((c) => c[0]).find((l) => String(l).includes("PROD_SYNC_FAILED"));
    expect(failedLog).toBeTruthy();
    consoleSpy.mockRestore();

    syncBedlinerDailyProduction.mockReset();
    syncBedlinerDailyProduction.mockResolvedValue({ synced: 1 });
    const next = await runBedlinerSync({ trigger: "scheduled" });
    expect(next.outcome).toBe("succeeded");
  });

  it("fails fast without retry on non-transient errors", async () => {
    syncBedlinerDailyProduction.mockRejectedValue(Object.assign(new Error("Login failed for user"), { name: "RequestError" }));
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const result = await runBedlinerSync({ trigger: "manual" });
    expect(result.outcome).toBe("failed");
    expect(result.retriesConsumed).toBe(0);
    expect(syncBedlinerDailyProduction).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("never rejects — a cron tick can never crash the process", async () => {
    syncBedlinerDailyProduction.mockImplementation(() => { throw new Error("unexpected"); });
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const result = await runBedlinerSync({ trigger: "scheduled" });
    expect(result.outcome).toBe("failed");
    expect(result.errorCode).toBeTruthy();
    consoleSpy.mockRestore();
  });
});