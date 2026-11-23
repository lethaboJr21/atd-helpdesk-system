import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, ShieldCheck, XCircle } from "lucide-react";
import OperationsShell from "../components/OperationsShell";
import DeviceIssuanceSignoff from "../components/hr/DeviceIssuanceSignoff";
import CompanyAnnouncements from "../components/dashboard/CompanyAnnouncements";
import { assetsApi, groupsApi, hrWorkspaceApi, ticketsApi } from "../services/api";

const REQUEST_TYPES = [
  { value: "ad_account", label: "Active Directory account", category: "Employee Onboarding/Offboarding", subCategory: "Onboarding", item: "New AD / Email Account" },
  { value: "m365_account", label: "Microsoft 365 account", category: "Employee Onboarding/Offboarding", subCategory: "Onboarding", item: "New AD / Email Account" },
  { value: "device_assignment", label: "Device assignment", category: "Hardware Provisioning", subCategory: "Device assignment", item: "Device Assignment" },
  { value: "employee_onboarding", label: "New employee onboarding (AD + M365/SSO + device)", category: "Employee Onboarding/Offboarding", subCategory: "Onboarding", item: "New Employee Onboarding" },
  { value: "offboarding", label: "Employee offboarding", category: "Employee Management", subCategory: "Offboarding", item: "Account Offboarding" },
  { value: "other", label: "Other HR service", category: "Employee Management", subCategory: "Other HR service", item: "Other HR Service" },
];

const EMPTY_FORM = {
  requestType: "ad_account",
  employeeMicrosoftId: "",
  isNewHire: true,
  employeeName: "",
  employeeEmail: "",
  department: "",
  jobTitle: "",
  startDate: "",
  effectiveDate: "",
  deviceType: "",
  details: "",
};

const STATUS_LABELS = {
  pending_approval: "Pending HR approval",
  approved: "Approved for IT",
  rejected: "Rejected",
  handed_off: "IT ticket created",
};

