import { useState, useEffect, useCallback } from "react";
import OperationsShell from "../components/OperationsShell";
import { projectReviewApi } from "../services/api";
import { Home, RefreshCw, AlertCircle, TrendingUp, Wrench, Eye, Filter } from "lucide-react";

const IMPACT_COLORS = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-sky-100 text-sky-700 border-sky-200",
};

const CLASSIFICATION_ICONS = {
  "Optimisation opportunity": TrendingUp,
  "Technical debt": Wrench,
  "UX improvement": Eye,
};

export default function ProjectReviewPage() {
  const [findings, setFindings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ classification: "", impact: "" });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  const loadFindings = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 50 };
      if (filters.classification) params.classification = filters.classification;
      if (filters.impact) params.impact = filters.impact;
      const r = await projectReviewApi.getFindings(params);
      setFindings(r.data.findings || []);
      setPagination(r.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load findings.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFindings(1);
  }, [loadFindings]);

  const triggerScan = async () => {
    setScanning(true);
    setError(null);
    try {
      await projectReviewApi.triggerScan({ scope: "full" });
      setTimeout(() => loadFindings(1), 3000);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to trigger scan.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <OperationsShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-3 text-sm text-slate-500">
          <button onClick={() => window.history.back()} className="flex items-center gap-1 font-medium text-sky-700 hover:underline">
            <Home className="h-4 w-4" /> Back
          </button>
          <span>/</span>
          <span>Project Review</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Project Review Findings</h1>
              <p className="mt-1 text-sm text-slate-500">Codebase survey for optimisation opportunities, technical debt, and UX improvements.</p>
            </div>
            <button
              onClick={triggerScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning..." : "Trigger Scan"}
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filters.classification}
              onChange={(e) => setFilters((f) => ({ ...f, classification: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">All Classifications</option>
              <option value="Technical debt">Technical Debt</option>
              <option value="Optimisation opportunity">Optimisation Opportunity</option>
              <option value="UX improvement">UX Improvement</option>
            </select>
            <select
              value={filters.impact}
              onChange={(e) => setFilters((f) => ({ ...f, impact: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">All Impacts</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <span className="text-xs text-slate-400">{pagination.total} findings</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading findings...</div>
          ) : findings.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No findings. Trigger a scan to generate findings.</div>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => {
                const Icon = CLASSIFICATION_ICONS[f.classification] || AlertCircle;
                return (
                  <div key={f.findingId} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{f.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${IMPACT_COLORS[f.impact] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {f.impact} impact
                          </span>
                          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                            {f.effort} effort
                          </span>
                          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                            {f.classification}
                          </span>
                          {f.linkedCapability && (
                            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                              {f.linkedCapability}
                            </span>
                          )}
                        </div>
                        {f.affectedArea && f.affectedArea !== "—" && (
                          <p className="mt-1.5 font-mono text-xs text-slate-400">{f.affectedArea}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => loadFindings(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
              <button
                onClick={() => loadFindings(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </OperationsShell>
  );
}