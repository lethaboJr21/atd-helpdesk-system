import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCircle2, ExternalLink, RefreshCw, Search, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { azureApi, userApi } from "../services/api";

const VIEWS = [
  { id: "pending", label: "Pending Signups", icon: UserCheck, countKey: "pending" },
  { id: "active", label: "Active Users", icon: CheckCircle2, countKey: "active" },
  { id: "deactivated", label: "Inactive / Deactivated", icon: UserX, countKey: "deactivated" },
  { id: "archived", label: "Archived Accounts", icon: Archive, countKey: "archived" },
  { id: "external", label: "External Emails", icon: ExternalLink, countKey: "external" },
  { id: "non-person", label: "Non-Person Accounts", icon: ShieldCheck, countKey: "non_person" },
];

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

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const view = VIEWS.some((item) => item.id === requestedView) ? requestedView : "active";
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ summary: {}, roles: [], departments: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const searchTimerRef = useRef(null);
  const isSuperadmin = currentUser?.role === "superadmin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResult, metaResult] = await Promise.all([
        userApi.getUsers({
          accountView: view,
          includeExternal: ["pending", "external"].includes(view),
          includeArchived: view === "archived",
          search: search || undefined,
          limit: 1000,
        }),
        userApi.getMeta(),
      ]);
      setUsers(Array.isArray(usersResult.data) ? usersResult.data : []);
      setMeta(metaResult.data || { summary: {}, roles: [], departments: [] });
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [search, view]);

  useEffect(() => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(load, 250);
    return () => window.clearTimeout(searchTimerRef.current);
  }, [load]);

  const roleOptions = useMemo(
    () => (meta.roles || []).filter((role) => isSuperadmin || !["admin", "superadmin"].includes(role)),
    [isSuperadmin, meta.roles]
  );

  const runAction = async ({ action, confirmation, success }) => {
    if (!window.confirm(confirmation)) return;
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

  return (
    <div className="min-h-screen bg-slate-100 p-5 xl:p-8">
      <div className="mx-auto max-w-[1650px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Administration</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">User Administration</h1>
            <p className="mt-1 text-sm text-slate-500">Account states are mutually exclusive and remain historically traceable.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold disabled:opacity-60">
              <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button type="button" onClick={syncMicrosoft} disabled={syncing} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
              <RefreshCw className={`mr-2 inline h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync Microsoft 365
            </button>
          </div>
        </header>

        {message && (
          <div className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${message.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {message.text}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => setSearchParams({ view: item.id })} className={`rounded-2xl border p-4 text-left shadow-sm ${view === item.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                <Icon className="h-5 w-5 text-blue-700" />
                <p className="mt-3 text-xs font-bold uppercase text-slate-500">{item.label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-950">{meta.summary?.[item.countKey] || 0}</p>
              </button>
            );
          })}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[270px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {VIEWS.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => setSearchParams({ view: item.id })} className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold ${view === item.id ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{item.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${view === item.id ? "bg-white/20" : "bg-slate-100"}`}>{meta.summary?.[item.countKey] || 0}</span>
                </button>
              );
            })}
          </aside>

          <main className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, department or employee number" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="p-4">Account</th><th className="p-4">Department</th><th className="p-4">Role</th><th className="p-4">State</th><th className="p-4">Last Login</th><th className="p-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="6" className="p-10 text-center text-slate-500">Loading accounts...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan="6" className="p-10 text-center text-slate-500">No accounts in this view.</td></tr>
                  ) : users.map((account) => (
                    <tr key={account.id} className="hover:bg-slate-50">
                      <td className="p-4"><p className="font-bold text-slate-950">{account.name}</p><p className="text-sm text-slate-500">{account.email}</p><p className="mt-1 text-xs text-slate-400">{account.account_type || "person"}</p></td>
                      <td className="p-4"><p className="font-semibold">{account.department || "Not assigned"}</p><p className="text-sm text-slate-500">{account.job_title || "No job title"}</p></td>
                      <td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{account.role}</span></td>
                      <td className="p-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{getAccountStateLabel(account)}</span></td>
                      <td className="p-4 text-sm text-slate-500">{account.last_login_at ? new Date(account.last_login_at).toLocaleString("en-ZA") : "Never"}</td>
                      <td className="p-4"><div className="flex justify-end gap-2">
                        {view === "pending" && <ApproveControl account={account} roles={roleOptions} onApprove={(role) => runAction({ action: () => userApi.approveUser(account.id, role), confirmation: `Approve ${account.name || account.email}?`, success: "Account approved." })} />}
                        {view === "active" && Number(account.id) !== Number(currentUser?.id) && <button onClick={() => runAction({ action: () => userApi.deactivateUser(account.id, "Deactivated by administrator"), confirmation: `Deactivate ${account.name || account.email}? Existing records will be preserved.`, success: "Account deactivated and existing records preserved." })} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700">Deactivate</button>}
                        {view === "deactivated" && <button onClick={() => runAction({ action: () => userApi.reactivateUser(account.id), confirmation: `Reactivate ${account.name || account.email}?`, success: "Account reactivated." })} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">Reactivate</button>}
                        {view !== "archived" && Number(account.id) !== Number(currentUser?.id) && <button onClick={() => runAction({ action: () => userApi.archiveUser(account.id, "Archived by administrator"), confirmation: `Archive ${account.name || account.email}?`, success: "Account archived." })} className="rounded-lg border px-3 py-2 text-xs font-bold">Archive</button>}
                        {view === "archived" && <button onClick={() => runAction({ action: () => userApi.restoreUser(account.id), confirmation: `Restore ${account.name || account.email} to inactive state?`, success: "Account restored to inactive state." })} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700">Restore</button>}
                        {view === "archived" && isSuperadmin && <button onClick={() => runAction({ action: () => userApi.deleteUser(account.id), confirmation: `Permanently delete ${account.name || account.email}? This cannot be undone.`, success: "Account permanently deleted." })} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Delete</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ApproveControl({ account, roles, onApprove }) {
  const [role, setRole] = useState(account.role === "pending" ? "user" : account.role);
  return (
    <div className="flex gap-2">
      <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border px-2 py-2 text-xs">
        {roles.filter((item) => item !== "pending").map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <button type="button" onClick={() => onApprove(role)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button>
    </div>
  );
}
