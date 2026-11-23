import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, ChevronRight, Clock, Loader2, RefreshCw, X } from "lucide-react";
import { pulseApi } from "../../services/api";

const LIVE_REFRESH_MS = 15000;
const RESOLUTION_TABS = [
  { id: "open", label: "Open" },
  { id: "investigating", label: "Investigating" },
  { id: "fixed", label: "Fixed" },
];

const severityTone = {
  Critical: "border-red-300 bg-red-50 text-red-800",
  High: "border-orange-300 bg-orange-50 text-orange-800",
  Medium: "border-amber-300 bg-amber-50 text-amber-800",
  Low: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function ErrorLoggerViewer() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState("open");
  const [resolutionSolution, setResolutionSolution] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);
  const [resolutionNotice, setResolutionNotice] = useState("");
  const [tab, setTab] = useState("open");
  const [filters, setFilters] = useState({ severity: "", errorType: "", sourceFile: "" });
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestInFlight = useRef(false);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    requestInFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 50, resolutionStatus: tab, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const r = await pulseApi.listEntries(params);
      if (requestId === requestSequence.current) {
        setEntries(r.data.entries || []);
        setTotal(r.data.total || 0);
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (requestId === requestSequence.current) {
        setError(e.response?.data?.error || e.message);
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        requestInFlight.current = false;
      }
    }
  }, [filters, page, tab]);

  useEffect(() => {
    load();
    const refreshTimer = window.setInterval(() => {
      if (!requestInFlight.current) load();
    }, LIVE_REFRESH_MS);
    return () => window.clearInterval(refreshTimer);
  }, [load]);

  const openDetail = async (correlationId) => {
    try {
      setError("");
      const r = await pulseApi.getEntry(correlationId);
      setSelected(r.data);
      setResolutionStatus(r.data.entry?.resolutionStatus || "open");
      setResolutionSolution(r.data.entry?.resolutionSolution || "");
      setResolutionNotice("");
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const saveResolution = async (correlationId) => {
    if (resolutionStatus === "fixed" && !resolutionSolution.trim()) {
      setError("Enter the solution introduced before marking this error fixed.");
      return;
    }

    setSavingResolution(true);
    setError("");
    setResolutionNotice("");
    try {
      const response = await pulseApi.updateResolution(correlationId, {
        status: resolutionStatus,
        solution: resolutionSolution,
      });
      if (response.data.resolutionStatus === "fixed") {
        setSelected(null);
        setEntries([]);
      } else {
        setSelected((current) => ({
          ...current,
          entry: { ...current.entry, ...response.data },
        }));
      }
      setResolutionStatus(response.data.resolutionStatus);
      setResolutionSolution(response.data.resolutionSolution || resolutionSolution);
      setTab(response.data.resolutionStatus);
      setPage(1);
      setResolutionNotice(
        response.data.resolutionStatus === "fixed"
          ? "Marked fixed and moved to the Fixed tab."
          : `Tracking status updated to ${response.data.resolutionStatus}.`
      );
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message);
    } finally {
      setSavingResolution(false);
    }
  };

  const confirmRootCause = async (correlationId) => {
    const refinement = prompt("Refine suspected origin (optional):") || "";
    try {
      await pulseApi.confirmRootCause(correlationId, { suspectedOrigin: refinement || undefined });
      await openDetail(correlationId);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-sky-700"><Bug className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Live error stream</p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-950">Incident register</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live · 15 second refresh
            </span>
            <span className="text-sm text-slate-500">
              {lastUpdated ? `Synced ${lastUpdated.toLocaleTimeString()}` : "Waiting for first snapshot"}
            </span>
            <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1.2fr_1.4fr_auto]">
          <label className="block text-xs font-bold text-slate-600">
            Severity
            <select value={filters.severity} onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value })); setPage(1); }} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100">
              <option value="">All severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Error type
            <input placeholder="e.g. TypeError" value={filters.errorType} onChange={(e) => { setFilters((f) => ({ ...f, errorType: e.target.value })); setPage(1); }} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100" />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Source file
            <input placeholder="Filter by file or path" value={filters.sourceFile} onChange={(e) => { setFilters((f) => ({ ...f, sourceFile: e.target.value })); setPage(1); }} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100" />
          </label>
          <div className="flex items-end gap-2">
            {activeFilterCount > 0 && (
              <button type="button" onClick={() => { setFilters({ severity: "", errorType: "", sourceFile: "" }); setPage(1); }} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                <X className="h-4 w-4" />Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {resolutionNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{resolutionNotice}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Error resolution status">
          {RESOLUTION_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setPage(1);
                setSelected(null);
                setEntries([]);
                setTotal(0);
              }}
              aria-current={tab === item.id ? "page" : undefined}
              className={tab === item.id
                ? "rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm"
                : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <p className="text-sm text-slate-500">
          {loading && <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin align-[-3px]" />}
          Showing <span className="font-bold text-slate-800">{entries.length}</span> of <span className="font-bold text-slate-800">{total}</span> matching {tab} errors
        </p>
      </div>

      {selected ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800"><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-950">Error detail</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs text-slate-500">{selected.entry?.correlationId}</p>
                  {selected.entry?.instrumentationMarker === "SIMULATED_WORKFLOW" && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">Simulated workflow</span>}
                </div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"><X className="h-4 w-4" />Back to register</button>
          </div>
          <div className="space-y-5 p-5 text-sm sm:p-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Error type</p><p className="mt-1 break-words font-semibold text-slate-900">{selected.entry?.errorType}</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Severity</p><p className="mt-1"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${severityTone[selected.entry?.severity] || ""}`}>{selected.entry?.severity}</span></p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Occurrences</p><p className="mt-1 font-semibold text-slate-900">{selected.entry?.occurrenceCount}</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Source</p><p className="mt-1 break-all font-semibold text-slate-900">{selected.entry?.sourceFile || "Unknown"}</p></div>
            </section>
            <section className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Error message</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-slate-800">{selected.entry?.errorMessage}</p>
            </section>
            <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
              <p><span className="font-bold text-slate-700">First seen:</span> {new Date(selected.entry?.timestamp).toLocaleString()}</p>
              <p><span className="font-bold text-slate-700">Last seen:</span> {new Date(selected.entry?.lastOccurredAt).toLocaleString()}</p>
            </div>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900">Resolution tracking</h4>
                  <p className="mt-1 text-xs text-slate-500">A fixed error requires the corrective solution for future reference.</p>
                </div>
                <select
                  value={resolutionStatus}
                  onChange={(event) => {
                    if (event.target.value === "fixed" && resolutionStatus !== "fixed") {
                      setResolutionSolution("");
                    }
                    setResolutionStatus(event.target.value);
                  }}
                  disabled={savingResolution}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  aria-label="Resolution status"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              {resolutionStatus === "fixed" ? (
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Solution introduced
                  <textarea
                    value={resolutionSolution}
                    onChange={(event) => setResolutionSolution(event.target.value)}
                    rows={4}
                    maxLength={5000}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal"
                    placeholder="Describe the change that fixed the issue and how it was verified."
                  />
                </label>
              ) : selected.entry?.resolutionSolution ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold uppercase text-amber-900">Previously recorded solution</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{selected.entry.resolutionSolution}</p>
                </div>
              ) : null}
              {selected.entry?.fixedAt && (
                <p className="mt-2 text-xs text-slate-500">Last marked fixed {new Date(selected.entry.fixedAt).toLocaleString()}</p>
              )}
              <button
                type="button"
                onClick={() => saveResolution(selected.entry?.correlationId)}
                disabled={savingResolution}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {resolutionStatus === "fixed" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {savingResolution ? "Saving..." : resolutionStatus === "fixed" ? "Mark Fixed & Move to Fixed tab" : "Save tracking status"}
              </button>
            </section>
            {selected.entry?.stackTrace && (
              <div>
                <span className="font-semibold">Stack trace:</span>
                <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{selected.entry.stackTrace}</pre>
              </div>
            )}
            {selected.snapshot && (
              <div>
                <span className="font-semibold">Snapshot:</span>
                <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(selected.snapshot, null, 2)}</pre>
              </div>
            )}
            {selected.rootCause && (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Root Cause</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${selected.rootCause.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{selected.rootCause.status}</span>
                </div>
                <p className="mt-1 text-sm">{selected.rootCause.suspectedOrigin}</p>
                {selected.rootCause.contributingFactors?.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-slate-600">{selected.rootCause.contributingFactors.map((f, i) => <li key={i}>{f}</li>)}</ul>
                )}
                {selected.rootCause.status !== "confirmed" && (
                  <button onClick={() => confirmRootCause(selected.entry?.correlationId)} className="mt-2 rounded-lg bg-sky-700 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-800">Confirm Root Cause</button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {loading && !entries.length ? (
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-4 w-1/4 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
              </div>
            ))
          ) : entries.map((entry) => (
            <button
              key={entry.correlationId}
              type="button"
              onClick={() => openDetail(entry.correlationId)}
              className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-100 sm:p-5"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <span className={`mt-0.5 inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${severityTone[entry.severity] || ""}`}>{entry.severity}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-950">{entry.errorType}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${entry.resolutionStatus === "fixed" ? "bg-emerald-100 text-emerald-800" : entry.resolutionStatus === "investigating" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                      {entry.resolutionStatus || "open"}
                    </span>
                    {entry.instrumentationMarker === "SIMULATED_WORKFLOW" && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-800">Simulated</span>}
                    {entry.occurrenceCount > 1 && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{entry.occurrenceCount} occurrences</span>}
                  </div>
                  <p className="mt-1 break-words text-sm leading-5 text-slate-700">{entry.errorMessage}</p>
                  {entry.resolutionStatus === "fixed" && entry.resolutionSolution && (
                    <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm leading-5 text-emerald-950">
                      <span className="font-bold">Solution:</span> {entry.resolutionSolution}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="max-w-full break-all">{entry.sourceFile || "Unknown source"}</span>
                    <span>Last seen {new Date(entry.lastOccurredAt || entry.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-700" />
              </div>
            </button>
          ))}
          {!loading && !entries.length && error && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-100 text-red-700"><AlertTriangle className="h-6 w-6" /></span>
              <h3 className="mt-4 font-bold text-red-900">Error snapshots are unavailable</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-red-800">The error register could not be loaded. Review the error above, then retry.</p>
              <button type="button" onClick={load} className="mt-4 rounded-xl bg-red-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-900">Retry</button>
            </div>
          )}
          {!loading && !entries.length && !error && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><CheckCircle2 className="h-6 w-6" /></span>
              <h3 className="mt-4 font-bold text-slate-900">No {tab} errors</h3>
              <p className="mt-1 text-sm text-slate-500">There are no matching errors in this view. Try another status or clear the active filters.</p>
            </div>
          )}
          {total > 50 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Previous</button>
              <span className="text-sm tabular-nums text-slate-500">Page {page} of {Math.ceil(total / 50)}</span>
              <button type="button" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}