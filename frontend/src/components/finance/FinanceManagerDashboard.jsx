import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  FileCheck,
  FileWarning,
  Gauge,
  Loader2,
  Package,
  ShieldAlert,
  Target,
  TrendingDown,
  Users,
  XCircle,
} from "lucide-react";
import { financeWorkspaceApi } from "../../services/api";
import SummaryMetricGrid from "./shared/SummaryMetricGrid";
import DashboardViewSwitcher from "./DashboardViewSwitcher";
import { formatFinanceDate } from "../../utils/financeShared";

const readViewFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "ticket-driven" ? "ticket-driven" : "management";
};

const card = "rounded-xl border border-slate-200 bg-white p-4";
const sectionTitle = "text-sm font-bold text-slate-800";
const muted = "text-xs text-slate-500";

function escalationTone(level) {
  return level === "critical"
    ? "border-red-300 bg-red-50 text-red-800"
    : level === "high"
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : "border-slate-200 bg-slate-50 text-slate-700";
}

function OverdueByEmployeePanel({ data }) {
  if (!data?.length) return <div className={card}><p className={sectionTitle}>Overdue by Employee</p><p className={muted}>No overdue items.</p></div>;
  return (
    <div className={card}>
      <p className={sectionTitle}>Overdue by Employee ({data.length})</p>
      <div className="mt-3 space-y-3">
        {data.map((emp) => (
          <div key={emp.userId} className="rounded-lg border border-slate-100 p-3">
            <p className="font-semibold text-slate-800">{emp.name} — {emp.items.length} overdue</p>
            <div className="mt-2 space-y-1">
              {emp.items.map((item) => (
                <div key={item.workItemId} className={`flex items-center justify-between rounded px-2 py-1 text-xs ${escalationTone(item.escalationLevel)}`}>
                  <span className="font-medium">{item.reference}</span>
                  <span>{item.ageDays}d overdue</span>
                  <span>{item.priority}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewQueuesPanel({ data }) {
  const awaiting = data?.awaitingReview || [];
  const overdue = data?.reviewOverdue || [];
  return (
    <div className={card}>
      <p className={sectionTitle}>Review Queues</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Awaiting Review ({awaiting.length})</p>
          <div className="mt-2 space-y-1">
            {awaiting.slice(0, 10).map((item) => (
              <div key={item.workitemid} className="flex items-center justify-between rounded px-2 py-1 text-xs border border-slate-100">
                <span className="font-medium">{item.reference}</span>
                <span className="text-slate-500">{item.agingdays}d waiting</span>
              </div>
            ))}
            {!awaiting.length && <p className={muted}>No items awaiting review.</p>}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-red-500">Review Overdue ({overdue.length})</p>
          <div className="mt-2 space-y-1">
            {overdue.slice(0, 10).map((item) => (
              <div key={item.workitemid} className="flex items-center justify-between rounded px-2 py-1 text-xs border border-red-200 bg-red-50 text-red-800">
                <span className="font-medium">{item.reference}</span>
                <span>{item.agepastdeadlinedays}d past deadline</span>
              </div>
            ))}
            {!overdue.length && <p className={muted}>No reviews overdue.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceQueuePanel({ data }) {
  const required = data?.required || [];
  const submitted = data?.submitted || [];
  const returned = data?.returned || [];
  return (
    <div className={card}>
      <p className={sectionTitle}>Evidence Queue</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs font-bold uppercase text-amber-500">Required ({required.length})</p>{required.slice(0, 5).map((x) => <div key={x.workItemId} className="mt-1 text-xs text-slate-600">{x.title}</div>)}</div>
        <div><p className="text-xs font-bold uppercase text-green-500">Submitted ({submitted.length})</p>{submitted.slice(0, 5).map((x) => <div key={x.workItemId} className="mt-1 text-xs text-slate-600">{x.title}</div>)}</div>
        <div><p className="text-xs font-bold uppercase text-red-500">Returned ({returned.length})</p>{returned.slice(0, 5).map((x) => <div key={x.workItemId} className="mt-1 text-xs text-slate-600">{x.title}</div>)}</div>
      </div>
    </div>
  );
}

function ExtensionsPanel({ data }) {
  const pending = data?.pendingExtensions || [];
  const approved = data?.approvedExtensions || [];
  return (
    <div className={card}>
      <p className={sectionTitle}>Extensions & Dependencies</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-amber-500">Pending ({pending.length})</p>
          {pending.slice(0, 8).map((x) => (
            <div key={x.id} className="mt-1 rounded border border-amber-100 bg-amber-50 px-2 py-1 text-xs">
              <span className="font-medium">{x.reference || x.work_item_id}</span> — {x.reason}
            </div>
          ))}
          {!pending.length && <p className={muted}>No pending extensions.</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-green-500">Approved ({approved.length})</p>
          {approved.slice(0, 8).map((x) => (
            <div key={x.id} className="mt-1 rounded border border-green-100 bg-green-50 px-2 py-1 text-xs">
              <span className="font-medium">{x.reference || x.work_item_id}</span> — until {formatFinanceDate(x.approved_due_at)}
            </div>
          ))}
          {!approved.length && <p className={muted}>No approved extensions.</p>}
        </div>
      </div>
    </div>
  );
}

function QualitySummaryPanel({ data }) {
  const perEmp = data?.perEmployee || [];
  const perObj = data?.perObjective || [];
  return (
    <div className={card}>
      <p className={sectionTitle}>Quality Summary</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Per Employee</p>
          {perEmp.map((x) => (
            <div key={x.userId} className="mt-1 flex items-center justify-between text-xs">
              <span>{x.name}</span>
              <span className="font-bold">{Number(x.averageQuality).toFixed(1)}</span>
            </div>
          ))}
          {!perEmp.length && <p className={muted}>No quality data.</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Per Objective</p>
          {perObj.map((x) => (
            <div key={x.objectiveName} className="mt-1 flex items-center justify-between text-xs">
              <span>{x.objectiveName}</span>
              <span className="font-bold">{Number(x.averageQuality).toFixed(1)}</span>
            </div>
          ))}
          {!perObj.length && <p className={muted}>No objective data.</p>}
        </div>
      </div>
    </div>
  );
}

function TimelinessSummaryPanel({ data }) {
  const perEmp = data?.perEmployee || [];
  const perObj = data?.perObjective || [];
  return (
    <div className={card}>
      <p className={sectionTitle}>Timeliness Summary</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Per Employee</p>
          {perEmp.map((x) => (
            <div key={x.userId} className="mt-1 flex items-center justify-between text-xs">
              <span>{x.name}</span>
              <span className="font-bold">{Number(x.timelinessPercent).toFixed(1)}%</span>
            </div>
          ))}
          {!perEmp.length && <p className={muted}>No timeliness data.</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Per Objective</p>
          {perObj.map((x) => (
            <div key={x.objectiveName} className="mt-1 flex items-center justify-between text-xs">
              <span>{x.objectiveName}</span>
              <span className="font-bold">{Number(x.averageTimeliness).toFixed(1)}%</span>
            </div>
          ))}
          {!perObj.length && <p className={muted}>No objective data.</p>}
        </div>
      </div>
    </div>
  );
}

function KpiRiskPanel({ data, onDrillDown }) {
  const emp = data?.atRiskEmployees || [];
  const port = data?.atRiskPortfolios || [];
  return (
    <div className={card}>
      <p className="flex items-center gap-2 text-sm font-bold text-red-700"><ShieldAlert className="h-4 w-4" /> KPI Risk Indicators</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-red-500">At-Risk Employees ({emp.length})</p>
          {emp.map((x) => (
            <button key={x.userId} onClick={() => onDrillDown?.(x.userId)} className="mt-1 flex w-full items-center justify-between rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100">
              <span className="font-medium">{x.name}</span>
              <span>{Number(x.projectedScore).toFixed(1)} / {x.targetScore} (âˆ’{Number(x.shortfall).toFixed(1)})</span>
            </button>
          ))}
          {!emp.length && <p className={muted}>No at-risk employees.</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-red-500">At-Risk Portfolios ({port.length})</p>
          {port.map((x) => (
            <div key={x.portfolio} className="mt-1 flex items-center justify-between rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
              <span className="font-medium">{x.portfolio}</span>
              <span>{Number(x.projectedScore).toFixed(1)} / {x.targetScore}</span>
            </div>
          ))}
          {!port.length && <p className={muted}>No at-risk portfolios.</p>}
        </div>
      </div>
    </div>
  );
}

function ActivityFeedPanel({ entries }) {
  const items = entries || [];
  return (
    <div className={card}>
      <p className={sectionTitle}>Team Activity Feed</p>
      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {items.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
            <span className="font-medium text-slate-700">{entry.actorname || "System"}</span>
            <span className="text-slate-500">{entry.action_type}</span>
            {entry.work_item_reference && <span className="font-mono text-slate-400">{entry.work_item_reference}</span>}
            <span className="ml-auto text-slate-400">{new Date(entry.action_timestamp || entry.created_at).toLocaleDateString()}</span>
          </div>
        ))}
        {!items.length && <p className={muted}>No recent activity.</p>}
      </div>
    </div>
  );
}

function StaffWorkloadPanel({ staff }) {
  const items = staff || [];
  const maxWork = Math.max(1, ...items.map((x) => Number(x.open_work || 0)));
  return (
    <div className={card}>
      <p className={sectionTitle}>Team Workload Overview</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((emp) => (
          <div key={emp.id} className={`rounded-lg border p-3 ${emp.kpiRiskFlag ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50"}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800">{emp.name}</p>
              {emp.kpiRiskFlag && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            </div>
            <p className={muted}>{emp.finance_function || emp.job_title || ""}</p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="font-bold text-slate-700">{emp.open_work} open</span>
              <span className="font-bold text-red-600">{emp.overdue_work} overdue</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${Math.min(100, (Number(emp.open_work || 0) / maxWork) * 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span>Duty: {Number(emp.duty_progress || 0).toFixed(0)}%</span>
              <span>KPI: {Number(emp.kpi_progress || 0).toFixed(0)}%</span>
              {emp.projectedScore != null && <span className={emp.kpiRiskFlag ? "font-bold text-red-600" : ""}>Proj: {Number(emp.projectedScore).toFixed(0)}</span>}
            </div>
          </div>
        ))}
        {!items.length && <p className={muted}>No team members configured.</p>}
      </div>
    </div>
  );
}

function ActionShortcutsPanel({ onAction }) {
  const actions = [
    { key: "recalculate-kpi", label: "Recalculate KPI Scores", Icon: Gauge },
    { key: "review-overdue", label: "Review Overdue Items", Icon: AlertTriangle },
    { key: "evidence-review", label: "Review Evidence", Icon: FileCheck },
    { key: "extensions", label: "Pending Extensions", Icon: Clock },
  ];
  return (
    <div className={card}>
      <p className={sectionTitle}>Action Shortcuts</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => onAction?.(key)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50">
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FinanceManagerDashboard({ period: propPeriod, onOpenTicket }) {
  const [period, setPeriod] = useState(propPeriod || new Date().toISOString().slice(0, 7));
  const [view, setView] = useState(readViewFromUrl);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleViewChange = (nextView) => {
    setView(nextView);
    const params = new URLSearchParams(window.location.search);
    params.set("view", nextView);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const r = await financeWorkspaceApi.peoplePerformanceDashboard(period);
        if (!cancelled) setData(r.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [period]);

  const handleAction = async (key) => {
    if (key === "recalculate-kpi") {
      try {
        await financeWorkspaceApi.recalculateKpiScores();
        const r = await financeWorkspaceApi.peoplePerformanceDashboard(period);
        setData(r.data);
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      }
    }
  };

  const handleKpiRiskDrillDown = async (employeeId) => {
    try {
      const r = await financeWorkspaceApi.kpiRiskContributingItems(employeeId, period);
      const items = r.data?.items || [];
      const summary = items.map((x) => `${x.reference || x.work_item_id}: ${Number(x.item_score).toFixed(0)} (gap ${Number(x.gapToTarget).toFixed(0)})`).join("\n");
      alert(`KPI Risk for employee ${employeeId}\nProjected: ${Number(r.data?.projectedScore || 0).toFixed(1)} / ${r.data?.targetScore}\n\nContributing items:\n${summary}`);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading manager dashboard...</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><p className="font-bold">{error}</p></div>;
  if (!data) return null;

  const summaryMetrics = [
    { label: "Active Staff", value: data.summary?.active_staff || 0, Icon: Users },
    { label: "Total Overdue", value: data.summary?.totalOverdue || 0, Icon: AlertTriangle, tone: "border-red-200 bg-red-50" },
    { label: "Awaiting Review", value: data.summary?.totalAwaitingReview || 0, Icon: FileCheck },
    { label: "Review Overdue", value: data.summary?.totalReviewOverdue || 0, Icon: XCircle, tone: "border-red-200 bg-red-50" },
    { label: "Evidence Required", value: data.summary?.totalEvidenceRequired || 0, Icon: FileWarning, tone: "border-amber-200 bg-amber-50" },
    { label: "Pending Extensions", value: data.summary?.totalPendingExtensions || 0, Icon: Clock },
    { label: "Missing Manager", value: data.summary?.missing_manager || 0, Icon: AlertTriangle },
    { label: "Missing Backup", value: data.summary?.missing_backup || 0, Icon: AlertTriangle },
    { label: "Close Progress", value: `${Number(data.summary?.closeProgress || 0).toFixed(0)}%`, Icon: Target },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Finance Manager Dashboard</h2>
        <div className="flex items-center gap-2">
          <DashboardViewSwitcher view={view} onViewChange={handleViewChange} />
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
      </div>

      {(data._errors || data.kpiLinkAvailable === false) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-bold">Some dashboard data could not be fully aggregated. Figures may be incomplete.</p>
          <ul className="mt-1 list-inside list-disc">
            {(data._errors || []).map((e, i) => <li key={i}>{e.group}: {e.error}</li>)}
            {data.kpiLinkAvailable === false && <li>Finance KPI links are unavailable until the database migration is applied; ticket reporting remains available.</li>}
          </ul>
        </div>
      )}

      <SummaryMetricGrid metrics={summaryMetrics} columns={9} />

      {view === "management" ? (
        <>
          <StaffWorkloadPanel staff={data.staff} />

          <div className="grid gap-4 lg:grid-cols-2">
            <QualitySummaryPanel data={data.qualitySummary} />
            <TimelinessSummaryPanel data={data.timelinessSummary} />
          </div>

          <KpiRiskPanel data={data.kpiRisk} onDrillDown={handleKpiRiskDrillDown} />

          <ActionShortcutsPanel onAction={handleAction} />

          <ActivityFeedPanel entries={data.activityFeedPreview} />
        </>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <OverdueByEmployeePanel data={data.overdueByEmployee} />
            <ReviewQueuesPanel data={data.reviewQueues} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <EvidenceQueuePanel data={data.evidenceQueue} />
            <ExtensionsPanel data={data.extensionsWithChains} />
          </div>
        </>
      )}
    </div>
  );
}