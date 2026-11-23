import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  RefreshCw,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Send,
  Ticket,
} from "lucide-react";
import { groupsApi, itDashboardApi, ticketsApi } from "../services/api";
import { useItDashboardMetrics } from "../hooks/useItDashboardMetrics";
import { useItDashboardSocket } from "../hooks/useItDashboardSocket";
import TimeRangeSelector from "../components/dashboard/TimeRangeSelector";
import CompanyAnnouncements from "../components/dashboard/CompanyAnnouncements";

const card = "rounded-xl border border-slate-200 bg-white p-4";

// --- Helpers ---
function formatResolution(hours) {
  if (hours == null || isNaN(hours)) return "N/A";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function getInitials(name = "") {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function agentBarColor(count) {
  if (count >= 10) return "bg-red-500";
  if (count >= 5) return "bg-amber-400";
  return "bg-green-500";
}

const STATUS_BADGE = {
  Open: "bg-blue-100 text-blue-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-slate-100 text-slate-600",
  Breached: "bg-red-100 text-red-700",
};

const PRIORITY_CONFIG = {
  Critical: { color: "bg-red-500", label: "Critical" },
  High: { color: "bg-orange-400", label: "High" },
  Medium: { color: "bg-amber-400", label: "Medium" },
  Low: { color: "bg-green-400", label: "Low" },
};

export default function ItDashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState("7d");
  const [filters, setFilters] = useState({ priority: "", status: "", agentId: "", category: "" });
  const [queueFilters, setQueueFilters] = useState({ priority: "", status: "", agentId: "" });
  const [taskQueue, setTaskQueue] = useState([]);
  const [taskQueueTotal, setTaskQueueTotal] = useState(0);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [supportGroups, setSupportGroups] = useState([]);
  const [groupsError, setGroupsError] = useState("");
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [assigningTicketId, setAssigningTicketId] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const { metrics, agentWorkload, trends, loading, error, refetch } = useItDashboardMetrics(range, filters);

  const loadTaskQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError("");
    try {
      const response = await itDashboardApi.getTaskQueue(
        Object.fromEntries(Object.entries(queueFilters).filter(([, value]) => value))
      );
      setTaskQueue(response.data.tickets || []);
      setTaskQueueTotal(response.data.total || 0);
    } catch (e) {
      setQueueError(e.response?.data?.error || e.message || "The IT work queue could not be loaded.");
    } finally {
      setQueueLoading(false);
    }
  }, [queueFilters]);

  const refreshAll = useCallback(() => {
    refetch();
    loadTaskQueue();
    setLastRefreshed(new Date());
  }, [loadTaskQueue, refetch]);

  const { isLive, isPolling } = useItDashboardSocket(refreshAll);

  useEffect(() => {
    loadTaskQueue();
  }, [loadTaskQueue]);

  useEffect(() => {
    let active = true;
    groupsApi.getAll()
      .then((response) => {
        if (active) setSupportGroups(Array.isArray(response.data) ? response.data : []);
      })
      .catch((e) => {
        if (active) setGroupsError(e.response?.data?.error || e.message || "Support groups could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Update lastRefreshed whenever refetch fires externally (socket)
  useEffect(() => {
    if (!loading) setLastRefreshed(new Date());
  }, [loading]);

  const handleDrilldown = async (metric) => {
    try {
      const params = { metric, range, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const r = await itDashboardApi.getDrilldown(params);
      setDrilldown({ metric, tickets: r.data.tickets || [] });
    } catch (e) {
      // ignore
    }
  };

  const handleManualRefresh = refreshAll;

  const handleAssignTicket = useCallback(async (ticket) => {
    const draft = assignmentDrafts[ticket.id] || {
      groupId: ticket.assigned_group_id ? String(ticket.assigned_group_id) : "",
      assigneeId: ticket.assigned_to_user_id ? String(ticket.assigned_to_user_id) : "",
    };
    const groupId = draft.groupId ? Number(draft.groupId) : null;
    const assigneeId = draft.assigneeId ? Number(draft.assigneeId) : null;
    if (!groupId && !assigneeId) {
      setAssignmentError("Select a support group or agent before saving an assignment.");
      return;
    }

    setAssigningTicketId(ticket.id);
    setAssignmentError("");
    try {
      await ticketsApi.assign(ticket.id, assigneeId, groupId);
      setAssignmentDrafts((current) => {
        const next = { ...current };
        delete next[ticket.id];
        return next;
      });
      await loadTaskQueue();
    } catch (e) {
      setAssignmentError(e.response?.data?.error || e.message || "Ticket assignment failed.");
    } finally {
      setAssigningTicketId(null);
    }
  }, [assignmentDrafts, loadTaskQueue]);

  // Category options for filter dropdown
  const categoryOptions = useMemo(() => {
    if (!metrics?.categoryBreakdown?.length) return [];
    return [...metrics.categoryBreakdown].sort((a, b) => b.count - a.count).map((c) => c.category);
  }, [metrics]);

  const activeSupportGroups = useMemo(
    () => supportGroups.filter((group) => group.is_active !== false),
    [supportGroups],
  );
  const availableQueueAgents = useMemo(() => {
    const agents = new Map();
    activeSupportGroups.forEach((group) => {
      (group.members || []).forEach((agent) => agents.set(String(agent.id), agent));
    });
    return [...agents.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeSupportGroups]);
  const queueStatuses = useMemo(
    () => [...new Set([...taskQueue.map((ticket) => ticket.status), queueFilters.status].filter(Boolean))].sort(),
    [taskQueue, queueFilters.status],
  );

  // ---- Metric cards ----
  const metricCards = [
    {
      label: "Open Tickets",
      value: metrics?.ticketVolume?.open || 0,
      Icon: BarChart3,
      metric: "open",
      iconClass: "text-blue-600 bg-blue-50",
      trend: metrics?.trends?.open,
    },
    {
      label: "In Progress",
      value: metrics?.ticketVolume?.inProgress || 0,
      Icon: Clock,
      metric: "in_progress",
      iconClass: "text-amber-600 bg-amber-50",
      trend: metrics?.trends?.inProgress,
    },
    {
      label: "SLA Compliance",
      value: `${metrics?.slaCompliance || 0}%`,
      Icon: CheckCircle2,
      metric: null,
      iconClass: "text-green-600 bg-green-50",
      trend: metrics?.trends?.slaCompliance,
    },
    {
      label: "SLA At Risk",
      value: metrics?.slaAtRisk || 0,
      Icon: AlertTriangle,
      metric: "sla_at_risk",
      iconClass: "text-orange-600 bg-orange-50",
      trend: metrics?.trends?.slaAtRisk,
    },
    {
      label: "SLA Breached",
      value: metrics?.slaBreached || 0,
      Icon: TrendingDown,
      metric: "sla_breached",
      iconClass: "text-red-600 bg-red-50",
      trend: metrics?.trends?.slaBreached,
    },
    {
      label: "Reopen Rate",
      value: `${metrics?.reopenRate || 0}%`,
      Icon: RefreshCw,
      metric: null,
      iconClass: "text-purple-600 bg-purple-50",
      trend: metrics?.trends?.reopenRate,
    },
    {
      label: "Avg Resolution",
      value: formatResolution(metrics?.avgResolutionHours),
      Icon: Timer,
      metric: null,
      iconClass: "text-sky-600 bg-sky-50",
      trend: null,
    },
  ];

  // ---- Priority Distribution ----
  const priorityEntries = useMemo(() => {
    const dist = metrics?.priorityDistribution || {};
    const total = Object.values(dist).reduce((s, v) => s + v, 0) || 1;
    const order = ["Critical", "High", "Medium", "Low"];
    return order
      .filter((p) => dist[p] != null)
      .map((p) => ({ priority: p, count: dist[p], pct: Math.round((dist[p] / total) * 100) }));
  }, [metrics]);

  // ---- Category Breakdown ----
  const topCategories = useMemo(() => {
    if (!metrics?.categoryBreakdown?.length) return [];
    const sorted = [...metrics.categoryBreakdown].sort((a, b) => b.count - a.count);
    return sorted.slice(0, 5);
  }, [metrics]);
  const catTotal = useMemo(() => topCategories.reduce((s, c) => s + c.count, 0) || 1, [topCategories]);

  // ---- Agent Workload ----
  const sortedAgents = useMemo(
    () => [...agentWorkload].sort((a, b) => b.openTicketCount - a.openTicketCount),
    [agentWorkload],
  );

  // ---- Trends (last 7 rows) ----
  const recentTrends = useMemo(() => trends.slice(-7), [trends]);
  const maxVolume = useMemo(() => Math.max(...recentTrends.map((t) => t.volume), 1), [recentTrends]);

  // ---- Last refreshed label ----
  const refreshedLabel = lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (loading) return <div className="flex items-center gap-2 p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading IT Dashboard...</div>;
  if (error) return <div className="space-y-4 p-4 sm:p-6"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div><CompanyAnnouncements /></div>;
  if (!metrics) return <div className="p-4 sm:p-6"><CompanyAnnouncements /></div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-3 sm:p-5 lg:p-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">IT Dashboard</h1>
            {isLive && (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                Live
              </span>
            )}
            {isPolling && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Reconnecting…
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Real-time IT operations intelligence &nbsp;·&nbsp; Refreshed at {refreshedLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Category filter */}
          {categoryOptions.length > 0 && (
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {/* Priority filter */}
          <select
            value={filters.priority}
            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All Priorities</option>
            {["Critical", "High", "Medium", "Low"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <TimeRangeSelector value={range} onChange={setRange} />
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate("/incidents/new?workspace=IT")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-800"
          >
            <Ticket className="h-3.5 w-3.5" />
            New IT ticket
          </button>
          <button
            type="button"
            onClick={() => navigate("/error-logger")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Error monitor
          </button>
          <button
            type="button"
            onClick={() => navigate("/company-communications")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-900 hover:bg-blue-100"
          >
            <Send className="h-3.5 w-3.5" />
            Communications
          </button>
        </div>
      </div>

      <CompanyAnnouncements />

      {/* ===== PRIORITIZED IT WORK QUEUE ===== */}
      <section className={card}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Prioritized IT Work Queue</h2>
            <p className="mt-1 text-xs text-slate-500">
              {taskQueueTotal} active tickets · showing up to 100, ordered by overdue/SLA risk, priority, and age.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter work queue by priority"
              value={queueFilters.priority}
              onChange={(event) => setQueueFilters((current) => ({ ...current, priority: event.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All priorities</option>
              {["Critical", "High", "Medium", "Low"].map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
            <select
              aria-label="Filter work queue by status"
              value={queueFilters.status}
              onChange={(event) => setQueueFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All active statuses</option>
              {queueStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select
              aria-label="Filter work queue by assignee"
              value={queueFilters.agentId}
              onChange={(event) => setQueueFilters((current) => ({ ...current, agentId: event.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {availableQueueAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
        </div>

        {queueError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{queueError}</p>}
        {groupsError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{groupsError} Assignment options may be unavailable.</p>}
        {assignmentError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{assignmentError}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="p-2">Ticket</th>
                <th className="p-2">Priority</th>
                <th className="p-2">Status / SLA</th>
                <th className="p-2">Support group</th>
                <th className="p-2">Assigned agent</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {taskQueue.map((ticket) => {
                const draft = assignmentDrafts[ticket.id] || {
                  groupId: ticket.assigned_group_id ? String(ticket.assigned_group_id) : "",
                  assigneeId: ticket.assigned_to_user_id ? String(ticket.assigned_to_user_id) : "",
                };
                const selectedGroup = activeSupportGroups.find((group) => String(group.id) === draft.groupId);
                const groupMembers = selectedGroup?.members || [];
                const hasCurrentGroup = ticket.assigned_group_id
                  && activeSupportGroups.some((group) => String(group.id) === String(ticket.assigned_group_id));
                const hasCurrentAssignee = groupMembers.some((agent) => String(agent.id) === draft.assigneeId);
                const assignmentChanged = draft.groupId !== String(ticket.assigned_group_id || "")
                  || draft.assigneeId !== String(ticket.assigned_to_user_id || "");
                const canSaveAssignment = (draft.groupId || draft.assigneeId)
                  && assignmentChanged
                  && (!draft.groupId || selectedGroup);
                const priority = PRIORITY_CONFIG[ticket.priority] || { color: "bg-slate-400", label: ticket.priority || "Unknown" };
                const slaLabel = ticket.is_overdue
                  ? "Overdue"
                  : ticket.is_sla_at_risk
                    ? "Due soon"
                    : ticket.due_at
                      ? `Due ${new Date(ticket.due_at).toLocaleDateString()}`
                      : "No due date";

                return (
                  <tr key={ticket.id} className="border-t border-slate-100 align-top">
                    <td className="max-w-sm p-2">
                      <button
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        className="font-mono text-xs font-bold text-sky-700 hover:underline"
                      >
                        {ticket.ticket_ref}
                      </button>
                      <p className="mt-1 truncate font-medium text-slate-800" title={ticket.title}>{ticket.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{ticket.category || "Uncategorized"}</p>
                    </td>
                    <td className="p-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${priority.color} text-white`}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`block font-medium ${ticket.is_overdue ? "text-red-700" : ticket.is_sla_at_risk ? "text-amber-700" : "text-slate-700"}`}>
                        {ticket.status}
                      </span>
                      <span className={`mt-1 block text-xs ${ticket.is_overdue ? "text-red-600" : ticket.is_sla_at_risk ? "text-amber-600" : "text-slate-500"}`}>
                        {slaLabel}
                      </span>
                    </td>
                    <td className="min-w-48 p-2">
                      <select
                        aria-label={`Support group for ${ticket.ticket_ref}`}
                        value={draft.groupId}
                        onChange={(event) => {
                          setAssignmentError("");
                          setAssignmentDrafts((current) => {
                            const existing = current[ticket.id] || {
                              groupId: ticket.assigned_group_id ? String(ticket.assigned_group_id) : "",
                              assigneeId: ticket.assigned_to_user_id ? String(ticket.assigned_to_user_id) : "",
                            };
                            return { ...current, [ticket.id]: { ...existing, groupId: event.target.value, assigneeId: "" } };
                          });
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="">Select group</option>
                        {ticket.assigned_group_id && !hasCurrentGroup && (
                          <option value={ticket.assigned_group_id} disabled>
                            {ticket.assigned_group_name || "Current group"} (inactive)
                          </option>
                        )}
                        {activeSupportGroups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="min-w-48 p-2">
                      <select
                        aria-label={`Agent for ${ticket.ticket_ref}`}
                        value={draft.assigneeId}
                        disabled={!draft.groupId}
                        onChange={(event) => {
                          setAssignmentError("");
                          setAssignmentDrafts((current) => {
                            const existing = current[ticket.id] || {
                              groupId: ticket.assigned_group_id ? String(ticket.assigned_group_id) : "",
                              assigneeId: ticket.assigned_to_user_id ? String(ticket.assigned_to_user_id) : "",
                            };
                            return { ...current, [ticket.id]: { ...existing, assigneeId: event.target.value } };
                          });
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100"
                      >
                        <option value="">Unassigned to agent</option>
                        {draft.assigneeId && !hasCurrentAssignee && (
                          <option value={draft.assigneeId} disabled>{ticket.assignee_name || "Current agent"}</option>
                        )}
                        {groupMembers.map((agent) => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => handleAssignTicket(ticket)}
                        disabled={!canSaveAssignment || assigningTicketId === ticket.id}
                        className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {assigningTicketId === ticket.id ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!queueLoading && !taskQueue.length && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-sm text-slate-500">
                    No active IT tickets match these filters.
                  </td>
                </tr>
              )}
              {queueLoading && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-sm text-slate-500">Refreshing work queue…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== METRIC CARDS ===== */}
      <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {metricCards.map(({ label, value, Icon, metric, iconClass, trend }) => {
          const trendUp = trend > 0;
          const trendDown = trend < 0;
          return (
            <button
              key={label}
              onClick={() => metric && handleDrilldown(metric)}
              className={`rounded-xl border border-slate-200 bg-white p-4 text-left transition-shadow ${metric ? "hover:border-sky-300 hover:shadow-md cursor-pointer" : "cursor-default"}`}
            >
              <div className={`inline-flex rounded-lg p-1.5 ${iconClass}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-900">{value}</span>
                {trend != null && (
                  <span className={`flex items-center text-xs font-semibold ${trendUp ? "text-red-500" : trendDown ? "text-green-600" : "text-slate-400"}`}>
                    {trendUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : trendDown ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                    {Math.abs(trend)}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            </button>
          );
        })}
      </div>

      {/* ===== PRIORITY + CATEGORIES ===== */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Priority Distribution */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800">Priority Distribution</h2>
          <div className="mt-3 space-y-3">
            {priorityEntries.length === 0 && (
              <p className="text-xs text-slate-500">No priority data.</p>
            )}
            {priorityEntries.map(({ priority, count, pct }) => {
              const cfg = PRIORITY_CONFIG[priority] || { color: "bg-slate-400" };
              return (
                <div key={priority}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{priority}</span>
                    <span className="text-xs text-slate-500">{count} &nbsp;·&nbsp; {pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${cfg.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Request Categories */}
        <div className={card}>
          <h2 className="text-sm font-bold text-slate-800">Top Request Categories</h2>
          <div className="mt-3 space-y-3">
            {topCategories.length === 0 && (
              <p className="text-xs text-slate-500">Category data not available.</p>
            )}
            {topCategories.map(({ category, count }) => {
              const pct = Math.round((count / catTotal) * 100);
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 truncate max-w-[65%]">{category}</span>
                    <span className="text-xs text-slate-500">{count} &nbsp;·&nbsp; {pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-sky-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== AGENT WORKLOAD ===== */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">Agent Workload</h2>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sortedAgents.map((agent) => {
            const barW = Math.min(100, (agent.openTicketCount / 15) * 100);
            const barColor = agentBarColor(agent.openTicketCount);
            return (
              <div
                key={agent.userId}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${agent.isOverloaded ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50"}`}
              >
                {/* Avatar */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${agent.isOverloaded ? "bg-red-200 text-red-800" : "bg-sky-100 text-sky-800"}`}>
                  {getInitials(agent.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium text-slate-800">{agent.name}</span>
                    <span className={`ml-2 shrink-0 text-xs font-semibold ${agent.isOverloaded ? "text-red-600" : "text-slate-500"}`}>
                      {agent.openTicketCount} open
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-1.5 rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {!sortedAgents.length && <p className="col-span-3 text-xs text-slate-500">No agent data.</p>}
        </div>
      </div>

      {/* ===== TRENDS TABLE ===== */}
      <div className={card}>
        <h2 className="text-sm font-bold text-slate-800">Ticket Trends (Last 7 Days)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Date</th>
                <th className="p-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Volume</th>
                <th className="p-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Resolved</th>
                <th className="p-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Breached</th>
                <th className="p-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Net</th>
              </tr>
            </thead>
            <tbody>
              {recentTrends.map((t) => {
                const volIntensity = Math.round((t.volume / maxVolume) * 100);
                const net = (t.volume || 0) - (t.resolved || 0);
                return (
                  <tr key={t.date} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-2 font-medium text-slate-700">{t.date}</td>
                    <td className={`p-2 font-bold ${volIntensity > 70 ? "text-red-600 bg-red-50 rounded" : "text-slate-800"}`}>
                      {t.volume}
                    </td>
                    <td className="p-2 font-semibold text-green-600">{t.resolved}</td>
                    <td className="p-2 font-semibold text-red-600">{t.breached}</td>
                    <td className={`p-2 font-semibold ${net > 0 ? "text-red-600" : net < 0 ? "text-green-600" : "text-slate-500"}`}>
                      {net > 0 ? `+${net}` : net}
                    </td>
                  </tr>
                );
              })}
              {!recentTrends.length && (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-500">No trend data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== DRILLDOWN PANEL ===== */}
      {drilldown && (
        <div className={card}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Activity className="h-4 w-4 text-sky-600" />
              Drill-down: <span className="capitalize text-sky-700">{drilldown.metric.replace(/_/g, " ")}</span>
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {drilldown.tickets.length}
              </span>
            </h2>
            <button onClick={() => setDrilldown(null)} className="text-sm text-slate-500 hover:text-slate-700">
              âœ• Close
            </button>
          </div>
          <div className="mt-3 space-y-1.5">
            {drilldown.tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/tickets/${t.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left text-sm hover:border-sky-200 hover:bg-sky-50 transition-colors"
              >
                {/* Ticket ref badge */}
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                  {t.ticket_ref}
                </span>
                {/* Title */}
                <span className="flex-1 truncate font-medium text-slate-800">
                  {(t.title || "").length > 60 ? `${t.title.slice(0, 60)}…` : t.title}
                </span>
                {/* Status badge */}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[t.status] || "bg-slate-100 text-slate-600"}`}>
                  {t.status}
                </span>
                {/* Assignee */}
                <span className="shrink-0 text-xs text-slate-500">{t.assignee_name || "Unassigned"}</span>
              </button>
            ))}
            {!drilldown.tickets.length && (
              <p className="text-sm text-slate-500">No tickets in this metric.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
