jest.mock("../../src/utils/schemaDriftWarning", () => ({
  warnSchemaDrift: jest.fn(),
}));

const { warnSchemaDrift } = require("../../src/utils/schemaDriftWarning");
const { getFinanceReportingSummary } = require("../../src/services/financeReportingSummary");

describe("Finance reporting summary schema compatibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the KPI-linked query when the schema supports it", async () => {
    const rows = [{ id: 1, finance_kpi_id: 7, finance_kpi_name: "Accuracy" }];
    const database = { query: jest.fn().mockResolvedValue({ rows }) };

    await expect(getFinanceReportingSummary(database)).resolves.toEqual({
      tickets: rows,
      kpiLinkAvailable: true,
    });
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(warnSchemaDrift).not.toHaveBeenCalled();
  });

  it("returns ticket reporting without KPI links and warns on the known missing column", async () => {
    const missingColumn = Object.assign(
      new Error('column fo.finance_kpi_id does not exist'),
      { code: "42703" }
    );
    const rows = [{ id: 1, finance_kpi_id: null, finance_kpi_name: null }];
    const database = {
      query: jest.fn()
        .mockRejectedValueOnce(missingColumn)
        .mockResolvedValueOnce({ rows }),
    };

    await expect(getFinanceReportingSummary(database)).resolves.toEqual({
      tickets: rows,
      kpiLinkAvailable: false,
    });
    expect(database.query).toHaveBeenCalledTimes(2);
    expect(database.query.mock.calls[1][0]).not.toContain("fo.finance_kpi_id");
    expect(warnSchemaDrift).toHaveBeenCalledWith({
      route: "/api/finance-workspace/reporting-summary",
      table: "finance_ticket_operations",
      error: missingColumn,
    });
  });

  it("does not hide unrelated database errors", async () => {
    const failure = Object.assign(new Error("permission denied"), { code: "42501" });
    const database = { query: jest.fn().mockRejectedValue(failure) };

    await expect(getFinanceReportingSummary(database)).rejects.toBe(failure);
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(warnSchemaDrift).not.toHaveBeenCalled();
  });
});
