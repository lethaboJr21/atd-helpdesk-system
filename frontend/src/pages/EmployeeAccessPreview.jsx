import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Building2,
  HardDrive,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";

import AdminUniversalHeader from "../components/admin/AdminUniversalHeader";
import { ROLE_EXPERIENCE_CONTRACTS, roleExperienceContract } from "../config/roleExperienceContracts";
import { userApi, workspacesApi } from "../services/api";

const ROLE_LABELS = {
  user: "Employee",
  hod: "Department Head",
  agent: "Support Agent",
  operator: "Operations",
  manager: "Manager",
  admin: "Administrator",
  superadmin: "Superadministrator",
};

const WORKSPACE_ROLE_LABELS = {
  manager: "Workspace Manager",
  agent: "Workspace Agent",
  viewer: "Workspace Viewer",
};

const ROLE_LAYOUTS = {
  user: [
    { label: "My requests", icon: Ticket },
    { label: "My assets", icon: HardDrive },
    { label: "Solutions", icon: LifeBuoy },
    { label: "Announcements", icon: Bell },
  ],
  hod: [
    { label: "Department requests", icon: Ticket },
    { label: "Approvals", icon: ShieldCheck },
    { label: "Team overview", icon: Users },
    { label: "Announcements", icon: Bell },
  ],
  agent: [
    { label: "Assigned queue", icon: Ticket },
    { label: "SLA watch", icon: Activity },
    { label: "Knowledge", icon: LifeBuoy },
    { label: "Team activity", icon: Users },
  ],
  operator: [
    { label: "Operations queue", icon: Ticket },
    { label: "Production workflows", icon: BriefcaseBusiness },
    { label: "Operational alerts", icon: Activity },
    { label: "Knowledge", icon: LifeBuoy },
  ],
  manager: [
    { label: "Department overview", icon: LayoutDashboard },
    { label: "Approvals & escalations", icon: ShieldCheck },
    { label: "Team workload", icon: Users },
    { label: "Service performance", icon: Activity },
  ],
  admin: [
    { label: "User directory", icon: Users },
    { label: "Groups & workspaces", icon: BriefcaseBusiness },
    { label: "Communications", icon: Bell },
    { label: "System health", icon: Activity },
  ],
  superadmin: [
    { label: "Platform governance", icon: ShieldCheck },
    { label: "Audit trail", icon: Activity },
    { label: "Access controls", icon: Settings },
    { label: "System health", icon: LayoutDashboard },
  ],
};

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.message || "The preview data could not be loaded.";
}

function extractUsers(response) {
  const payload = response?.data;
  return Array.isArray(payload) ? payload : payload?.users || [];
}

