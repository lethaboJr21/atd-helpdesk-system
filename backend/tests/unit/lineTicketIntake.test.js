const {
  authorizeLineTicketIntake,
} = require("../../src/services/lineTicketIntake");

const employee = { department: "Production" };
const networkItem = {
  category: "Network",
  sub_category: "Connectivity",
  item_name: "Cannot connect to Wi-Fi",
};

function databaseWith(...rows) {
  const queue = [...rows];
  return {
    query: jest.fn(async () => ({ rows: queue.shift() || [] })),
  };
}

function intake(overrides = {}) {
  return {
    actorId: 7,
    workspace: "IT",
    ticketType: "incident",
    category: networkItem.category,
    subCategory: networkItem.sub_category,
    itemCategory: networkItem.item_name,
    details: {
      catalogItemId: 14,
      catalogItemName: networkItem.item_name,
    },
    ...overrides,
  };
}

describe("Production line ticket intake", () => {
  it("does not apply line restrictions to other departments", async () => {
    const database = databaseWith([{ department: "Finance" }]);
    await expect(authorizeLineTicketIntake(database, intake())).resolves.toEqual({
      isLineReporter: false,
    });
  });

  it("allows an active Network catalogue item for a Production reporter", async () => {
    const database = databaseWith([employee], [networkItem]);
    await expect(authorizeLineTicketIntake(database, intake())).resolves.toMatchObject({
      isLineReporter: true,
      workspace: "IT",
    });
  });

  it("uses the selected catalogue name for Network service requests", async () => {
    const database = databaseWith([employee], [networkItem]);
    await expect(authorizeLineTicketIntake(database, intake({
      ticketType: "service_request",
      itemCategory: null,
    }))).resolves.toMatchObject({
      isLineReporter: true,
      workspace: "IT",
    });
  });

  it("rejects a Production IT ticket that does not match an active Network item", async () => {
    const database = databaseWith([employee], [{
      ...networkItem,
      category: "Applications",
    }]);
    await expect(authorizeLineTicketIntake(database, intake())).rejects.toMatchObject({
      status: 400,
      code: "LINE_IT_NETWORK_CATALOGUE_INVALID",
    });
  });

  it("limits Production reporters to IT or PDM", async () => {
    const database = databaseWith([employee]);
    await expect(authorizeLineTicketIntake(database, intake({
      workspace: "Finance",
    }))).rejects.toMatchObject({
      status: 403,
      code: "LINE_WORKSPACE_SCOPE_DENIED",
    });
  });

  it("leaves PDM catalogue validation to the governed PDM intake service", async () => {
    const database = databaseWith([employee]);
    await expect(authorizeLineTicketIntake(database, intake({
      workspace: "PDM",
      ticketType: "incident",
    }))).resolves.toEqual({
      isLineReporter: true,
      workspace: "PDM",
    });
  });
});
