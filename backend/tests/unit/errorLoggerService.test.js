jest.mock("../../src/db/pool", () => ({
  query: jest.fn(),
}));

const pool = require("../../src/db/pool");
const { listEntries, updateResolution } = require("../../src/services/errorLoggerService");

describe("errorLoggerService.listEntries", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it("lists active snapshots when no filters are supplied", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    await expect(listEntries()).resolves.toEqual({
      entries: [],
      total: 0,
      page: 1,
      limit: 50,
    });

    expect(pool.query.mock.calls[0][0]).toContain(
      'FROM error_log_entries WHERE "archived_at" IS NULL'
    );
    expect(pool.query.mock.calls[1][0]).toContain(
      'FROM error_log_entries WHERE "archived_at" IS NULL'
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.any(String), [50, 0]
    );
  });

  it("filters error entries by resolution status", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    await listEntries({ resolutionStatus: "fixed" });

    expect(pool.query.mock.calls[0][0]).toContain('"resolutionStatus"=$1');
    expect(pool.query).toHaveBeenNthCalledWith(1, expect.any(String), ["fixed", 50, 0]);
  });

  it("supports partial error-type searches", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    await listEntries({ errorType: "Type" });

    expect(pool.query.mock.calls[0][0]).toContain('"errorType" ILIKE $1');
    expect(pool.query).toHaveBeenNthCalledWith(1, expect.any(String), ["%Type%", 50, 0]);
  });

  it("joins multiple filters after a valid WHERE clause", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    await listEntries({
      severity: "Medium",
      sourceFile: "tickets.js",
      dateFrom: "2026-11-20",
      resolutionStatus: "open",
    });

    expect(pool.query.mock.calls[0][0]).toContain(
      'WHERE "severity"=$1 AND "sourceFile" ILIKE $2 AND "timestamp">=$3 AND "resolutionStatus"=$4 AND "archived_at" IS NULL'
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["Medium", "%tickets.js%", "2026-11-20", "open", 50, 0]
    );
  });

  it("requires a solution before an entry can be marked fixed", async () => {
    await expect(
      updateResolution("correlation-id", { status: "fixed", solution: " " }, 7)
    ).rejects.toMatchObject({ status: 400 });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("stores the fix status and solution", async () => {
    const fixedEntry = {
      correlationId: "correlation-id",
      resolutionStatus: "fixed",
      resolutionSolution: "Restored the missing query predicate.",
    };
    pool.query.mockResolvedValueOnce({ rows: [fixedEntry] });

    await expect(
      updateResolution(
        "correlation-id",
        { status: "fixed", solution: fixedEntry.resolutionSolution },
        7
      )
    ).resolves.toEqual(fixedEntry);

    expect(pool.query.mock.calls[0][0]).toContain('"resolutionStatus"=$2');
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["correlation-id", "fixed", fixedEntry.resolutionSolution, 7]
    );
  });
});
