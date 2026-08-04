import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import UserAccessDialog from "../components/UserAccessDialog";
import UserActionMenu from "../components/UserActionMenu";
import UserEditDialog from "../components/UserEditDialog";
import { useAuth } from "../hooks/useAuth";
import { azureApi, userApi } from "../services/api";

const VIEWS = [
  { id: "pending", label: "Pending Signups", icon: UserCheck, countKey: "pending" },
  { id: "active", label: "Active Users", icon: CheckCircle2, countKey: "active", hint: "Microsoft-enabled people, same as Freshservice" },
  { id: "deactivated", label: "Deactivated", icon: UserX, countKey: "deactivated", hint: "Admin-deactivated or Microsoft account disabled" },
  { id: "archived", label: "Archived Accounts", icon: Archive, countKey: "archived" },
  { id: "external", label: "External Emails", icon: ExternalLink, countKey: "external" },
  { id: "non-person", label: "Non-Person Accounts", icon: ShieldCheck, countKey: "non_person", hint: "Shared mailboxes and service accounts" },
];

const ROLE_LABELS = {
  user: "Employee",
  agent: "Agent",
  operator: "Operator",
  manager: "Manager",
  admin: "Administrator",
  superadmin: "Superadministrator",
  pending: "Pending",
};

const PAGE_SIZE = 25;

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || "The action failed.";
}

function getAccountStateLabel(account) {
  if (account.archived_at) return "Archived";
  if (account.account_type && account.account_type !== "person") return "Non-person";
  if (!account.approved || account.role === "pending") return "Pending approval";
  if (account.microsoft_account_enabled === false) return "Microsoft disabled";
  if (account.deactivated_at) return "Deactivated by administrator";
  if (!account.last_login_at) return "Never signed in";
  if (account.status === "inactive") return "Inactive";
  return "Active";
}

function selectableRoles(currentUserRole, targetAccount) {
  const common = ["user", "agent", "operator", "manager", "admin"];
  if (currentUserRole === "superadmin") return [...common, "superadmin"];
  if (targetAccount?.role === "superadmin") return [];
  return common;
}

function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((value) => pages.add(value));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((value) => pages.add(value));
  return [...pages].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
}

