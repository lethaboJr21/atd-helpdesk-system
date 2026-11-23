jest.mock("../../src/db/pool", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const pool = require("../../src/db/pool");
const {
  validateProject,
  validateTask,
  validateAnnouncement,
  getProjectAccess,
} = require("../../src/services/projectManagementService");

describe("projectManagementService validators", () => {
  it("normalizes project details and rejects an end date before the start date", () => {
    expect(validateProject({
      name: "Migration",
      description: "Phase one",
      startDate: "2026-12-01",
      dueDate: "2026-12-15",
    })).toMatchObject({
      name: "Migration",
      startDate: "2026-12-01",
      dueDate: "2026-12-15",
    });

    expect(() => validateProject({
      name: "Migration",
      startDate: "2026-12-15",
      dueDate: "2026-12-01",
    })).toThrow("Project due date cannot be before its start date.");
  });

  it("requires a single owner and valid due date for every task or deliverable", () => {
    expect(() => validateTask({
      title: "Publish plan",
      dueDate: "2026-12-15",
    })).toThrow("Deliverable owner must be a valid ID.");

    expect(() => validateTask({
      title: "Publish plan",
      ownerUserId: 7,
      dueDate: "2026-02-30",
    })).toThrow("Due date must be a valid calendar date.");

    expect(validateTask({
      title: "Publish plan",
      ownerUserId: 7,
      dueDate: "2026-12-15",
      taskType: "deliverable",
    })).toMatchObject({
      ownerUserId: 7,
      dueDate: "2026-12-15",
      taskType: "deliverable",
      priority: "Medium",
    });
  });

  it("requires an announcement title and body", () => {
    expect(() => validateAnnouncement({ title: "Update" })).toThrow("Announcement title and message are required.");
    expect(validateAnnouncement({ title: "Update", body: "Schedule confirmed" })).toEqual({
      title: "Update",
      body: "Schedule confirmed",
    });
  });

  it("does not grant project access to administrators who are not members", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 9, status: "active" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(getProjectAccess(9, { id: 2, role: "admin" })).rejects.toMatchObject({
      status: 403,
      code: "PROJECT_ACCESS_DENIED",
    });
  });
});
