jest.mock("../../src/db/pool", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const { authorizePdmTicketIntake } = require("../../src/services/pdmTicketIntake");
const { requesterPriority } = require("../../src/services/ticketGovernance");

const engineer = { id: 1, department: "PDM", job_title: "Process Engineer", role: "user" };
const supervisor = { id: 2, department: "Production", job_title: "Senior Production Supervisor", role: "user" };
const operator = { id: 3, department: "Production", job_title: "Operator", role: "user" };
const catalogueItem = {
  id: 22,
  category: "Application",
  sub_category: "MES",
  item_name: "Cannot print",
  default_priority: "Medium",
  priority_locked: true,
  default_group_id: 90,
};

function databaseWith(...rows) {
  const queue = [...rows];
  return {
    query: jest.fn(async () => ({ rows: queue.shift() || [] })),
  };
}

function intake(overrides = {}) {
  return {
    actorId: engineer.id,
    requesterId: engineer.id,
    workspace: "PDM",
    ticketType: "incident",
    details: {
      catalogItemId: catalogueItem.id,
      catalogItemName: catalogueItem.item_name,
    },
    priority: catalogueItem.default_priority,
    category: catalogueItem.category,
    subCategory: catalogueItem.sub_category,
    itemCategory: catalogueItem.item_name,
    ...overrides,
  };
}

describe("PDM ticket intake", () => {
  it("allows a PDM Process Engineer to submit the exact catalogue priority", async () => {
    const database = databaseWith([engineer], [catalogueItem]);
    await expect(authorizePdmTicketIntake(database, intake())).resolves.toMatchObject({
      isPdm: true,
      allowHigh: true,
      isProxy: false,
      defaultGroupId: 90,
    });
  });

  it("allows an operator to report for a Production supervisor with the required attestation", async () => {
    const database = databaseWith([operator], [supervisor], [catalogueItem]);
    await expect(authorizePdmTicketIntake(database, intake({
      actorId: operator.id,
      requesterId: supervisor.id,
      details: {
        catalogItemId: catalogueItem.id,
        catalogItemName: catalogueItem.item_name,
        pdmSupervisorLoginUnavailable: true,
        pdmSupervisorLoginUnavailableReason: "Supervisor cannot access company email.",
      },
    }))).resolves.toMatchObject({ isPdm: true, isProxy: true });
  });

  it("allows a supervisor-attested guest operator report but rejects the same proxy without approval", async () => {
    const approved = databaseWith([supervisor], [operator], [catalogueItem]);
    await expect(authorizePdmTicketIntake(approved, intake({
      actorId: supervisor.id,
      requesterId: operator.id,
      supervisorApproval: true,
    }))).resolves.toMatchObject({ isPdm: true, isProxy: true });

    const unapproved = databaseWith([supervisor], [operator]);
    await expect(authorizePdmTicketIntake(unapproved, intake({
      actorId: supervisor.id,
      requesterId: operator.id,
    }))).rejects.toMatchObject({ status: 403, code: "PDM_PROXY_REPORT_FORBIDDEN" });
  });

  it("rejects operator self-reporting and a priority that differs from the catalogue", async () => {
    const selfReport = databaseWith([operator], [catalogueItem]);
    await expect(authorizePdmTicketIntake(selfReport, intake({
      actorId: operator.id,
      requesterId: operator.id,
    }))).rejects.toMatchObject({ status: 403, code: "PDM_REPORTER_FORBIDDEN" });

    const wrongPriority = databaseWith([engineer], [catalogueItem]);
    await expect(authorizePdmTicketIntake(wrongPriority, intake({
      priority: "High",
    }))).rejects.toMatchObject({ status: 400, code: "PDM_CATALOGUE_PRIORITY_LOCKED" });
  });

  it("allows governed High priority for eligible PDM intake but never Critical for requesters", () => {
    expect(requesterPriority({ role: "user" }, "High", { allowHigh: true })).toBe("High");
    expect(() => requesterPriority({ role: "user" }, "High")).toThrow("Requesters may create only Low or Medium priority tickets.");
    expect(() => requesterPriority({ role: "user" }, "Critical", { allowHigh: true })).toThrow("Requesters may create only Low or Medium priority tickets.");
  });
});
