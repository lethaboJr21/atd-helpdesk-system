jest.mock("../../src/db/pool", () => ({
  query: jest.fn(),
}));

jest.mock("../../src/services/workspaceQueryService", () => ({
  scopeTo: jest.fn(() => ({ sql: "t.workspace=$1", params: ["IT"] })),
}));

const pool = require("../../src/db/pool");
const { getTaskQueue } = require("../../src/services/itDashboardService");

describe("itDashboardService.getTaskQueue", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it("returns active IT tickets ordered for triage and their full count", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 12,
        ticket_ref: "IT-12",
        is_overdue: true,
        total_count: 7,
      }],
    });

    await expect(getTaskQueue()).resolves.toEqual({
      tickets: [{ id: 12, ticket_ref: "IT-12", is_overdue: true }],
      total: 7,
      limit: 100,
    });

    expect(pool.query.mock.calls[0][0]).toContain("t.status NOT IN('Resolved','Closed')");
    expect(pool.query.mock.calls[0][0]).toContain("ORDER BY");
    expect(pool.query.mock.calls[0][0]).toContain("t.due_at ASC NULLS LAST");
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ["IT", 60, 100]);
  });

  it("applies priority, status, owner, and category filters with bound values", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await getTaskQueue({
      priority: "High",
      status: "In Progress",
      agentId: "unassigned",
      category: "Hardware",
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("t.priority=$2");
    expect(sql).toContain("t.status=$3");
    expect(sql).toContain("t.assigned_to_user_id IS NULL");
    expect(sql).toContain("t.category=$4");
    expect(params).toEqual(["IT", "High", "In Progress", "Hardware", 60, 100]);
  });

  it("rejects malformed agent filters", async () => {
    await expect(getTaskQueue({ agentId: "not-an-id" })).rejects.toMatchObject({
      status: 400,
    });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