function PaginationBar({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.total <= 0) return null;
  const pages = pageWindow(pagination.page, pagination.totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm text-slate-600">
        Page <span className="font-bold text-slate-950">{pagination.page}</span> of{" "}
        <span className="font-bold text-slate-950">{pagination.totalPages}</span>
        {" · "}
        <span className="font-bold text-slate-950">{pagination.total.toLocaleString("en-ZA")}</span> accounts
        {" · "}
        {pagination.perPage} per page
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pagination.page <= 1 || loading}
          onClick={() => onPageChange(pagination.page - 1)}
          className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        {pages.map((pageNumber, index) => {
          const previous = pages[index - 1];
          const showGap = previous && pageNumber - previous > 1;
          return (
            <span key={pageNumber} className="inline-flex items-center gap-1.5">
              {showGap ? <span className="px-1 text-slate-400">…</span> : null}
              <button
                type="button"
                disabled={loading}
                onClick={() => onPageChange(pageNumber)}
                className={
                  pageNumber === pagination.page
                    ? "min-w-9 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                    : "min-w-9 rounded-xl border bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                }
              >
                {pageNumber}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages || loading}
          onClick={() => onPageChange(pagination.page + 1)}
          className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const view = VIEWS.some((item) => item.id === requestedView) ? requestedView : "active";

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ summary: {}, roles: [], departments: [] });
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [accessUser, setAccessUser] = useState(null);
  const searchTimerRef = useRef(null);
  const tableScrollRef = useRef(null);

  const isSuperadmin = currentUser?.role === "superadmin";
  const isAdmin = ["admin", "superadmin"].includes(currentUser?.role);

  useEffect(() => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(searchTimerRef.current);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResult, metaResult] = await Promise.all([
        userApi.getUsers({
          accountView: view,
          // Archived and pending can include non-company addresses (e.g. test signups).
          includeExternal: ["pending", "external", "archived"].includes(view),
          includeArchived: view === "archived",
          search: appliedSearch || undefined,
          page,
          per_page: PAGE_SIZE,
        }),
        userApi.getMeta(),
      ]);
      const { users: nextUsers, pagination: nextPagination } = userApi.unwrapUsers(usersResult.data);
      setUsers(nextUsers);
      setPagination(nextPagination);
      setMeta(metaResult.data || { summary: {}, roles: [], departments: [] });
      setSelectedIds((current) =>
        current.filter((id) => nextUsers.some((item) => Number(item.id) === Number(id)))
      );
      if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, view]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedIds([]);
    setPage(1);
  }, [view]);

  const changeView = (nextView) => {
    setSearchParams({ view: nextView });
  };

  const allSelected = users.length > 0 && users.every((item) => selectedIds.includes(Number(item.id)));

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : users.map((item) => Number(item.id)));
  };

  const toggleUser = (userId) => {
    const id = Number(userId);
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const runAction = async ({ action, confirmation, success }) => {
    if (confirmation && !window.confirm(confirmation)) return;
    try {
      await action();
      setMessage({ type: "success", text: success });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    }
  };

  const syncMicrosoft = async () => {
    setSyncing(true);
    try {
      const response = await azureApi.syncUsers({ includeDisabled: true });
      const summary = response.data?.summary;
      setMessage({
        type: "success",
        text: summary
          ? `Microsoft sync completed: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed.`
          : "Microsoft 365 users synchronized.",
      });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setSyncing(false);
    }
  };

  const runBulkAction = async (action, value, confirmation) => {
    if (!selectedIds.length) return;
    if (!window.confirm(confirmation)) return;
    setBulkBusy(true);
    try {
      const response = await userApi.bulkAction({ userIds: selectedIds, action, value });
      const result = response.data || {};
      setMessage({
        type: result.failed ? "error" : "success",
        text: `Bulk action completed: ${result.updated || 0} updated, ${result.skipped || 0} skipped, ${result.failed || 0} failed.`,
      });
      setSelectedIds([]);
      await load();
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBulkBusy(false);
    }
  };

  const promptBulkRole = () => {
    const allowed = isSuperadmin
      ? ["user", "agent", "operator", "manager", "admin", "superadmin"]
      : ["user", "agent", "operator", "manager", "admin"];
    const value = window.prompt(`Enter role: ${allowed.join(", ")}`)?.trim().toLowerCase();
    if (!value) return;
    if (!allowed.includes(value)) {
      setMessage({ type: "error", text: "Invalid or unauthorised role." });
      return;
    }
    runBulkAction("set_role", value, `Change the role of ${selectedIds.length} selected account(s) to ${ROLE_LABELS[value]}?`);
  };

  const menuActions = (account) => {
    const ownAccount = Number(account.id) === Number(currentUser?.id);
    const protectedSuperadmin = account.role === "superadmin" && !isSuperadmin;
    const actions = [
      { label: "Edit profile", icon: UserCog, onClick: () => setEditingUser(account), hidden: !isAdmin || protectedSuperadmin },
      { label: "Edit role", icon: ShieldCheck, onClick: () => setEditingUser({ ...account, initialSection: "role" }), hidden: !isAdmin || protectedSuperadmin || ownAccount },
      { label: "Edit access and layout", icon: ShieldCheck, onClick: () => setAccessUser(account), hidden: !isAdmin || protectedSuperadmin },
      { label: "Email preferences", icon: Mail, onClick: () => setAccessUser({ ...account, initialTab: "email" }), hidden: !isAdmin || protectedSuperadmin },
    ];

    if ((!account.approved || account.role === "pending") && !protectedSuperadmin) {
      actions.push({
        label: "Approve account",
        icon: UserCheck,
        onClick: () => setEditingUser({ ...account, initialSection: "approve" }),
      });
    }
    if (!account.archived_at && account.status === "active" && !ownAccount && !protectedSuperadmin) {
      actions.push({
        label: "Deactivate",
        icon: UserX,
        danger: true,
        onClick: () => runAction({
          action: () => userApi.deactivateUser(account.id, "Deactivated by administrator"),
          confirmation: `Deactivate ${account.name || account.email}?`,
          success: "Account deactivated.",
        }),
      });
    }
    if (!account.archived_at && account.status !== "active" && !protectedSuperadmin) {
      actions.push({
        label: "Reactivate",
        icon: CheckCircle2,
        onClick: () => runAction({
          action: () => userApi.reactivateUser(account.id),
          confirmation: `Reactivate ${account.name || account.email}?`,
          success: "Account reactivated.",
        }),
      });
    }
    if (!account.archived_at && !ownAccount && !protectedSuperadmin) {
      actions.push({
        label: "Archive",
        icon: Archive,
        danger: true,
        onClick: () => runAction({
          action: () => userApi.archiveUser(account.id, "Archived by administrator"),
          confirmation: `Archive ${account.name || account.email}?`,
          success: "Account archived.",
        }),
      });
    }
    if (account.archived_at && !protectedSuperadmin) {
      actions.push({
        label: "Restore",
        icon: CheckCircle2,
        onClick: () => runAction({
          action: () => userApi.restoreUser(account.id),
          confirmation: `Restore ${account.name || account.email}?`,
          success: "Account restored to inactive state.",
        }),
      });
    }
    if (account.archived_at && isSuperadmin && !ownAccount) {
      actions.push({
        label: "Delete permanently",
        icon: UserX,
        danger: true,
        onClick: () => runAction({
          action: () => userApi.deleteUser(account.id),
          confirmation: `Permanently delete ${account.name || account.email}? This cannot be undone.`,
          success: "Account permanently deleted.",
        }),
      });
    }
    return actions.filter((item) => !item.hidden);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 p-4 xl:p-5">
      <div className="mx-auto flex h-full w-full max-w-[1700px] min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-700">Administration</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-950 xl:text-3xl">User Administration</h1>
            <p className="mt-0.5 text-sm text-slate-500">Manage accounts, roles, access layouts and communication preferences.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">
              <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </button>
            <button type="button" onClick={syncMicrosoft} disabled={syncing} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              <RefreshCw className={`mr-2 inline h-4 w-4 ${syncing ? "animate-spin" : ""}`} />Sync Microsoft 365
            </button>
          </div>
        </header>

        {message && (
          <div className={`mt-3 shrink-0 rounded-xl border p-3 text-sm font-semibold ${message.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {message.text}
          </div>
        )}

        <section className="mt-3 grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                title={item.hint || item.label}
                onClick={() => changeView(item.id)}
                className={`rounded-xl border px-3 py-3 text-left shadow-sm ${view === item.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-4 w-4 text-blue-700" />
                  <p className="text-2xl font-bold text-slate-950">{meta.summary?.[item.countKey] || 0}</p>
                </div>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
              </button>
            );
          })}
        </section>

        <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[250px_1fr]">
          <aside className="min-h-0 overflow-y-auto rounded-2xl border bg-white p-2 shadow-sm">
            {VIEWS.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => changeView(item.id)} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold ${view === item.id ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{item.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${view === item.id ? "bg-white/20" : "bg-slate-100"}`}>{meta.summary?.[item.countKey] || 0}</span>
                </button>
              );
            })}
          </aside>

          <main className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-white p-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, department or employee number" className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm" />
              </div>
              {selectedIds.length > 0 && isAdmin && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2">
                  <span className="px-2 text-sm font-bold text-blue-800">{selectedIds.length} selected</span>
                  <button type="button" disabled={bulkBusy} onClick={promptBulkRole} className="rounded-lg bg-white px-3 py-2 text-xs font-bold">Change role</button>
                  <button type="button" disabled={bulkBusy} onClick={() => runBulkAction("deactivate", null, `Deactivate ${selectedIds.length} selected account(s)?`)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-700">Deactivate</button>
                  <button type="button" disabled={bulkBusy} onClick={() => runBulkAction("archive", null, `Archive ${selectedIds.length} selected account(s)?`)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700">Archive</button>
                  <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg px-3 py-2 text-xs font-bold">Clear</button>
                </div>
              )}
            </div>

            <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[1180px] text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
                  <tr>
                    <th className="w-12 bg-slate-50 p-4"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all users on this page" /></th>
                    <th className="bg-slate-50 p-4">Account</th>
                    <th className="bg-slate-50 p-4">Department</th>
                    <th className="bg-slate-50 p-4">Role</th>
                    <th className="bg-slate-50 p-4">State</th>
                    <th className="bg-slate-50 p-4">Last Login</th>
                    <th className="bg-slate-50 p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="7" className="p-10 text-center text-slate-500">Loading accounts...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan="7" className="p-10 text-center text-slate-500">No accounts in this view.</td></tr>
                  ) : users.map((account) => (
                    <tr key={account.id} className="hover:bg-slate-50">
                      <td className="p-4"><input type="checkbox" checked={selectedIds.includes(Number(account.id))} onChange={() => toggleUser(account.id)} aria-label={`Select ${account.name || account.email}`} /></td>
                      <td className="p-4"><p className="font-bold text-slate-950">{account.name}</p><p className="text-sm text-slate-500">{account.email}</p><p className="mt-1 text-xs text-slate-400">{account.account_type || "person"}</p></td>
                      <td className="p-4"><p className="font-semibold">{account.department || "Not assigned"}</p><p className="text-sm text-slate-500">{account.job_title || "No job title"}</p></td>
                      <td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{ROLE_LABELS[account.role] || account.role}</span></td>
                      <td className="p-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{getAccountStateLabel(account)}</span></td>
                      <td className="p-4 text-sm text-slate-500">{account.last_login_at ? new Date(account.last_login_at).toLocaleString("en-ZA") : "Never"}</td>
                      <td className="p-4 text-right"><UserActionMenu actions={menuActions(account)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="shrink-0">
              <PaginationBar
                pagination={pagination}
                loading={loading}
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  setSelectedIds([]);
                }}
              />
            </div>
          </main>
        </div>
      </div>

      {editingUser && (
        <UserEditDialog
          account={editingUser}
          roles={selectableRoles(currentUser?.role, editingUser)}
          departments={meta.departments || []}
          onClose={() => setEditingUser(null)}
          onSaved={async (text) => {
            setEditingUser(null);
            setMessage({ type: "success", text });
            await load();
          }}
        />
      )}

      {accessUser && (
        <UserAccessDialog
          account={accessUser}
          initialTab={accessUser.initialTab || "features"}
          onClose={() => setAccessUser(null)}
          onSaved={(text) => setMessage({ type: "success", text })}
        />
      )}
    </div>
  );
}