export default function EmployeeAccessPreview() {
  const [bootstrap, setBootstrap] = useState({
    loading: true,
    error: "",
    departments: [],
    roles: [],
    workspaces: [],
  });
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      userApi.getMeta(),
      workspacesApi.getAll({ limit: 200 }),
    ])
      .then(([metaResponse, workspaceResponse]) => {
        if (!active) return;
        setBootstrap({
          loading: false,
          error: "",
          departments: metaResponse.data?.departments || [],
          roles: metaResponse.data?.roles || Object.keys(ROLE_EXPERIENCE_CONTRACTS),
          workspaces: workspaceResponse.data?.items || [],
        });
      })
      .catch((error) => {
        if (!active) return;
        setBootstrap((current) => ({ ...current, loading: false, error: getErrorMessage(error) }));
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setWorkspaceMembers([]);
      setWorkspaceError("");
      setWorkspaceLoading(false);
      return undefined;
    }

    let active = true;
    setWorkspaceLoading(true);
    setWorkspaceError("");
    setSelectedEmployee(null);

    workspacesApi.getDashboard(workspaceId)
      .then((response) => {
        if (active) setWorkspaceMembers(response.data?.members || []);
      })
      .catch((error) => {
        if (active) {
          setWorkspaceMembers([]);
          setWorkspaceError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setWorkspaceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) return undefined;
    const timer = window.setTimeout(() => setDirectorySearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search, workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      setEmployees([]);
      setEmployeesError("");
      setEmployeesLoading(false);
      return undefined;
    }

    let active = true;
    setEmployeesLoading(true);
    setEmployeesError("");

    userApi.getUsers({
      accountView: "active",
      department: department || undefined,
      role: role || undefined,
      search: directorySearch || undefined,
      limit: 1000,
    })
      .then((response) => {
        if (active) setEmployees(extractUsers(response));
      })
      .catch((error) => {
        if (active) {
          setEmployees([]);
          setEmployeesError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setEmployeesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [department, directorySearch, role, workspaceId]);

  const activeWorkspaceMembers = useMemo(
    () => workspaceMembers.filter((member) => member.is_active),
    [workspaceMembers]
  );
  const departments = useMemo(() => {
    if (!workspaceId) return bootstrap.departments;
    return [...new Set(activeWorkspaceMembers.map((member) => member.department).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  }, [activeWorkspaceMembers, bootstrap.departments, workspaceId]);
  const roles = useMemo(() => {
    if (!workspaceId) return bootstrap.roles;
    return [...new Set(
      activeWorkspaceMembers
        .filter((member) => !department || member.department === department)
        .map((member) => member.member_role)
        .filter(Boolean)
    )].sort();
  }, [activeWorkspaceMembers, bootstrap.roles, department, workspaceId]);

  const roster = useMemo(() => {
    const source = workspaceId ? activeWorkspaceMembers : employees;
    const normalizedSearch = search.trim().toLowerCase();

    return source.filter((person) => {
      const personRole = workspaceId ? person.member_role : person.role;
      const matchesDepartment = !department || person.department === department;
      const matchesRole = !role || personRole === role;
      const matchesSearch = !normalizedSearch || [
        person.name,
        person.email,
        person.department,
        person.job_title,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
      return matchesDepartment && matchesRole && matchesSearch;
    });
  }, [activeWorkspaceMembers, department, employees, role, search, workspaceId]);

  const selectedPortalRole = selectedEmployee?.role || selectedEmployee?.portal_role;
  const roleContract = selectedPortalRole ? roleExperienceContract(selectedPortalRole) : null;
  const selectedWorkspace = bootstrap.workspaces.find((workspace) => String(workspace.id) === workspaceId);
  const loadingRoster = workspaceId ? workspaceLoading : employeesLoading;
  const rosterError = workspaceId ? workspaceError : employeesError;

  const endPreview = () => setSelectedEmployee(null);

  return (
    <div className="portal-shell min-h-screen p-5 portal-title xl:p-8">
      <AdminUniversalHeader title="Workspace & Role Preview" />
      <main className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--portal-primary)]">Developer tools</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Workspace & Role Preview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 portal-muted">
              Inspect department and workspace layouts by role without signing in as an employee.
              Preview data is read-only and stays in this browser session.
            </p>
          </div>
          <Link
            to="/error-logger"
            className="inline-flex items-center gap-2 rounded-xl border portal-border portal-surface-raised px-4 py-2.5 text-sm font-bold portal-copy hover:portal-surface-muted"
          >
            <Activity className="h-4 w-4" />
            Live error snapshots
          </Link>
        </header>

        {(bootstrap.error || rosterError) && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {bootstrap.error || rosterError}
          </div>
        )}

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">Simulation only — no temporary employee access is granted</p>
              <p className="mt-1 text-sm leading-5">
                This preview does not create an employee session, open a remote connection, or allow
                actions on an employee account or device. End the preview or close this page to clear it.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border portal-border portal-surface-raised p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="text-sm font-bold portal-copy">Department</span>
            <select
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setRole("");
                setSelectedEmployee(null);
              }}
              className="mt-2 w-full rounded-xl border portal-border bg-white px-3 py-2.5 text-sm"
              disabled={bootstrap.loading}
            >
              <option value="">All departments</option>
              {departments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold portal-copy">Workspace</span>
            <select
              value={workspaceId}
              onChange={(event) => {
                setWorkspaceId(event.target.value);
                setDepartment("");
                setRole("");
                setSelectedEmployee(null);
              }}
              className="mt-2 w-full rounded-xl border portal-border bg-white px-3 py-2.5 text-sm"
              disabled={bootstrap.loading}
            >
              <option value="">Employee directory</option>
              {bootstrap.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} · {workspace.status}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold portal-copy">
              {workspaceId ? "Workspace role" : "Helpdesk role"}
            </span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setSelectedEmployee(null);
              }}
              className="mt-2 w-full rounded-xl border portal-border bg-white px-3 py-2.5 text-sm"
              disabled={bootstrap.loading || (workspaceId && workspaceLoading)}
            >
              <option value="">All roles</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {workspaceId ? WORKSPACE_ROLE_LABELS[item] || item : ROLE_LABELS[item] || item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold portal-copy">Find a person</span>
            <span className="relative mt-2 block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedEmployee(null);
                }}
                placeholder="Name, email or job title"
                className="w-full rounded-xl border portal-border bg-white py-2.5 pl-10 pr-3 text-sm"
              />
            </span>
          </label>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.8fr)]">
          <section className="overflow-hidden rounded-2xl border portal-border portal-surface-raised shadow-sm">
            <div className="border-b portal-border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-950">
                    {workspaceId ? selectedWorkspace?.name || "Workspace members" : "People"}
                  </h2>
                  <p className="mt-1 text-sm portal-muted">
                    {loadingRoster ? "Loading people..." : `${roster.length} matching ${workspaceId ? "members" : "people"}`}
                  </p>
                </div>
                {workspaceId && <Building2 className="h-5 w-5 text-[var(--portal-primary)]" />}
              </div>
            </div>
            <div className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
              {loadingRoster && <p className="p-5 text-sm portal-muted">Loading preview data...</p>}
              {!loadingRoster && roster.map((person) => {
                const personId = person.user_id || person.id;
                const selected = String(selectedEmployee?.user_id || selectedEmployee?.id) === String(personId);
                const personRole = workspaceId ? person.member_role : person.role;
                return (
                  <button
                    key={personId}
                    type="button"
                    onClick={() => setSelectedEmployee(person)}
                    className={`w-full p-4 text-left transition hover:bg-slate-50 ${selected ? "bg-blue-50" : ""}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-slate-950">{person.name}</span>
                        <span className="mt-1 block truncate text-sm portal-muted">{person.email}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {person.department || "No department"}{person.job_title ? ` · ${person.job_title}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">
                        {workspaceId
                          ? WORKSPACE_ROLE_LABELS[personRole] || personRole
                          : ROLE_LABELS[personRole] || personRole}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!loadingRoster && !rosterError && roster.length === 0 && (
                <p className="p-6 text-center text-sm portal-muted">
                  No people match these filters. Try another department, role, or workspace.
                </p>
              )}
            </div>
          </section>

          <section className="min-w-0">
            {!selectedEmployee ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed portal-border portal-surface-raised p-8 text-center">
                <LayoutDashboard className="h-8 w-8 text-slate-400" />
                <h2 className="mt-3 font-bold text-slate-900">Select a person to preview their role layout</h2>
                <p className="mt-1 max-w-md text-sm portal-muted">
                  Choose a department, optional workspace and role to inspect the available layout.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                      <div>
                        <p className="font-bold text-blue-950">Simulated, read-only role layout</p>
                        <p className="mt-1 text-sm leading-5 text-blue-900">
                          Previewing {selectedEmployee.name}. No employee identity or credentials are being used.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={endPreview}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-900 hover:bg-blue-100"
                    >
                      <X className="h-4 w-4" />
                      End preview
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border portal-border portal-surface-raised p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--portal-primary)]">
                        {selectedWorkspace?.name || "Employee directory"}
                      </p>
                      <h2 className="mt-1 text-2xl font-bold text-slate-950">
                        {ROLE_LABELS[selectedPortalRole] || selectedPortalRole || "Helpdesk"} dashboard
                      </h2>
                      <p className="mt-1 text-sm portal-muted">
                        {selectedEmployee.department || "Department not set"} · {selectedEmployee.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedWorkspace && (
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
                          {WORKSPACE_ROLE_LABELS[selectedEmployee.member_role] || selectedEmployee.member_role}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">
                        Portal role: {ROLE_LABELS[selectedPortalRole] || selectedPortalRole || "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {(ROLE_LAYOUTS[selectedPortalRole] || ROLE_LAYOUTS.user).map(({ label, icon: Icon }) => (
                      <article key={label} className="rounded-xl border portal-border portal-surface-muted p-4">
                        <div className="flex items-center gap-3">
                          <span className="rounded-lg bg-white p-2 text-[var(--portal-primary)] shadow-sm">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="font-bold portal-copy">{label}</p>
                            <p className="mt-0.5 text-xs portal-muted">Sample layout section</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="mt-4 text-xs portal-muted">
                    Layout sections are a simulation; live ticket content and device access are not loaded.
                  </p>
                </section>

                {roleContract && (
                  <section className="rounded-2xl border portal-border portal-surface-raised p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <BriefcaseBusiness className="h-5 w-5 text-[var(--portal-primary)]" />
                      <div>
                        <h3 className="font-bold text-slate-950">Role experience contract</h3>
                        <p className="mt-1 text-sm portal-muted">
                          Home route: <span className="font-semibold">{roleContract.homeRoute}</span>
                          {" · "}Workspace scope: <span className="font-semibold">{roleContract.workspaceScope}</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(roleContract.capabilities || []).map((capability) => (
                        <span key={capability} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                          {capability.replaceAll("-", " ")}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
