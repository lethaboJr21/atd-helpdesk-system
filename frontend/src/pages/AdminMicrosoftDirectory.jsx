import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Cloud,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { azureApi, userApi } from "../services/api";
import AdminUniversalHeader from "../components/admin/AdminUniversalHeader";

function formatWhen(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

export default function AdminMicrosoftDirectory() {
  const navigate = useNavigate();
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [portalMeta, setPortalMeta] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [directoryResult, metaResult] = await Promise.all([
        azureApi.getUsers({ includeDisabled: true }),
        userApi.getMeta(),
      ]);
      setDirectoryUsers(Array.isArray(directoryResult.data?.users) ? directoryResult.data.users : []);
      setPortalMeta(metaResult.data?.summary || null);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error, "Microsoft directory could not be loaded.") });
      setDirectoryUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncMicrosoft = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await azureApi.syncUsers({ includeDisabled: true });
      const summary = response.data?.summary || {};
      setMessage({
        type: "success",
        text: `Sync complete: ${summary.retrieved || 0} read from Microsoft, ${summary.created || 0} created, ${summary.updated || 0} updated${summary.failed ? `, ${summary.failed} failed` : ""}.`,
      });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error, "Microsoft 365 sync failed.") });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return directoryUsers;
    return directoryUsers.filter((user) =>
      [user.name, user.email, user.department, user.jobTitle, user.accountType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [directoryUsers, search]);

  const stats = useMemo(() => {
    const enabled = directoryUsers.filter((user) => user.accountEnabled !== false).length;
    const disabled = directoryUsers.length - enabled;
    const nonPerson = directoryUsers.filter((user) => user.accountType && user.accountType !== "person").length;
    return { total: directoryUsers.length, enabled, disabled, nonPerson };
  }, [directoryUsers]);

  return (
    <div className="portal-shell min-h-screen p-5 xl:p-8"><AdminUniversalHeader title="Microsoft Directory" />
      <div className="mx-auto max-w-[1400px]">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border portal-surface-raised px-4 py-2 text-sm font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Settings
        </button>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--portal-primary)]">Administration</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold text-slate-950">
              <Cloud className="h-8 w-8 text-[var(--portal-primary)]" />
              Microsoft Directory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 portal-muted">
              Read identities from Microsoft 365 and sync them into the helpdesk.
              Roles, approvals and archive state stay on User Administration —
              this page is only the directory link.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/users?view=active")}
              className="rounded-xl border portal-surface-raised px-4 py-3 text-sm font-bold"
            >
              <Users className="mr-2 inline h-4 w-4" />
              Open User Administration
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading || syncing}
              className="rounded-xl border portal-surface-raised px-4 py-3 text-sm font-bold disabled:opacity-60"
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh from Microsoft
            </button>
            <button
              type="button"
              onClick={syncMicrosoft}
              disabled={syncing || loading}
              className="rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync into helpdesk
            </button>
          </div>
        </header>

        {message ? (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="In Microsoft 365" value={stats.total} hint="Company-domain identities returned by Graph" />
          <Stat label="Enabled in Microsoft" value={stats.enabled} hint="accountEnabled = true" />
          <Stat label="Disabled in Microsoft" value={stats.disabled} hint="Will sync as deactivated" />
          <Stat
            label="In helpdesk (active)"
            value={portalMeta?.active ?? "—"}
            hint={`Last directory read ${formatWhen(lastLoadedAt)}`}
          />
        </section>

        <main className="mt-6 overflow-hidden rounded-2xl border portal-surface-raised shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <div className="relative min-w-[280px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Microsoft directory by name, email, department…"
                className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm"
              />
            </div>
            <p className="text-sm font-semibold portal-muted">
              {filtered.length} shown
              {stats.nonPerson ? ` · ${stats.nonPerson} non-person` : ""}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="portal-surface-muted text-xs uppercase tracking-wide portal-muted">
                <tr>
                  <th className="p-4">Identity</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Microsoft</th>
                  <th className="p-4">Account type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="p-10 text-center portal-muted">
                      Loading Microsoft directory…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-10 text-center portal-muted">
                      No Microsoft identities matched.
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => (
                    <tr key={user.microsoftId || user.email}>
                      <td className="p-4">
                        <p className="font-semibold portal-title">{user.name}</p>
                        <p className="text-sm portal-muted">{user.email}</p>
                      </td>
                      <td className="p-4 text-sm portal-copy">
                        <p className="font-semibold">{user.department || "Not assigned"}</p>
                        <p className="portal-muted">{user.jobTitle || "No job title"}</p>
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            user.accountEnabled === false
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {user.accountEnabled === false ? "Disabled" : "Enabled"}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-semibold capitalize portal-copy">
                        {user.accountType || "person"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border portal-border portal-surface-raised p-4 shadow-sm">
      <p className="text-xs font-bold uppercase portal-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}
