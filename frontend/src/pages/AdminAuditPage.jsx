import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { adminControlsApi } from "../services/api";
import AdminUniversalHeader from "../components/admin/AdminUniversalHeader";

function formatWhen(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AdminAuditPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminControlsApi.getAudit({ limit: 200 });
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Audit activity could not be loaded.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="portal-shell min-h-screen p-5 xl:p-8"><AdminUniversalHeader title="Audit Activity" />
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border portal-surface-raised px-4 py-2 text-sm font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Settings
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--portal-primary)]">Administration</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Audit Activity</h1>
            <p className="mt-1 text-sm portal-muted">
              Administrative actions such as approvals, role changes and archive events.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border portal-surface-raised px-4 py-3 text-sm font-bold disabled:opacity-60"
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

        <div className="mt-6 overflow-hidden rounded-2xl border portal-surface-raised shadow-sm">
          <table className="w-full min-w-[900px] text-left">
            <thead className="portal-surface-muted text-xs uppercase tracking-wide portal-muted">
              <tr>
                <th className="p-4">When</th>
                <th className="p-4">Action</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-10 text-center portal-muted">
                    Loading audit activity...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-10 text-center portal-muted">
                    No administrative actions recorded yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="p-4 text-sm portal-copy">{formatWhen(row.created_at)}</td>
                    <td className="p-4 text-sm font-semibold portal-title">{row.action}</td>
                    <td className="p-4 text-sm portal-copy">
                      <div className="font-semibold">{row.actor_name || "System"}</div>
                      <div className="text-xs portal-muted">{row.actor_email || "—"}</div>
                    </td>
                    <td className="p-4 text-sm portal-copy">
                      <div className="font-semibold">{row.target_name || "—"}</div>
                      <div className="text-xs portal-muted">{row.target_email || "—"}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
