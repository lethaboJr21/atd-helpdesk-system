import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { adminControlsApi } from "../services/api";

function statusClass(status) {
  if (status === "healthy") return "bg-emerald-100 text-emerald-800";
  if (status === "degraded" || status === "unknown") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function formatWhen(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function AdminHealthPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminControlsApi.getHealth();
      setHealth(response.data || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "System health could not be loaded.");
      setHealth(requestError?.response?.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const checks = Object.entries(health?.checks || {});

  return (
    <div className="min-h-screen bg-slate-100 p-5 xl:p-8">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Settings
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-700">Administration</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">System Health</h1>
            <p className="mt-1 text-sm text-slate-500">
              API, database, Microsoft directory sync and ticket store status.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border bg-white px-4 py-3 text-sm font-bold disabled:opacity-60"
          >
            <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Overall</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {loading ? "…" : health?.status || "unknown"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Checked {formatWhen(health?.timestamp)} · Email via {health?.emailProvider || "—"}
            </p>
          </div>

          {checks.map(([name, check]) => (
            <div key={name} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase text-slate-500">{name.replace(/_/g, " ")}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(check.status)}`}>
                  {check.status}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                {check.syncedUsers != null ? <p>Synced users: {check.syncedUsers}</p> : null}
                {check.lastSyncAt !== undefined ? <p>Last sync: {formatWhen(check.lastSyncAt)}</p> : null}
                {check.total != null ? <p>Total tickets: {check.total}</p> : null}
                {check.open != null ? <p>Open tickets: {check.open}</p> : null}
                {check.detail ? <p className="text-red-600">{check.detail}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
