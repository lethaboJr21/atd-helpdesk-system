jest.mock("../../src/db/pool", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock("../../src/services/systemSettings", () => ({
  clearSettingsCache: jest.fn(),
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));

const pool = require("../../src/db/pool");
const systemSettings = require("../../src/services/systemSettings");
const hrWorkspaceService = require("../../src/services/hrWorkspaceService");
const { validateRequest } = hrWorkspaceService;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("hrWorkspaceService.validateRequest", () => {
  it("normalizes a valid new account request", () => {
    expect(validateRequest({
      requestType: "ad_account",
      employeeName: "Jordan Lee",
      employeeEmail: "JORDAN.LEE@example.com",
      department: "Finance",
      startDate: "2026-12-01",
    })).toMatchObject({
      requestType: "ad_account",
      employeeName: "Jordan Lee",
      employeeEmail: "jordan.lee@example.com",
      department: "Finance",
      startDate: "2026-12-01",
    });
  });

  it("requires an effective date for offboarding", () => {
    expect(() => validateRequest({
      requestType: "offboarding",
      employeeName: "Jordan Lee",
      department: "Finance",
    })).toThrow("An effective date is required for offboarding.");
  });

  it("rejects malformed dates and invalid email addresses", () => {
    expect(() => validateRequest({
      requestType: "m365_account",
      employeeName: "Jordan Lee",
      employeeEmail: "not-an-email",
      department: "Finance",
      startDate: "2026-02-30",
    })).toThrow("Start date must be a valid calendar date.");
  });

  it("requires an Entra identity when an onboarding request is for an existing employee", () => {
    expect(() => validateRequest({
      requestType: "employee_onboarding",
      employeeName: "Jordan Lee",
      department: "Finance",
      startDate: "2026-12-01",
      deviceType: "Laptop",
      isNewHire: false,
    })).toThrow("Select an existing Entra employee or mark this request as a new hire.");
  });

  it("accepts a new-hire onboarding request without an existing Entra identity", () => {
    expect(validateRequest({
      requestType: "employee_onboarding",
      employeeName: "Jordan Lee",
      department: "Finance",
      startDate: "2026-12-01",
      deviceType: "Laptop",
      isNewHire: true,
    })).toMatchObject({
      requestType: "employee_onboarding",
      employeeMicrosoftId: null,
      isNewHire: true,
      deviceType: "Laptop",
    });
  });

  it("sends new requests directly to IT when manager approval is disabled", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ setting_value: false }] })
      .mockResolvedValueOnce({ rows: [{ id: 4, status: "active" }] })
      .mockResolvedValueOnce({ rows: [{ member_role: "manager" }] });
    const client = {
      query: jest.fn(async (sql, values) => {
        if (sql.includes("INSERT INTO hr_service_requests")) {
          return { rows: [{ id: 19, status: values[12] }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    const request = await hrWorkspaceService.createRequest({
      requestType: "ad_account",
      employeeName: "Jordan Lee",
      department: "Finance",
      startDate: "2026-12-01",
    }, { id: 7, role: "manager", department: "HR" });

    expect(request.status).toBe("approved");
    const insert = client.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO hr_service_requests"));
    expect(insert[1][12]).toBe("approved");
    expect(insert[1][13]).toContain("approval toggle is disabled");
    expect(client.query.mock.calls.some(([sql, values]) =>
      sql.includes("INSERT INTO hr_service_request_events") && values[2] === "approval_bypassed"
    )).toBe(true);
  });

  it("auto-approves pending requests when an administrator disables the setting", async () => {
    const client = {
      query: jest.fn(async (sql) => sql.includes("UPDATE hr_service_requests")
        ? { rows: [{ id: 11 }, { id: 12 }], rowCount: 2 }
        : { rows: [], rowCount: 1 }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
    systemSettings.setSetting.mockResolvedValue({});

    const result = await hrWorkspaceService.setManagerApprovalEnabled(false, { id: 5, role: "admin" });

    expect(result).toEqual({ managerApprovalEnabled: false, autoApprovedCount: 2 });
    expect(systemSettings.setSetting).toHaveBeenCalledWith(
      "hr.manager_approval_enabled",
      false,
      expect.objectContaining({ updatedBy: 5, database: client })
    );
    expect(client.query.mock.calls.filter(([sql, values]) =>
      sql.includes("INSERT INTO hr_service_request_events") && values[2] === "approval_bypassed"
    )).toHaveLength(2);
  });

  it("limits the approval toggle to administrators", async () => {
    await expect(hrWorkspaceService.setManagerApprovalEnabled(false, { id: 6, role: "manager" }))
      .rejects.toMatchObject({ status: 403, code: "HR_APPROVAL_SETTING_DENIED" });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
