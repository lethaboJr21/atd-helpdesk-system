import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Factory,
  Filter,
  RefreshCw,
  Search,
  Ticket,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import WorkspaceShell from "../components/WorkspaceShell";
import PdmCompletionPanel from "../components/pdm/PdmCompletionPanel";
import PdmKanbanBoard from "../components/pdm/PdmKanbanBoard";
import CatalogueHierarchyTree from "../components/catalogue/CatalogueHierarchyTree";
import api, { processEngineeringWorkspaceApi } from "../services/api";

const EMPTY_FILTERS = { search: "", status: "", priority: "", category: "", assignee: "", supportGroup: "", origin: "", highCritical: false, overdue: false, activeOnly: false, unassigned: false };
const CLOSED = new Set(["resolved", "closed"]);
const text = (value) => String(value || "");
const isClosed = (ticket) => CLOSED.has(text(ticket.status).toLowerCase());
const percent = (part, total) => total ? Math.round((part / total) * 100) : 0;

function MetricCard({ label, value, caption, icon: Icon, tone = "cyan", onClick }) {
  const tones = {
    cyan: "border-cyan-100 bg-cyan-50 text-cyan-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    red: "border-red-100 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-white text-slate-800",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`rounded-xl border p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-4 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </button>
  );
}

function Distribution({ title, rows, color = "bg-cyan-600", onSelect }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">Based on PDM tickets currently in view.</p>
        </div>
        <Activity className="h-5 w-5 text-cyan-700" />
      </div>
      {rows.length ? (
        <div className="space-y-4">
          {rows.map((row) => (
            <button
              type="button"
              key={row.label}
              onClick={() => onSelect?.(row.label)}
              className="w-full text-left"
            >
              <span className="mb-1.5 flex justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-slate-700">{row.label}</span>
                <span className="shrink-0 font-bold text-slate-900">{row.count}</span>
              </span>
              <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                <span className={`block h-full rounded-full ${color}`} style={{ width: `${percent(row.count, max)}%` }} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No ticket data available yet.</p>
      )}
    </section>
  );
}

export default function PdmOperationsDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workbenchView, setWorkbenchView] = useState("list");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [kanbanError, setKanbanError] = useState("");
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkStatusValue, setBulkStatusValue] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [metrics, items, report] = await Promise.all([
        processEngineeringWorkspaceApi.dashboard(),
        processEngineeringWorkspaceApi.catalogue(),
        api.get("/process-engineering-workspace/analytics"),
      ]);
      setDashboard(metrics.data);
      setCatalogue(items.data.items || []);
      setAnalytics(report.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "PDM dashboard data could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tickets = analytics?.tickets || [];
  const activeTickets = useMemo(() => tickets.filter((ticket) => !isClosed(ticket)), [tickets]);
  const filtered = useMemo(() => tickets.filter((ticket) => {
    const searchText = [
      ticket.ticket_ref, ticket.title, ticket.category, ticket.sub_category,
      ticket.item_category, ticket.requester_name, ticket.requester_department,
      ticket.assignee_name, ticket.support_group_name,
    ].join(" ").toLowerCase();
    return (!filters.search || searchText.includes(filters.search.toLowerCase()))
      && (!filters.status || ticket.status === filters.status)
      && (!filters.priority || ticket.priority === filters.priority)
      && (!filters.category || ticket.category === filters.category)
      && (!filters.assignee || ticket.assignee_name === filters.assignee)
      && (!filters.supportGroup || ticket.support_group_name === filters.supportGroup)
      && (!filters.origin || ticket.source === filters.origin)
      && (!filters.highCritical || ["High", "Critical"].includes(ticket.priority))
      && (!filters.overdue || Boolean(ticket.overdue))
      && (!filters.activeOnly || !isClosed(ticket))
      && (!filters.unassigned || !ticket.assigned_to_user_id);
  }), [tickets, filters]);

  const metrics = analytics?.wholePeriod || dashboard?.metrics || {};
  const priorityRows = useMemo(() => ["Critical", "High", "Medium", "Low"].map((label) => ({
    label,
    count: activeTickets.filter((ticket) => text(ticket.priority).toLowerCase() === label.toLowerCase()).length,
  })).filter((row) => row.count > 0), [activeTickets]);
  const categoryRows = useMemo(() => {
    const counts = activeTickets.reduce((result, ticket) => {
      const label = ticket.category || ticket.item_category || "Unclassified";
      result[label] = (result[label] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count).slice(0, 6);
  }, [activeTickets]);
  const statusRows = useMemo(() => {
    const counts = tickets.reduce((result, ticket) => {
      const label = ticket.status || "Unspecified";
      result[label] = (result[label] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count).slice(0, 5);
  }, [tickets]);
  const attentionTickets = useMemo(() => activeTickets
    .filter((ticket) => ticket.overdue || ["Critical", "High"].includes(ticket.priority))
    .sort((left, right) => Number(Boolean(right.overdue)) - Number(Boolean(left.overdue))
      || (right.priority === "Critical" ? 1 : 0) - (left.priority === "Critical" ? 1 : 0)
      || Number(right.age_days || 0) - Number(left.age_days || 0))
    .slice(0, 5), [activeTickets]);
  const categories = useMemo(() => [...new Set(tickets.map((ticket) => ticket.category).filter(Boolean))].sort(), [tickets]);
  const statuses = useMemo(() => [...new Set(tickets.map((ticket) => ticket.status).filter(Boolean))].sort(), [tickets]);
  const priorities = useMemo(() => [...new Set(tickets.map((ticket) => ticket.priority).filter(Boolean))].sort(), [tickets]);
  const assignees = useMemo(() => [...new Set(tickets.map((ticket) => ticket.assignee_name).filter(Boolean))].sort(), [tickets]);
  const supportGroups = useMemo(() => [...new Set(tickets.map((ticket) => ticket.support_group_name).filter(Boolean))].sort(), [tickets]);
  const origins = useMemo(() => [...new Set(tickets.map((ticket) => ticket.source).filter(Boolean))].sort(), [tickets]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const generatedAt = analytics?.generatedAt
    ? new Date(analytics.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  const selectQuickFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? "" : value }));
  };
  const openTicket = (ticketId) => window.location.assign(`/helpdesk/tickets/${ticketId}`);

  const handleKanbanMove = async (ticketId, status) => {
    setKanbanError("");
    try {
      const r = await processEngineeringWorkspaceApi.bulkStatus({ ticketIds: [Number(ticketId)], status });
      const result = (r.data?.results || [])[0];
      if (result && !result.ok) {
        setKanbanError(result.error || "The status change was rejected.");
        return;
      }
      await load();
    } catch (e) {
      setKanbanError(e.response?.data?.error || e.message || "The status change could not be applied.");
    }
  };

  const toggleSelected = (ticketId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  };

  const selectedList = [...selectedIds];
  const bulkGroups = useMemo(() => {
    const map = new Map();
    for (const ticket of tickets) {
      if (ticket.assigned_group_id) map.set(ticket.assigned_group_id, ticket.support_group_name || `Group ${ticket.assigned_group_id}`);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [tickets]);
  const bulkAssignees = useMemo(() => {
    const map = new Map();
    for (const ticket of tickets) {
      if (ticket.assigned_to_user_id) map.set(ticket.assigned_to_user_id, ticket.assignee_name || `User ${ticket.assigned_to_user_id}`);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [tickets]);

  const runBulk = async (action) => {
    setBulkBusy(true);
    setBulkError("");
    setBulkResult(null);
    try {
      const payload = action === "assign"
        ? { ticketIds: selectedList, groupId: bulkGroupId || null, assigneeUserId: bulkAssigneeId || null }
        : { ticketIds: selectedList, status: bulkStatusValue };
      const r = await (action === "assign"
        ? processEngineeringWorkspaceApi.bulkAssign(payload)
        : processEngineeringWorkspaceApi.bulkStatus(payload));
      setBulkResult(r.data || null);
      setSelectedIds(() => new Set());
      await load();
    } catch (e) {
      setBulkError(e.response?.data?.error || e.message || "The bulk operation could not be completed.");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <WorkspaceShell>
      <main className="h-full overflow-y-auto bg-[#f3f6fa] p-3 dark:bg-slate-950 sm:p-5 xl:p-8">
        <div className="mx-auto max-w-[1700px] space-y-5">
          <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#061525] via-[#0b2f48] to-[#075b6c] p-5 text-white shadow-xl shadow-cyan-950/10 sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-cyan-200">
                  <Factory className="h-4 w-4" /> Manufacturing intelligence
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] tracking-wide text-emerald-200">Live workspace</span>
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">PDM Operations Command</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
                  A production-first view of manufacturing support: surface urgent line issues, identify queue pressure, and move work to the right owner.
                </p>
                <p className="mt-3 text-xs text-cyan-100/70">PDM queue refreshed {generatedAt} · {metrics.total || 0} tickets in the reporting window</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => window.location.assign("/line-assistance")} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15">
                  <Zap className="mr-2 inline h-4 w-4 text-amber-300" />Line assistance
                </button>
                <button type="button" onClick={() => window.location.assign("/incidents/new?workspace=PDM")} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-300">
                  <Wrench className="mr-2 inline h-4 w-4" />Raise PDM ticket
                </button>
                <button type="button" onClick={load} disabled={busy} aria-label="Refresh PDM dashboard" className="rounded-xl border border-white/20 bg-white/10 p-2.5 hover:bg-white/15 disabled:opacity-50">
                  <RefreshCw className={`h-5 w-5 ${busy ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </header>

          {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Active incidents" value={metrics.active || 0} caption="Open PDM work" icon={Activity} tone="cyan" onClick={() => setFilters({ ...EMPTY_FILTERS, activeOnly: true })} />
            <MetricCard label="High / critical" value={metrics.highCritical || metrics.high_priority || 0} caption="Active production risk" icon={AlertTriangle} tone="red" onClick={() => setFilters({ ...EMPTY_FILTERS, highCritical: true })} />
            <MetricCard label="Overdue" value={metrics.overdue || 0} caption="Needs escalation" icon={Clock3} tone="amber" onClick={() => setFilters({ ...EMPTY_FILTERS, overdue: true })} />
            <MetricCard label="Unassigned" value={metrics.unassigned || 0} caption="Awaiting an owner" icon={Ticket} tone="slate" onClick={() => setFilters({ ...EMPTY_FILTERS, unassigned: true })} />
            <MetricCard label="Catalogue items" value={catalogue.length} caption="Governed issue paths" icon={CheckCircle2} tone="cyan" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.17em] text-cyan-700">Operational signal</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Where the queue is building</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{activeTickets.length} active tickets</span>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Distribution title="Active tickets by priority" rows={priorityRows} color="bg-gradient-to-r from-cyan-500 to-blue-700" onSelect={(priority) => selectQuickFilter("priority", priority)} />
                <Distribution title="Active load by category" rows={categoryRows} color="bg-gradient-to-r from-indigo-500 to-cyan-500" onSelect={(category) => selectQuickFilter("category", category)} />
              </div>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.17em] text-indigo-700">Work lifecycle</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Queue distribution</h2>
                </div>
                <ArrowUpRight className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="mt-5 space-y-3">
                {statusRows.map((row) => (
                  <button type="button" key={row.label} onClick={() => selectQuickFilter("status", row.label)} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-left hover:bg-indigo-50">
                    <span className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-cyan-600" /><span className="text-sm font-semibold text-slate-700">{row.label}</span></span>
                    <span className="font-black text-slate-950">{row.count}</span>
                  </button>
                ))}
                {!statusRows.length && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">Status metrics will appear when tickets arrive.</p>}
              </div>
              <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Current attention load</p>
                <p className="mt-2 text-2xl font-black">{attentionTickets.length}<span className="ml-2 text-sm font-medium text-slate-400">urgent / overdue</span></p>
              </div>
            </section>
          </section>

          <section className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.17em] text-amber-700">Needs attention</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Priority response list</h2>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="mt-4 space-y-2">
                {attentionTickets.map((ticket) => (
                  <button type="button" key={ticket.id} onClick={() => openTicket(ticket.id)} className="w-full rounded-2xl border border-slate-100 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-cyan-800">{ticket.ticket_ref}</p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900">{ticket.title}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{[ticket.category, ticket.requester_name, ticket.assignee_name || "Unassigned"].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${ticket.overdue ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                        {ticket.overdue ? "OVERDUE" : ticket.priority}
                      </span>
                    </div>
                  </button>
                ))}
                {!attentionTickets.length && <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />No high-priority or overdue active work.</div>}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.17em] text-cyan-700">Governed service catalogue</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Issue paths supervisors can raise</h2>
                </div>
              </div>
              <div className="mt-4">
                <CatalogueHierarchyTree
                  items={catalogue}
                  onSelectItem={(item) => selectQuickFilter("category", item.category || "Other")}
                  onSelectCategory={(category) => selectQuickFilter("category", category)}
                />
              </div>
            </section>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[.17em] text-cyan-700">Department queue</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">PDM ticket workbench</h2>
                <p className="mt-1 text-sm text-slate-500">Showing {filtered.length} of {tickets.length} authorized PDM tickets.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
                  <button type="button" onClick={() => setWorkbenchView("list")} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${workbenchView === "list" ? "border-slate-300 bg-white text-slate-900 shadow-sm" : "border-transparent text-slate-500"}`}>List</button>
                  <button type="button" onClick={() => setWorkbenchView("kanban")} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${workbenchView === "kanban" ? "border-slate-300 bg-white text-slate-900 shadow-sm" : "border-transparent text-slate-500"}`}>Kanban</button>
                </div>
                {activeFilterCount > 0 && <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><X className="mr-1 inline h-3.5 w-3.5" />Clear {activeFilterCount} filters</button>}
              </div>
            </div>
            <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search reference, issue, employee…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-cyan-500 focus:outline-none" /></label>
              <select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
              <select aria-label="Filter by priority" value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All priorities</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select>
              <select aria-label="Filter by category" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
              <select aria-label="Filter by assignee" value={filters.assignee} onChange={(event) => setFilters((current) => ({ ...current, assignee: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All assignees</option>{assignees.map((assignee) => <option key={assignee}>{assignee}</option>)}</select>
              <select aria-label="Filter by support group" value={filters.supportGroup} onChange={(event) => setFilters((current) => ({ ...current, supportGroup: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All support groups</option>{supportGroups.map((group) => <option key={group}>{group}</option>)}</select>
              <select aria-label="Filter by origin" value={filters.origin} onChange={(event) => setFilters((current) => ({ ...current, origin: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All origins</option>{origins.map((origin) => <option key={origin}>{origin}</option>)}</select>
            </div>
            {workbenchView === "list" && selectedList.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
                <span className="text-xs font-bold text-slate-700">{selectedList.length} selected</span>
                {selectedList.length > 100 && <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Bulk operations are limited to 100 tickets.</span>}
                <select aria-label="Bulk assign to group" value={bulkGroupId} onChange={(event) => { setBulkGroupId(event.target.value); setBulkAssigneeId(""); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <option value="">Assign to group…</option>
                  {bulkGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                {bulkGroupId && (
                  <select aria-label="Bulk assign agent" value={bulkAssigneeId} onChange={(event) => setBulkAssigneeId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                    <option value="">Agent (optional)</option>
                    {bulkAssignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
                  </select>
                )}
                <button type="button" disabled={bulkBusy || selectedList.length > 100 || !bulkGroupId} onClick={() => runBulk("assign")} className="rounded-xl bg-cyan-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Assign</button>
                <select aria-label="Bulk set status" value={bulkStatusValue} onChange={(event) => setBulkStatusValue(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <option value="">Set status…</option>
                  {["Open", "In Progress", "Resolved", "Closed"].map((status) => <option key={status}>{status}</option>)}
                </select>
                <button type="button" disabled={bulkBusy || selectedList.length > 100 || !bulkStatusValue} onClick={() => runBulk("status")} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Apply status</button>
                <button type="button" onClick={() => setSelectedIds(() => new Set())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Clear selection</button>
              </div>
            )}
            {bulkResult && (
              <div className="border-b border-slate-100 p-4 text-xs">
                <p className="font-bold text-slate-700">{bulkResult.updated || 0} of {(bulkResult.results || []).length} tickets updated.</p>
                {(bulkResult.results || []).filter((item) => !item.ok).map((item) => (
                  <p key={item.ticketId} className="mt-1 text-red-700">Ticket {item.ticketId}: {item.error}</p>
                ))}
              </div>
            )}
            {bulkError && <div className="border-b border-slate-100 p-4 text-sm text-red-700">{bulkError}</div>}
            {workbenchView === "list" ? (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="w-10 p-4" /><th className="p-4">Ticket</th><th>Classification</th><th>Status</th><th>Priority</th><th>Requester / owner</th><th>Age</th></tr></thead>
                <tbody>
                  {filtered.map((ticket) => (
                    <tr key={ticket.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="p-4"><input type="checkbox" aria-label={`Select ${ticket.ticket_ref}`} checked={selectedIds.has(ticket.id)} onChange={() => toggleSelected(ticket.id)} className="h-4 w-4 rounded border-slate-300" /></td>
                      <td className="p-4"><button type="button" onClick={() => openTicket(ticket.id)} className="font-black text-cyan-800 hover:underline">{ticket.ticket_ref}</button><p className="mt-1 max-w-sm truncate font-semibold text-slate-800">{ticket.title}</p></td>
                      <td className="text-slate-600">{[ticket.category, ticket.sub_category, ticket.item_category].filter(Boolean).join(" / ") || "Unclassified"}</td>
                      <td><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{ticket.status}</span></td>
                      <td><span className={`rounded-full px-2.5 py-1 text-xs font-black ${["Critical", "High"].includes(ticket.priority) ? "bg-red-50 text-red-700" : "bg-cyan-50 text-cyan-800"}`}>{ticket.priority}</span></td>
                      <td><p className="font-semibold text-slate-700">{ticket.requester_name || "Employee"}</p><p className="text-xs text-slate-500">{ticket.assignee_name || "Unassigned"}</p></td>
                      <td className="text-slate-600">{ticket.age_days ?? 0}d</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan="7" className="p-12 text-center text-sm text-slate-500"><Filter className="mx-auto mb-2 h-5 w-5" />No tickets match the selected filters.</td></tr>}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="p-5"><PdmKanbanBoard tickets={filtered} onMove={handleKanbanMove} moveError={kanbanError} /></div>
            )}
          </section>

          <PdmCompletionPanel tickets={tickets} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            <span>Ticket assignment, status, and SLAs remain governed by the shared helpdesk workflow.</span>
            <span>{busy ? "Refreshing…" : `${tickets.length} ticket records loaded`}</span>
          </div>
        </div>
      </main>
    </WorkspaceShell>
  );
}