function errorText(error) {
  return error?.response?.data?.error || error?.message || "The HR workspace request failed.";
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function HrWorkspacePage() {
  const [requests, setRequests] = useState([]);
  const [access, setAccess] = useState(null);
  const [groups, setGroups] = useState([]);
  const [directoryEmployees, setDirectoryEmployees] = useState([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [amsAssets, setAmsAssets] = useState([]);
  const [amsAssetError, setAmsAssetError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [approvalNotes, setApprovalNotes] = useState({});
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [onboardingDrafts, setOnboardingDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingApprovalSetting, setSavingApprovalSetting] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [creatingTicketId, setCreatingTicketId] = useState(null);
  const [updatingOnboardingId, setUpdatingOnboardingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [groupError, setGroupError] = useState("");
  const [unlinkedTicket, setUnlinkedTicket] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await hrWorkspaceApi.getRequests();
      setRequests(response.data.requests || []);
      setAccess(response.data.access || null);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!access?.canFulfill) return;
    let active = true;
    groupsApi.getAll()
      .then((response) => {
        if (active) setGroups(Array.isArray(response.data) ? response.data : []);
      })
      .catch((requestError) => {
        if (active) setGroupError(errorText(requestError));
      });
    return () => { active = false; };
  }, [access?.canFulfill]);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.is_active !== false),
    [groups],
  );

  const loadDirectoryEmployees = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError("");
    try {
      const response = await hrWorkspaceApi.getEmployees();
      setDirectoryEmployees(response.data.employees || []);
    } catch (directoryLoadError) {
      setDirectoryEmployees([]);
      setDirectoryError(errorText(directoryLoadError));
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  const loadAmsAssets = useCallback(async () => {
    setAmsAssetError("");
    try {
      const response = await assetsApi.getAll();
      setAmsAssets(Array.isArray(response.data) ? response.data : []);
    } catch (assetError) {
      setAmsAssets([]);
      setAmsAssetError(errorText(assetError));
    }
  }, []);

  useEffect(() => {
    if (access?.canCreate) loadDirectoryEmployees();
  }, [access?.canCreate, loadDirectoryEmployees]);

  useEffect(() => {
    if (!access?.canFulfill || !requests.some((request) =>
      request.request_type === "employee_onboarding" && request.status === "handed_off"
    )) return;
    loadAmsAssets();
  }, [access?.canFulfill, requests, loadAmsAssets]);

  const filteredDirectoryEmployees = useMemo(() => {
    const term = directorySearch.trim().toLowerCase();
    if (!term) return directoryEmployees;
    return directoryEmployees.filter((employee) =>
      [employee.name, employee.email, employee.department, employee.jobTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [directoryEmployees, directorySearch]);

  const availableAssets = useMemo(() => amsAssets.filter((asset) => {
    const assignedTo = String(asset.assigned_to || asset.assignedTo || "").trim();
    const status = String(asset.status || "").trim().toLowerCase();
    return !assignedTo && (!status || ["available", "unassigned", "in stock", "ready"].some((value) => status.includes(value)));
  }), [amsAssets]);

  const selectEmployeeSource = (isNewHire) => {
    setForm((current) => ({
      ...current,
      isNewHire,
      employeeMicrosoftId: "",
      employeeName: "",
      employeeEmail: "",
      department: "",
      jobTitle: "",
    }));
  };

  const selectDirectoryEmployee = (microsoftId) => {
    const employee = directoryEmployees.find((item) => item.microsoftId === microsoftId);
    if (!employee) {
      selectEmployeeSource(false);
      return;
    }
    setForm((current) => ({
      ...current,
      isNewHire: false,
      employeeMicrosoftId: employee.microsoftId,
      employeeName: employee.name || "",
      employeeEmail: employee.email || "",
      department: employee.department || "",
      jobTitle: employee.jobTitle || "",
    }));
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await hrWorkspaceApi.createRequest(form);
      setForm(EMPTY_FORM);
      setNotice(access?.managerApprovalEnabled
        ? "Request submitted. An HR Manager must approve it before IT receives a fulfillment ticket."
        : "Request submitted and made available to IT without HR Manager approval.");
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggleManagerApproval = async () => {
    const enabled = access?.managerApprovalEnabled !== true;
    setSavingApprovalSetting(true);
    setError("");
    setNotice("");
    try {
      const response = await hrWorkspaceApi.setManagerApprovalEnabled(enabled);
      setNotice(enabled
        ? "HR Manager approval is enabled for new requests."
        : `HR Manager approval is disabled. ${response.data.autoApprovedCount} pending request(s) were advanced to IT.`);
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSavingApprovalSetting(false);
    }
  };

  const review = async (request, decision) => {
    const note = approvalNotes[request.id] || "";
    setReviewingId(request.id);
    setError("");
    setNotice("");
    try {
      await hrWorkspaceApi.reviewRequest(request.id, { decision, note });
      setNotice(decision === "approve" ? "Request approved and made available to IT." : "Request rejected.");
      setApprovalNotes((current) => ({ ...current, [request.id]: "" }));
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setReviewingId(null);
    }
  };

  const createItTicket = async (request) => {
    const draft = assignmentDrafts[request.id] || { groupId: "", agentId: "" };
    if (!draft.groupId || !draft.agentId) {
      setError("Select an IT support group and agent before creating the fulfillment ticket.");
      return;
    }
    const requestType = REQUEST_TYPES.find((item) => item.value === request.request_type) || REQUEST_TYPES[REQUEST_TYPES.length - 1];
    const groupId = Number(draft.groupId);
    const agentId = Number(draft.agentId);
    const description = [
      `Approved HR service request #${request.id}`,
      `Employee: ${request.employee_name}`,
      `Email: ${request.employee_email || "Not provided"}`,
      `Department: ${request.department}`,
      `Job title: ${request.job_title || "Not provided"}`,
      `Start date: ${dateLabel(request.start_date)}`,
      `Effective date: ${dateLabel(request.effective_date)}`,
      `Device type: ${request.device_type || "Not applicable"}`,
      `HR approval note: ${request.approval_note || "Approved"}`,
      `Additional instructions: ${request.details || "None provided"}`,
      ...(request.request_type === "employee_onboarding" ? [
        "",
        "Fulfillment sequence: create the AD account; use AMS to initiate the M365/SSO request; confirm M365/SSO readiness; allocate the device in AMS; capture the employee's signed issuance acknowledgement.",
        "Until the AD and AMS write APIs are connected, perform each external action in its approved system and record the completion stage in the HR Workspace.",
      ] : []),
      "",
      "Manual fulfillment only: complete this request in the approved IT systems and record the completion evidence on this ticket.",
    ].join("\n");

    setCreatingTicketId(request.id);
    setError("");
    setNotice("");
    try {
      const response = await ticketsApi.create({
        ticketType: "service_request",
        requesterId: request.requester_user_id,
        title: `HR ${requestType.label}: ${request.employee_name}`,
        description,
        priority: "Medium",
        workspace: "IT",
        assignedGroupId: groupId,
        assignedToUserId: agentId,
        category: requestType.category,
        subCategory: requestType.subCategory,
        itemCategory: requestType.item,
        source: "HR Workspace",
        requestDetails: {
          catalogueItemId: `hr-service-${request.request_type}`,
          catalogueItemName: requestType.item,
          hrServiceRequestId: String(request.id),
          employeeMicrosoftId: request.employee_microsoft_id || null,
          isNewHire: request.is_new_hire === true,
          onboardingStages: request.request_type === "employee_onboarding"
            ? ["ad_account", "m365_request", "m365_sso", "ams_asset", "issuance_signature"]
            : [],
        },
      });
      const ticket = response.data;
      try {
        await hrWorkspaceApi.linkItTicket(request.id, ticket.id);
      } catch (linkError) {
        setUnlinkedTicket({ requestId: request.id, ticketId: ticket.id, ticketRef: ticket.ticket_ref });
        setError(`IT ticket ${ticket.ticket_ref} was created, but could not be linked to the HR request: ${errorText(linkError)}`);
        return;
      }
      setAssignmentDrafts((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setNotice(`IT ticket ${ticket.ticket_ref} created and linked to HR request #${request.id}.`);
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setCreatingTicketId(null);
    }
  };

  const updateOnboardingDraft = (requestId, patch) => {
    setOnboardingDrafts((current) => ({
      ...current,
      [requestId]: { ...(current[requestId] || {}), ...patch },
    }));
  };

  const selectOnboardingAsset = (requestId, assetId) => {
    const asset = availableAssets.find((item) =>
      String(item.id ?? item.asset_id ?? item.assetId) === String(assetId)
    );
    if (!asset) {
      updateOnboardingDraft(requestId, { assetId: "", assetName: "", assetTag: "", serialNumber: "" });
      return;
    }
    updateOnboardingDraft(requestId, {
      assetId: String(asset.id ?? asset.asset_id ?? asset.assetId),
      assetName: String(asset.name || asset.model || asset.asset_name || "Company device"),
      assetTag: String(asset.asset_tag || asset.assetTag || asset.tag || ""),
      serialNumber: String(asset.serial_number || asset.serialNumber || ""),
    });
  };

  const recordOnboardingStep = async (request, step) => {
    const draft = onboardingDrafts[request.id] || {};
    const payload = { step };
    if (step === "ad_account") {
      payload.adUsername = draft.adUsername || "";
      payload.adEmail = draft.adEmail || "";
    } else if (step === "m365_sso") {
      payload.m365Email = draft.m365Email || "";
    } else if (step === "ams_asset") {
      Object.assign(payload, {
        assetId: draft.assetId || "",
        assetName: draft.assetName || "",
        assetTag: draft.assetTag || "",
        serialNumber: draft.serialNumber || "",
      });
    }

    setUpdatingOnboardingId(request.id);
    setError("");
    setNotice("");
    try {
      await hrWorkspaceApi.updateOnboardingStep(request.id, payload);
      setNotice("Onboarding stage recorded. Complete the next step in its designated system.");
      await load();
    } catch (stepError) {
      setError(errorText(stepError));
    } finally {
      setUpdatingOnboardingId(null);
    }
  };

  const retryLink = async () => {
    if (!unlinkedTicket) return;
    setSaving(true);
    setError("");
    try {
      await hrWorkspaceApi.linkItTicket(unlinkedTicket.requestId, unlinkedTicket.ticketId);
      setNotice(`IT ticket ${unlinkedTicket.ticketRef} is now linked to the HR request.`);
      setUnlinkedTicket(null);
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OperationsShell>
      <main className="h-full overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950 xl:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-blue-200">Department Workspace</p>
            <h1 className="mt-2 text-3xl font-black">Human Resources</h1>
            <p className="mt-2 max-w-3xl text-sm text-blue-50">
              HR prepares employee lifecycle and device requests. {access?.managerApprovalEnabled
                ? "An HR Manager reviews each request before IT fulfillment."
                : "Requests move directly to IT fulfillment while HR Manager approval is disabled."}
            </p>
            {access?.canManageApprovalSetting && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                <div>
                  <p className="text-sm font-bold">HR Manager approval</p>
                  <p className="mt-1 text-xs text-blue-100">
                    {access.managerApprovalEnabled
                      ? "Enabled for new requests. Turning it off advances pending requests to IT."
                      : "Disabled. New requests are approved for IT automatically."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="HR Manager approval"
                  aria-checked={Boolean(access.managerApprovalEnabled)}
                  disabled={savingApprovalSetting}
                  onClick={toggleManagerApproval}
                  className={`relative h-8 w-14 rounded-full transition disabled:cursor-wait disabled:opacity-60 ${access.managerApprovalEnabled ? "bg-emerald-400" : "bg-slate-500"}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${access.managerApprovalEnabled ? "left-7" : "left-1"}`} />
                </button>
              </div>
            )}
          </header>

          <CompanyAnnouncements />

          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p><strong>Staged fulfillment.</strong> The Helpdesk records each confirmation, but AD, AMS, and M365 changes must still be completed in their approved systems until write integrations are configured.</p>
          </div>

          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
          {groupError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">IT assignment options could not be loaded: {groupError}</div>}
          {unlinkedTicket && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <span>Ticket {unlinkedTicket.ticketRef} exists but its HR handoff link needs a retry.</span>
              <button onClick={retryLink} disabled={saving} className="rounded-lg bg-amber-800 px-3 py-2 font-semibold text-white disabled:opacity-50">
                Retry link
              </button>
            </div>
          )}

          {access?.canCreate && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-700" />
                <div>
                  <h2 className="font-bold text-slate-900">Submit an HR service request</h2>
                  <p className="text-xs text-slate-500">Select an Entra employee or enter new-hire details. Never enter passwords or authentication secrets.</p>
                </div>
              </div>
              <form onSubmit={submitRequest} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">
                  Request type
                  <select className="input mt-1" value={form.requestType} onChange={(event) => setForm((current) => ({ ...current, requestType: event.target.value }))}>
                    {REQUEST_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Employee source
                  <select className="input mt-1" value={form.isNewHire ? "new_hire" : "entra"} onChange={(event) => selectEmployeeSource(event.target.value === "new_hire")}>
                    <option value="entra">Existing employee in Entra ID</option>
                    <option value="new_hire">New hire (not yet in Entra ID)</option>
                  </select>
                </label>
                {!form.isNewHire && (
                  <>
                    <label className="text-sm font-semibold text-slate-700">
                      Search Entra employees
                      <input className="input mt-1" value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder="Name, email, department, or job title" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Select employee
                      <select className="input mt-1" value={form.employeeMicrosoftId} onChange={(event) => selectDirectoryEmployee(event.target.value)} required>
                        <option value="">{directoryLoading ? "Loading Entra employees…" : "Choose an employee"}</option>
                        {filteredDirectoryEmployees.map((employee) => (
                          <option key={employee.microsoftId} value={employee.microsoftId}>
                            {[employee.name, employee.department, employee.email].filter(Boolean).join(" · ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <button type="button" onClick={loadDirectoryEmployees} disabled={directoryLoading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                        {directoryLoading ? "Refreshing…" : "Refresh Entra list"}
                      </button>
                    </div>
                  </>
                )}
                {directoryError && !form.isNewHire && (
                  <p role="alert" className="md:col-span-2 xl:col-span-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    Entra employees could not be loaded: {directoryError}. You can still submit a new-hire request.
                  </p>
                )}
                <label className="text-sm font-semibold text-slate-700">
                  Employee name
                  <input className="input mt-1" required maxLength={160} readOnly={!form.isNewHire} value={form.employeeName} onChange={(event) => setForm((current) => ({ ...current, employeeName: event.target.value }))} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Work email (if assigned)
                  <input className="input mt-1" type="email" maxLength={254} readOnly={!form.isNewHire} value={form.employeeEmail} onChange={(event) => setForm((current) => ({ ...current, employeeEmail: event.target.value }))} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Department
                  <input className="input mt-1" required maxLength={120} readOnly={!form.isNewHire && Boolean(form.department)} list="hr-entra-departments" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} />
                  <datalist id="hr-entra-departments">{[...new Set(directoryEmployees.map((employee) => employee.department).filter(Boolean))].map((department) => <option key={department} value={department} />)}</datalist>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Job title
                  <input className="input mt-1" maxLength={120} readOnly={!form.isNewHire && Boolean(form.jobTitle)} value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} />
                </label>
                {["ad_account", "m365_account", "employee_onboarding"].includes(form.requestType) && (
                  <label className="text-sm font-semibold text-slate-700">
                    Start date
                    <input className="input mt-1" type="date" required value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
                  </label>
                )}
                {form.requestType === "offboarding" && (
                  <label className="text-sm font-semibold text-slate-700">
                    Offboarding effective date
                    <input className="input mt-1" type="date" required value={form.effectiveDate} onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))} />
                  </label>
                )}
                {["device_assignment", "employee_onboarding"].includes(form.requestType) && (
                  <label className="text-sm font-semibold text-slate-700">
                    Device type
                    <input className="input mt-1" required maxLength={120} value={form.deviceType} onChange={(event) => setForm((current) => ({ ...current, deviceType: event.target.value }))} placeholder="Laptop, phone, workstation..." />
                  </label>
                )}
                <label className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
                  Business justification and access/device requirements
                  <textarea className="input mt-1" rows={3} maxLength={5000} value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} />
                </label>
                <div className="md:col-span-2 xl:col-span-3">
                  {form.requestType === "employee_onboarding" && (
                    <p className="mb-3 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                      One HR request creates one assigned IT ticket. IT records AD creation, the AMS M365/SSO request, M365 readiness, AMS device allocation, and the employee's signed issuance form in order.
                    </p>
                  )}
                  <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    {saving ? "Submitting…" : access?.managerApprovalEnabled ? "Submit for HR approval" : "Submit HR request"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">HR request workflow</h2>
                <p className="text-xs text-slate-500">
                  {access?.canApprove ? "HR Managers approve or reject requests; requesters cannot review their own submissions." : access?.canFulfill ? "IT sees requests approved for fulfillment and creates assigned tickets." : "Workspace members can review HR request status."}
                </p>
              </div>
              <button onClick={load} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading HR requests…</div>
            ) : requests.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No HR requests are available to this account.</p>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const requestType = REQUEST_TYPES.find((item) => item.value === request.request_type) || REQUEST_TYPES[REQUEST_TYPES.length - 1];
                  const draft = assignmentDrafts[request.id] || { groupId: "", agentId: "" };
                  const selectedGroup = activeGroups.find((group) => String(group.id) === draft.groupId);
                  const members = selectedGroup?.members || [];
                  const note = approvalNotes[request.id] || "";
                  const onboardingDraft = onboardingDrafts[request.id] || {};
                  return (
                    <article key={request.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">HR-{request.id} · {requestType.label}</h3>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{STATUS_LABELS[request.status] || request.status}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">{request.employee_name} · {request.department}{request.job_title ? ` · ${request.job_title}` : ""}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Submitted by {request.requester_name} on {dateLabel(request.created_at)}
                            {request.start_date ? ` · Start ${dateLabel(request.start_date)}` : ""}
                            {request.effective_date ? ` · Effective ${dateLabel(request.effective_date)}` : ""}
                            {request.employee_email ? ` · ${request.employee_email}` : ""}
                          </p>
                          {request.device_type && <p className="mt-2 text-sm text-slate-700">Device: {request.device_type}</p>}
                          {request.details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{request.details}</p>}
                          {request.approval_note && <p className="mt-2 text-sm text-slate-600">Review note: {request.approval_note}</p>}
                          {request.it_ticket_ref && (
                            <p className="mt-2 text-sm font-semibold text-emerald-700">
                              IT ticket: <a className="underline" href={`/tickets/${request.it_ticket_id}`}>{request.it_ticket_ref}</a> · {request.it_ticket_status}
                            </p>
                          )}
                        </div>
                        {request.status === "approved" && !request.it_ticket_id && access?.canFulfill && (
                          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"><AlertTriangle className="h-3.5 w-3.5" />Ready for IT</span>
                        )}
                      </div>

                      {request.status === "pending_approval" && access?.canApprove && (
                        <div className="mt-4 border-t pt-4">
                          <label className="block text-xs font-semibold text-slate-600">
                            Approval note / rejection reason
                            <textarea
                              className="input mt-1"
                              rows={2}
                              maxLength={2000}
                              value={note}
                              onChange={(event) => setApprovalNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                            />
                          </label>
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => review(request, "approve")} disabled={reviewingId === request.id || Number(request.requester_user_id) === Number(access.currentUserId)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                              <CheckCircle2 className="h-4 w-4" />Approve for IT
                            </button>
                            <button onClick={() => review(request, "reject")} disabled={reviewingId === request.id || !note.trim() || Number(request.requester_user_id) === Number(access.currentUserId)} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">
                              <XCircle className="h-4 w-4" />Reject
                            </button>
                          </div>
                        </div>
                      )}

                      {request.status === "approved" && !request.it_ticket_id && access?.canFulfill && (
                        <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[1fr_1fr_auto]">
                          <select
                            aria-label={`IT support group for HR request ${request.id}`}
                            value={draft.groupId}
                            onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [request.id]: { groupId: event.target.value, agentId: "" } }))}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="">Select IT support group</option>
                            {activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                          </select>
                          <select
                            aria-label={`IT agent for HR request ${request.id}`}
                            value={draft.agentId}
                            disabled={!draft.groupId}
                            onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [request.id]: { ...draft, agentId: event.target.value } }))}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                          >
                            <option value="">Select assigned agent</option>
                            {members.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                          </select>
                          <button
                            onClick={() => createItTicket(request)}
                            disabled={!draft.groupId || !draft.agentId || creatingTicketId === request.id}
                            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {creatingTicketId === request.id ? "Creating…" : "Create IT ticket"}
                          </button>
                        </div>
                      )}

                      {request.request_type === "employee_onboarding" && request.status === "handed_off" && access?.canFulfill && (
                        <section className="mt-4 space-y-4 border-t pt-4">
                          <div>
                            <h4 className="font-bold text-slate-900">IT onboarding stages</h4>
                            <p className="mt-1 text-xs text-slate-500">Complete each action in the approved system, then record it here. Helpdesk does not write to AD or AMS.</p>
                          </div>
                          <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                            {[
                              ["AD account", request.ad_account_completed_at],
                              ["AMS M365/SSO request", request.m365_request_sent_at],
                              ["M365/SSO ready", request.m365_sso_completed_at],
                              ["AMS device allocated", request.asset_allocated_at],
                              ["Employee signed", request.issuance_signed_at],
                            ].map(([label, completedAt]) => (
                              <li key={label} className={`rounded-lg border p-3 text-xs ${completedAt ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                                <span className="font-bold">{completedAt ? "Complete" : "Pending"} · {label}</span>
                                {completedAt ? <span className="mt-1 block">{dateLabel(completedAt)}</span> : null}
                              </li>
                            ))}
                          </ol>

                          {!request.ad_account_completed_at ? (
                            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Created AD username" value={onboardingDraft.adUsername || ""} onChange={(event) => updateOnboardingDraft(request.id, { adUsername: event.target.value })} />
                              <input className="rounded-lg border px-3 py-2 text-sm" type="email" placeholder="Created AD email" value={onboardingDraft.adEmail || ""} onChange={(event) => updateOnboardingDraft(request.id, { adEmail: event.target.value })} />
                              <button type="button" onClick={() => recordOnboardingStep(request, "ad_account")} disabled={updatingOnboardingId === request.id || !onboardingDraft.adUsername || !onboardingDraft.adEmail} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                                Record AD created
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700">AD account: {request.ad_username} · {request.ad_email}</p>
                          )}

                          {request.ad_account_completed_at && !request.m365_request_sent_at ? (
                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                              <p className="text-xs text-blue-900">Use the AMS process to notify the M365/SSO team, then record that the request was sent.</p>
                              <button type="button" onClick={() => recordOnboardingStep(request, "m365_request")} disabled={updatingOnboardingId === request.id} className="mt-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                                {updatingOnboardingId === request.id ? "Recording…" : "Record AMS M365/SSO request sent"}
                              </button>
                            </div>
                          ) : null}

                          {request.m365_request_sent_at && !request.m365_sso_completed_at ? (
                            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                              <input className="rounded-lg border px-3 py-2 text-sm" type="email" placeholder="Created M365/SSO account email" value={onboardingDraft.m365Email || ""} onChange={(event) => updateOnboardingDraft(request.id, { m365Email: event.target.value })} />
                              <button type="button" onClick={() => recordOnboardingStep(request, "m365_sso")} disabled={updatingOnboardingId === request.id || !onboardingDraft.m365Email} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                                Record M365/SSO ready
                              </button>
                            </div>
                          ) : null}
                          {request.m365_sso_completed_at ? <p className="text-sm text-slate-700">M365/SSO account: {request.m365_email}</p> : null}

                          {request.m365_sso_completed_at && !request.asset_allocated_at ? (
                            <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-blue-900">Allocate the device in AMS first, then select and record that asset here.</p>
                                <button type="button" onClick={loadAmsAssets} className="text-xs font-bold text-blue-800 underline">Refresh AMS assets</button>
                              </div>
                              {amsAssetError ? <p role="alert" className="text-xs text-amber-800">AMS assets could not be loaded: {amsAssetError}. You may enter the asset details manually after allocation.</p> : null}
                              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={onboardingDraft.assetId || ""} onChange={(event) => selectOnboardingAsset(request.id, event.target.value)}>
                                <option value="">Select an unassigned AMS asset</option>
                                {availableAssets.map((asset) => {
                                  const assetId = String(asset.id ?? asset.asset_id ?? asset.assetId);
                                  const tag = asset.asset_tag || asset.assetTag || asset.tag || assetId;
                                  return <option key={assetId} value={assetId}>{tag} · {asset.name || asset.model || asset.asset_name || "Device"} · {asset.status || "Status unknown"}</option>;
                                })}
                              </select>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="AMS asset ID" value={onboardingDraft.assetId || ""} onChange={(event) => updateOnboardingDraft(request.id, { assetId: event.target.value })} />
                                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Device name / model" value={onboardingDraft.assetName || ""} onChange={(event) => updateOnboardingDraft(request.id, { assetName: event.target.value })} />
                                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Asset tag" value={onboardingDraft.assetTag || ""} onChange={(event) => updateOnboardingDraft(request.id, { assetTag: event.target.value })} />
                                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Serial number (optional)" value={onboardingDraft.serialNumber || ""} onChange={(event) => updateOnboardingDraft(request.id, { serialNumber: event.target.value })} />
                              </div>
                              <button type="button" onClick={() => recordOnboardingStep(request, "ams_asset")} disabled={updatingOnboardingId === request.id || !onboardingDraft.assetId || !onboardingDraft.assetName || !onboardingDraft.assetTag} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                                {updatingOnboardingId === request.id ? "Recording…" : "Confirm AMS device allocation"}
                              </button>
                            </div>
                          ) : null}
                          {request.asset_allocated_at ? (
                            <div>
                              <p className="text-sm text-slate-700">Allocated device: {request.ams_asset_tag} · {request.ams_asset_name} · Serial {request.ams_serial_number || "not recorded"}</p>
                              <DeviceIssuanceSignoff request={request} onSaved={load} />
                            </div>
                          ) : null}
                        </section>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </OperationsShell>
  );
}
