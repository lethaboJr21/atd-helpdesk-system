import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Edit3,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";

import { azureApi, userApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

const EMPTY_FILTERS = {
  search: "",
  role: "",
  department: "",
  status: "",
  approved: "",
  microsoftEnabled: "",
  employmentStatus: "",
  includeArchived: false,
};

const EMPTY_EDIT = {
  name: "",
  email: "",
  firstName: "",
  lastName: "",
  employeeNumber: "",
  jobTitle: "",
  department: "",
  managerName: "",
  officeLocation: "",
  site: "",
  mobilePhone: "",
  businessPhone: "",
  alternativeEmail: "",
  employmentStatus: "active",
  startDate: "",
  terminationDate: "",
  role: "user",
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inputDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function roleClass(role) {
  return {
    superadmin: "bg-fuchsia-100 text-fuchsia-800",
    admin: "bg-purple-100 text-purple-800",
    manager: "bg-indigo-100 text-indigo-800",
    agent: "bg-emerald-100 text-emerald-800",
    operator: "bg-cyan-100 text-cyan-800",
    user: "bg-slate-100 text-slate-700",
  }[role] || "bg-slate-100 text-slate-700";
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({
    summary: {},
    departments: [],
    roles: [],
    statuses: [],
    employmentStatuses: [],
  });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);

  const isSuperadmin = currentUser?.role === "superadmin";
  const canEdit = ["admin", "superadmin"].includes(currentUser?.role);

  const fetchMeta = async () => {
    const response = await userApi.getMeta();
    setMeta(response.data || {});
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        search: filters.search || undefined,
        role: filters.role || undefined,
        department: filters.department || undefined,
        status: filters.status || undefined,
        approved: filters.approved || undefined,
        microsoftEnabled: filters.microsoftEnabled || undefined,
        employmentStatus: filters.employmentStatus || undefined,
        includeArchived: filters.includeArchived,
      };

      const [usersResponse] = await Promise.all([
        userApi.getUsers(params),
        fetchMeta(),
      ]);

      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError(getErrorMessage(err, "Failed to load users."));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timeout);
  }, [filters]);

  const departments = useMemo(
    () => meta.departments || [],
    [meta.departments]
  );

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const runAction = async (key, callback, successMessage) => {
    setActionLoading(key);
    setError("");
    setSuccess("");

    try {
      await callback();
      setSuccess(successMessage);
      await fetchUsers();
    } catch (err) {
      console.error("User action failed:", err);
      setError(getErrorMessage(err, "The user action failed."));
    } finally {
      setActionLoading("");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    setSuccess("");
    setSyncSummary(null);

    try {
      const response = await azureApi.syncUsers({ includeDisabled: true });
      setSyncSummary(response.data?.summary || null);
      setSuccess(response.data?.message || "Microsoft users synchronized.");
      await fetchUsers();
    } catch (err) {
      console.error("Microsoft sync failed:", err);
      setError(getErrorMessage(err, "Microsoft user synchronization failed."));
    } finally {
      setSyncing(false);
    }
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      employeeNumber: user.employee_number || "",
      jobTitle: user.job_title || "",
      department: user.department || "",
      managerName: user.manager_name || "",
      officeLocation: user.office_location || "",
      site: user.site || "",
      mobilePhone: user.mobile_phone || "",
      businessPhone: user.business_phone || "",
      alternativeEmail: user.alternative_email || "",
      employmentStatus: user.employment_status || "active",
      startDate: inputDate(user.start_date),
      terminationDate: inputDate(user.termination_date),
      role: user.role || "user",
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setActionLoading(`edit-${editingUser.id}`);
    setError("");
    setSuccess("");

    try {
      await userApi.updateProfile(editingUser.id, editForm);

      if (editForm.role !== editingUser.role) {
        await userApi.updateUserRole(editingUser.id, editForm.role);
      }

      setEditingUser(null);
      setSuccess("User profile updated successfully.");
      await fetchUsers();
    } catch (err) {
      console.error("Profile update failed:", err);
      setError(getErrorMessage(err, "Failed to update user profile."));
    } finally {
      setActionLoading("");
    }
  };

  const confirmAction = (message) => window.confirm(message);

  const archiveUser = async (user) => {
    const reason = window.prompt(
      `Reason for archiving ${user.name || user.email}:`,
      "Account no longer required"
    );
    if (reason === null) return;

    await runAction(
      `archive-${user.id}`,
      () => userApi.archiveUser(user.id, reason),
      "User archived."
    );
  };

  const deleteUser = async (user) => {
    if (
      !confirmAction(
        `Permanently delete ${user.name || user.email}? This cannot be undone. Archive is safer for accounts with history.`
      )
    ) {
      return;
    }

    await runAction(
      `delete-${user.id}`,
      () => userApi.deleteUser(user.id),
      "User permanently deleted."
    );
  };

  const summaryCards = [
    ["Total Users", meta.summary?.total || 0, Users, "bg-blue-100 text-blue-700"],
    ["Active", meta.summary?.active || 0, CheckCircle2, "bg-emerald-100 text-emerald-700"],
    ["Pending", meta.summary?.pending || 0, UserCheck, "bg-amber-100 text-amber-700"],
    ["Agents", meta.summary?.agents || 0, ShieldCheck, "bg-indigo-100 text-indigo-700"],
    ["Microsoft Disabled", meta.summary?.microsoft_disabled || 0, UserX, "bg-red-100 text-red-700"],
    ["Archived", meta.summary?.archived || 0, Archive, "bg-slate-200 text-slate-700"],
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">Administration</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              User Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage employee profiles, portal access, Microsoft status and roles.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={classNames("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw className={classNames("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Syncing Microsoft 365..." : "Sync Microsoft 365"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        )}

        {syncSummary && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <span className="font-bold">Microsoft sync:</span>{" "}
            {syncSummary.retrieved} retrieved, {syncSummary.created} created,{" "}
            {syncSummary.updated} updated, {syncSummary.skipped} skipped and{" "}
            {syncSummary.failed} failed.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {summaryCards.map(([title, value, Icon, accent]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
                </div>
                <div className={classNames("rounded-xl p-3", accent)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Filter className="h-4 w-4" /> Filters
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilter("search", event.target.value)}
                placeholder="Search name, email, title, employee number..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <FilterSelect value={filters.role} onChange={(value) => setFilter("role", value)}>
              <option value="">All roles</option>
              {(meta.roles || []).map((role) => <option key={role} value={role}>{role}</option>)}
            </FilterSelect>

            <FilterSelect value={filters.department} onChange={(value) => setFilter("department", value)}>
              <option value="">All departments</option>
              {departments.map((department) => <option key={department}>{department}</option>)}
            </FilterSelect>

            <FilterSelect value={filters.status} onChange={(value) => setFilter("status", value)}>
              <option value="">All portal statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </FilterSelect>

            <FilterSelect value={filters.approved} onChange={(value) => setFilter("approved", value)}>
              <option value="">All approvals</option>
              <option value="true">Approved</option>
              <option value="false">Pending</option>
            </FilterSelect>

            <FilterSelect value={filters.microsoftEnabled} onChange={(value) => setFilter("microsoftEnabled", value)}>
              <option value="">All Microsoft statuses</option>
              <option value="true">Microsoft Active</option>
              <option value="false">Microsoft Disabled</option>
            </FilterSelect>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={filters.includeArchived}
                onChange={(event) => setFilter("includeArchived", event.target.checked)}
              />
              Include archived accounts
            </label>

            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-sm font-bold text-blue-700 hover:text-blue-800"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department / Title</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Portal</th>
                  <th className="p-4">Microsoft</th>
                  <th className="p-4">Approval</th>
                  <th className="p-4">Last Sync</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="8" className="p-10 text-center text-sm text-slate-500">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="8" className="p-10 text-center text-sm text-slate-500">No users match the current filters.</td></tr>
                ) : (
                  users.map((user) => {
                    const archived = Boolean(user.archived_at);
                    const busy = actionLoading.endsWith(`-${user.id}`);

                    return (
                      <tr key={user.id} className={classNames("align-top hover:bg-slate-50", archived && "bg-slate-50 opacity-80")}>
                        <td className="p-4">
                          <p className="font-bold text-slate-950">{user.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                          {user.employee_number && <p className="mt-1 text-xs text-slate-400">Employee #{user.employee_number}</p>}
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-800">{user.department || "No department"}</p>
                          <p className="mt-1 text-sm text-slate-500">{user.job_title || "No job title"}</p>
                        </td>
                        <td className="p-4">
                          <span className={classNames("rounded-full px-2.5 py-1 text-xs font-bold", roleClass(user.role))}>{user.role}</span>
                        </td>
                        <td className="p-4">
                          <StatusBadge active={user.status === "active" && !archived} activeText="Active" inactiveText={archived ? "Archived" : "Inactive"} />
                        </td>
                        <td className="p-4">
                          {user.microsoft_id ? (
                            <StatusBadge active={user.microsoft_account_enabled !== false} activeText="Active" inactiveText="Disabled" />
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">Not linked</span>
                          )}
                        </td>
                        <td className="p-4">
                          <StatusBadge active={Boolean(user.approved)} activeText="Approved" inactiveText="Pending" />
                        </td>
                        <td className="p-4 text-sm text-slate-500">{formatDate(user.last_microsoft_sync_at)}</td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <button type="button" onClick={() => openEdit(user)} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100" title="Edit user">
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}

                            {canEdit && !user.approved && !archived && (
                              <button type="button" disabled={busy} onClick={() => runAction(`approve-${user.id}`, () => userApi.approveUser(user.id, user.role || "user"), "User approved.")} className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-50" title="Approve user">
                                <UserCheck className="h-4 w-4" />
                              </button>
                            )}

                            {canEdit && !archived && user.status === "active" && Number(currentUser?.id) !== Number(user.id) && (
                              <button type="button" disabled={busy} onClick={() => confirmAction(`Deactivate ${user.name}?`) && runAction(`deactivate-${user.id}`, () => userApi.deactivateUser(user.id), "User deactivated.")} className="rounded-lg border border-amber-200 p-2 text-amber-700 hover:bg-amber-50" title="Deactivate">
                                <UserX className="h-4 w-4" />
                              </button>
                            )}

                            {canEdit && !archived && user.status !== "active" && (
                              <button type="button" disabled={busy} onClick={() => runAction(`reactivate-${user.id}`, () => userApi.reactivateUser(user.id), "User reactivated.")} className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50" title="Reactivate">
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}

                            {canEdit && !archived && Number(currentUser?.id) !== Number(user.id) && (
                              <button type="button" disabled={busy} onClick={() => archiveUser(user)} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100" title="Archive">
                                <Archive className="h-4 w-4" />
                              </button>
                            )}

                            {canEdit && archived && (
                              <button type="button" disabled={busy} onClick={() => runAction(`restore-${user.id}`, () => userApi.restoreUser(user.id), "User restored as inactive pending approval.")} className="rounded-lg border border-blue-200 p-2 text-blue-700 hover:bg-blue-50" title="Restore archived account">
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}

                            {isSuperadmin && Number(currentUser?.id) !== Number(user.id) && (
                              <button type="button" disabled={busy} onClick={() => deleteUser(user)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50" title="Delete permanently">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Edit Employee Profile</h2>
                <p className="text-sm text-slate-500">{editingUser.email}</p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <EditField label="Full Name" value={editForm.name} onChange={(value) => setEditForm((form) => ({ ...form, name: value }))} />
              <EditField label="Company Email" type="email" value={editForm.email} onChange={(value) => setEditForm((form) => ({ ...form, email: value }))} />
              <EditField label="First Name" value={editForm.firstName} onChange={(value) => setEditForm((form) => ({ ...form, firstName: value }))} />
              <EditField label="Last Name" value={editForm.lastName} onChange={(value) => setEditForm((form) => ({ ...form, lastName: value }))} />
              <EditField label="Employee Number" value={editForm.employeeNumber} onChange={(value) => setEditForm((form) => ({ ...form, employeeNumber: value }))} />
              <EditField label="Job Title" value={editForm.jobTitle} onChange={(value) => setEditForm((form) => ({ ...form, jobTitle: value }))} />
              <EditField label="Department" value={editForm.department} onChange={(value) => setEditForm((form) => ({ ...form, department: value }))} />
              <EditField label="Manager" value={editForm.managerName} onChange={(value) => setEditForm((form) => ({ ...form, managerName: value }))} />
              <EditField label="Office Location" value={editForm.officeLocation} onChange={(value) => setEditForm((form) => ({ ...form, officeLocation: value }))} />
              <EditField label="Site" value={editForm.site} onChange={(value) => setEditForm((form) => ({ ...form, site: value }))} />
              <EditField label="Mobile Phone" value={editForm.mobilePhone} onChange={(value) => setEditForm((form) => ({ ...form, mobilePhone: value }))} />
              <EditField label="Business Phone" value={editForm.businessPhone} onChange={(value) => setEditForm((form) => ({ ...form, businessPhone: value }))} />
              <EditField label="Alternative Email" type="email" value={editForm.alternativeEmail} onChange={(value) => setEditForm((form) => ({ ...form, alternativeEmail: value }))} />

              <label>
                <span className="mb-1 block text-sm font-bold text-slate-700">Employment Status</span>
                <select value={editForm.employmentStatus} onChange={(event) => setEditForm((form) => ({ ...form, employmentStatus: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                  {(meta.employmentStatuses || []).map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>

              <EditField label="Start Date" type="date" value={editForm.startDate} onChange={(value) => setEditForm((form) => ({ ...form, startDate: value }))} />
              <EditField label="Termination Date" type="date" value={editForm.terminationDate} onChange={(value) => setEditForm((form) => ({ ...form, terminationDate: value }))} />

              <label>
                <span className="mb-1 block text-sm font-bold text-slate-700">Portal Role</span>
                <select value={editForm.role} onChange={(event) => setEditForm((form) => ({ ...form, role: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                  {(meta.roles || []).filter((role) => isSuperadmin || !["admin", "superadmin"].includes(role)).map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5">
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={actionLoading === `edit-${editingUser.id}`} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {actionLoading === `edit-${editingUser.id}` ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, children }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
      {children}
    </select>
  );
}

function StatusBadge({ active, activeText, inactiveText }) {
  return (
    <span className={classNames("rounded-full px-2.5 py-1 text-xs font-bold", active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700")}>
      {active ? activeText : inactiveText}
    </span>
  );
}

function EditField({ label, value, onChange, type = "text" }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
    </label>
  );
}
