describe("mssqlPool recovery (Fix D — poisoned promise reset and env tuning)", () => {
  const REAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...REAL_ENV };
    jest.resetModules();
    jest.restoreAllMocks();
  });

  function setupMockMssql({ connectImpl } = {}) {
    const poolOn = jest.fn();
    const mockPool = { on: poolOn };
    const connect = jest.fn(connectImpl || jest.fn(() => Promise.resolve(mockPool)));
    jest.doMock("mssql", () => ({ connect }));
    return { connect, mockPool, poolOn };
  }

  it("resets the cached promise after a rejected connect — next call reconnects", async () => {
    const { connect, mockPool } = setupMockMssql();
    connect.mockRejectedValueOnce(Object.assign(new Error("ConnectionError: failed"), { name: "ConnectionError" })).mockResolvedValueOnce(mockPool);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { getMssqlPool } = require("../../src/db/mssqlPool");

    await expect(getMssqlPool()).rejects.toThrow("ConnectionError: failed");
    const failedLog = consoleErrorSpy.mock.calls.map((c) => c[0]).find((l) => String(l).includes("MSSQL_CONNECT_FAILED"));
    expect(failedLog).toBeTruthy();

    const pool = await getMssqlPool();
    expect(pool).toBe(mockPool);
    expect(connect).toHaveBeenCalledTimes(2);
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("emits MSSQL_CONNECT_RECOVERED after a successful reconnect following a failure", async () => {
    const { connect, mockPool } = setupMockMssql();
    connect.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(mockPool).mockResolvedValue(mockPool);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { getMssqlPool } = require("../../src/db/mssqlPool");

    await expect(getMssqlPool()).rejects.toThrow("down");
    await getMssqlPool();
    const recoveredLog = consoleLogSpy.mock.calls.map((c) => c[0]).find((l) => String(l).includes("MSSQL_CONNECT_RECOVERED"));
    expect(recoveredLog).toBeTruthy();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("attaches a pool error handler emitting structured MSSQL_POOL_ERROR", async () => {
    const { mockPool, poolOn } = setupMockMssql();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { getMssqlPool } = require("../../src/db/mssqlPool");

    await getMssqlPool();
    expect(poolOn).toHaveBeenCalledWith("error", expect.any(Function));

    const handler = poolOn.mock.calls.find((c) => c[0] === "error")[1];
    handler(Object.assign(new Error("broken connection"), { name: "ConnectionError" }));
    const poolErrorLog = consoleErrorSpy.mock.calls.map((c) => c[0]).find((l) => String(l).includes("MSSQL_POOL_ERROR"));
    expect(poolErrorLog).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });

  it("honours MSSQL_POOL_MAX env override", async () => {
    process.env.MSSQL_POOL_MAX = "4";
    const { connect } = setupMockMssql();
    const { getMssqlPool } = require("../../src/db/mssqlPool");
    await getMssqlPool();
    const config = connect.mock.calls[0][0];
    expect(config.pool.max).toBe(4);
  });

  it("defaults to 10/30000/60000 when env unset (byte-equivalent pre-fix)", async () => {
    delete process.env.MSSQL_POOL_MAX;
    delete process.env.MSSQL_POOL_IDLE_TIMEOUT_MS;
    delete process.env.MSSQL_CONNECTION_TIMEOUT_MS;
    delete process.env.MSSQL_REQUEST_TIMEOUT_MS;
    const { connect } = setupMockMssql();
    const { getMssqlPool } = require("../../src/db/mssqlPool");
    await getMssqlPool();
    const config = connect.mock.calls[0][0];
    expect(config.pool.max).toBe(10);
    expect(config.pool.idleTimeoutMillis).toBe(30000);
    expect(config.connectionTimeout).toBe(30000);
    expect(config.requestTimeout).toBe(60000);
  });

  it("keeps the exported contract { sql, getMssqlPool }", () => {
    setupMockMssql();
    const mssqlPool = require("../../src/db/mssqlPool");
    expect(mssqlPool).toHaveProperty("sql");
    expect(mssqlPool).toHaveProperty("getMssqlPool");
    expect(typeof mssqlPool.getMssqlPool).toBe("function");
  });
});