import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  Download,
  Factory,
  RefreshCw,
} from "lucide-react";
import { io } from "socket.io-client";

import ProductionChart from "../components/ProductionChart";
import ProductionForm from "../components/ProductionForm";
import {
  logsApi,
  notificationApi,
  productionApi,
  productionSyncApi,
} from "../services/api";

const API_ORIGIN =
  import.meta.env.MODE === "production"
    ? window.location.origin
    : "http://localhost:3001";

const SHIFTS = [
  {
    id: "morning",
    name: "Morning Shift",
    start: "06:00",
    end: "15:00",
    description: "06:00 - 15:00",
  },
  {
    id: "afternoon",
    name: "Afternoon Shift",
    start: "13:00",
    end: "22:00",
    description: "13:00 - 22:00",
  },
  {
    id: "night",
    name: "Night Shift",
    start: "21:00",
    end: "06:00",
    description: "21:00 - 06:00",
  },
];

const PARTS = [
  {
    id: "bedliners",
    name: "Bedliners",
    stations: ["Moulding", "Trimming", "Inspection", "Packing"],
  },
  {
    id: "tailgates",
    name: "Tailgates",
    stations: ["Assembly", "Inspection", "Packing"],
  },
  {
    id: "chassis_frames",
    name: "Chassis Frames",
    stations: ["Frame Assembly", "Welding", "Inspection"],
  },
  {
    id: "rear_step_bumpers",
    name: "Rear Step Bumpers",
    stations: ["Assembly", "Inspection", "Packing"],
  },
  {
    id: "side_steps",
    name: "Side Steps",
    stations: ["Assembly", "Inspection", "Packing"],
  },
];

function getCurrentShiftId(date = new Date()) {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();

  const morningStart = 6 * 60;
  const afternoonStart = 13 * 60;
  const nightStart = 21 * 60;

  if (totalMinutes >= nightStart || totalMinutes < morningStart) {
    return "night";
  }

  if (totalMinutes >= afternoonStart) {
    return "afternoon";
  }

  return "morning";
}

function normalizeShift(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "_");
}

function formatDate(value) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function ProductionDashboard() {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [bedlinerDaily, setBedlinerDaily] = useState([]);

  const [lastUpdated, setLastUpdated] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [selectedShift, setSelectedShift] = useState(getCurrentShiftId());
  const [activeView, setActiveView] = useState("overview");
  const [activeReport, setActiveReport] = useState("daily");

  const [productionEntry, setProductionEntry] = useState({
    partId: "",
    station: "",
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const activeShift = SHIFTS.find((shift) => shift.id === selectedShift);
  const selectedPart = PARTS.find((part) => part.id === productionEntry.partId);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [prod, logData, notifData, bedlinerData] = await Promise.all([
        productionApi.getAll(),
        logsApi.getAll(),
        notificationApi.getAll({ module: "production" }),
        productionSyncApi.getBedlinerDaily(),
      ]);

      setData(Array.isArray(prod.data) ? prod.data : []);
      setLogs(Array.isArray(logData.data) ? logData.data : []);
      setNotifications(Array.isArray(notifData.data) ? notifData.data : []);
      setBedlinerDaily(Array.isArray(bedlinerData.data) ? bedlinerData.data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch production dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const updateShift = () => {
      setSelectedShift(getCurrentShiftId());
    };

    updateShift();

    const interval = setInterval(updateShift, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = io(API_ORIGIN);

    socket.on("new-log", ({ notification }) => {
      fetchData();

      if (notification) {
        setNotifications((prev) => [
          {
            ...notification,
            id: notification.id ?? Date.now(),
            is_read: false,
          },
          ...prev.slice(0, 49),
        ]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (!item.shift) return true;
      return normalizeShift(item.shift) === selectedShift;
    });
  }, [data, selectedShift]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!log.shift) return true;
      return normalizeShift(log.shift) === selectedShift;
    });
  }, [logs, selectedShift]);

  const chartData = useMemo(
    () =>
      filteredData.map((d) => ({
        time: d.created_at
          ? new Date(d.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A",
        oee: Number(d.oee || 0),
        scrap: Number(d.scrap || 0),
      })),
    [filteredData]
  );

  const bedlinerChartData = useMemo(() => {
    return [...bedlinerDaily]
      .sort((a, b) => new Date(a.work_date) - new Date(b.work_date))
      .map((row) => ({
        time: formatDate(row.work_date),
        oee: Number(row.attainment_percent || 0),
        scrap:
          Number(row.total_assembly_rejects || 0) +
          Number(row.total_sequencing_rejects || 0),
      }));
  }, [bedlinerDaily]);

  const bedlinerTotals = useMemo(() => {
    return bedlinerDaily.reduce(
      (acc, row) => {
        acc.scheduled += Number(row.total_scheduled_sequences || 0);
        acc.actual += Number(row.total_assembly_production || 0);
        acc.assemblyRejects += Number(row.total_assembly_rejects || 0);
        acc.sequenceRejects += Number(row.total_sequencing_rejects || 0);
        acc.callOffs += Number(row.total_call_offs || 0);
        return acc;
      },
      {
        scheduled: 0,
        actual: 0,
        assemblyRejects: 0,
        sequenceRejects: 0,
        callOffs: 0,
      }
    );
  }, [bedlinerDaily]);

  const bedlinerAttainment =
    bedlinerTotals.scheduled > 0
      ? ((bedlinerTotals.actual / bedlinerTotals.scheduled) * 100).toFixed(1)
      : "0.0";

  const totalPlan = useMemo(() => {
    const legacyPlan = filteredData.reduce(
      (sum, d) => sum + Number(d.plan || 0),
      0
    );

    return bedlinerTotals.scheduled || legacyPlan;
  }, [filteredData, bedlinerTotals.scheduled]);

  const totalActual = useMemo(() => {
    const legacyActual = filteredData.reduce(
      (sum, d) => sum + Number(d.actual || 0),
      0
    );

    return bedlinerTotals.actual || legacyActual;
  }, [filteredData, bedlinerTotals.actual]);

  const totalScrap = useMemo(() => {
    const legacyScrap = filteredData.reduce(
      (sum, d) => sum + Number(d.scrap || 0),
      0
    );

    const mssqlScrap =
      bedlinerTotals.assemblyRejects + bedlinerTotals.sequenceRejects;

    return mssqlScrap || legacyScrap;
  }, [filteredData, bedlinerTotals]);

  const latestScrap =
    bedlinerDaily.length > 0
      ? Number(bedlinerDaily[0].total_assembly_rejects || 0) +
        Number(bedlinerDaily[0].total_sequencing_rejects || 0)
      : filteredData.length > 0
      ? Number(filteredData[0].scrap || 0)
      : 0;

  const achievement =
    totalPlan > 0 ? ((totalActual / totalPlan) * 100).toFixed(1) : "0.0";

  const avgOEE = useMemo(() => {
    if (bedlinerDaily.length > 0) {
      const rowsWithValues = bedlinerDaily.filter(
        (row) => Number(row.attainment_percent || 0) > 0
      );

      if (!rowsWithValues.length) return "0.00";

      const total = rowsWithValues.reduce(
        (sum, row) => sum + Number(row.attainment_percent || 0),
        0
      );

      return (total / rowsWithValues.length).toFixed(2);
    }

    if (!filteredData.length) return "0.00";

    const total = filteredData.reduce((sum, d) => sum + Number(d.oee || 0), 0);
    return (total / filteredData.length).toFixed(2);
  }, [bedlinerDaily, filteredData]);

  const productionByPart = useMemo(() => {
    return PARTS.map((part) => {
      if (part.id === "bedliners") {
        return {
          ...part,
          plan: bedlinerTotals.scheduled,
          actual: bedlinerTotals.actual,
          scrap: bedlinerTotals.assemblyRejects + bedlinerTotals.sequenceRejects,
          attainment: bedlinerAttainment,
        };
      }

      const partRows = filteredData.filter((row) => {
        const source =
          row.part_id ||
          row.part ||
          row.part_name ||
          row.part_number ||
          row.product ||
          "";

        return String(source).toLowerCase().includes(part.name.toLowerCase());
      });

      const plan = partRows.reduce((sum, row) => sum + Number(row.plan || 0), 0);
      const actual = partRows.reduce(
        (sum, row) => sum + Number(row.actual || 0),
        0
      );
      const scrap = partRows.reduce(
        (sum, row) => sum + Number(row.scrap || 0),
        0
      );

      return {
        ...part,
        plan,
        actual,
        scrap,
        attainment: plan > 0 ? ((actual / plan) * 100).toFixed(1) : "0.0",
      };
    });
  }, [filteredData, bedlinerTotals, bedlinerAttainment]);

  const alerts = useMemo(() => {
    const items = [];

    if (Number(avgOEE) > 0 && Number(avgOEE) < 75) {
      items.push({
        type: "critical",
        message: `Average attainment/OEE is below target at ${avgOEE}%.`,
      });
    }

    if (latestScrap > 10) {
      items.push({
        type: "warning",
        message: `Latest scrap/reject value is high: ${latestScrap}.`,
      });
    }

    if (bedlinerTotals.callOffs > 0 && bedlinerTotals.actual === 0) {
      items.push({
        type: "warning",
        message: `There are ${bedlinerTotals.callOffs} call-offs but no recorded Bedliner assembly production.`,
      });
    }

    if (filteredLogs.length === 0) {
      items.push({
        type: "info",
        message: "No logbook entries captured for the active shift yet.",
      });
    }

    if (items.length === 0) {
      items.push({
        type: "success",
        message: "No high-risk production alerts for the active shift.",
      });
    }

    return items;
  }, [avgOEE, latestScrap, filteredLogs.length, bedlinerTotals]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await notificationApi.clearAll();
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const handleSyncMssql = async () => {
    setSyncing(true);

    try {
      await productionSyncApi.syncBedlinerDaily();
      await fetchData();
    } catch (err) {
      console.error("Manual MSSQL sync failed:", err);
      alert("Failed to sync MSSQL Bedliner daily production data.");
    } finally {
      setSyncing(false);
    }
  };

  const exportToCSV = () => {
    if (!filteredLogs.length) {
      alert("No production logs to export");
      return;
    }

    const headers = ["Hour", "Problem", "NG Pieces", "Scrap Description"];

    const rows = filteredLogs.map((log) => [
      log.hour,
      log.problem,
      log.ng_pcs,
      log.scrap_desc,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((row) =>
          row
            .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
            .join(",")
        )
        .join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "production_logs.csv");

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Factory className="h-4 w-4" />
            Production Module / Supervisor View
          </div>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Production Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Overview of production output, scrap, OEE, logbook issues and shift
            performance.
          </p>

          <p className="mt-3 text-xs text-slate-500">
            Last updated:{" "}
            {lastUpdated
              ? lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "Never"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowNotifications((prev) => !prev)}
              className="relative inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              Supervisor Alerts

              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-950">
                    Supervisor Notifications
                  </h3>

                  <div className="flex gap-2">
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Mark read
                    </button>

                    <button
                      onClick={handleClearNotifications}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No notifications yet
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-xl border p-3 text-sm ${
                          n.is_read
                            ? "border-slate-200 bg-slate-50"
                            : n.type === "critical"
                            ? "border-red-300 bg-red-50"
                            : n.type === "warning"
                            ? "border-amber-300 bg-amber-50"
                            : "border-blue-200 bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {n.type === "critical" ? (
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                          ) : n.is_read ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-slate-500" />
                          ) : (
                            <Clock className="mt-0.5 h-4 w-4 text-blue-600" />
                          )}

                          <div>
                            <p className="font-semibold text-slate-800">
                              {n.message}
                            </p>

                            {n.created_at && (
                              <p className="mt-1 text-xs text-slate-500">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handleSyncMssql}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 disabled:opacity-60"
          >
            <Database className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync MSSQL"}
          </button>

          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              Current Active Shift
            </p>
            <h2 className="mt-1 text-2xl font-bold text-blue-950">
              {activeShift?.name || "Unknown Shift"}
            </h2>
            <p className="text-sm text-blue-700">
              {activeShift?.description || "Automatically detected from time"}
            </p>
          </div>

          <span className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            Auto-selected
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {SHIFTS.map((shift) => {
            const isActive = selectedShift === shift.id;

            return (
              <div
                key={shift.id}
                className={`rounded-2xl border p-4 shadow-sm ${
                  isActive
                    ? "border-blue-400 bg-white ring-4 ring-blue-100"
                    : "border-slate-200 bg-white/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-950">{shift.name}</p>

                  {isActive && (
                    <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-bold text-white">
                      Active
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {shift.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ModuleCard
          active={activeView === "logbook"}
          icon={ClipboardList}
          title="Logbook"
          description="Record hourly issues, scrap notes and production incidents."
          color="blue"
          onClick={() => setActiveView("logbook")}
        />

        <ModuleCard
          active={activeView === "production-entry"}
          icon={Factory}
          title="Production Entry"
          description="Capture output by part, station and active shift."
          color="green"
          onClick={() => setActiveView("production-entry")}
        />

        <ModuleCard
          active={activeView === "scrap"}
          icon={AlertTriangle}
          title="Scrap Tracking"
          description="Review scrap trends, reasons and recurring losses."
          color="red"
          onClick={() => setActiveView("scrap")}
        />

        <ModuleCard
          active={activeView === "reports"}
          icon={BarChart3}
          title="Reports"
          description="Daily, weekly and monthly production reporting."
          color="purple"
          onClick={() => setActiveView("reports")}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Scheduled Seq" value={bedlinerTotals.scheduled} tone="blue" />
        <KpiCard label="Assembly Prod" value={bedlinerTotals.actual} tone="green" />
        <KpiCard label="Call Offs" value={bedlinerTotals.callOffs} tone="purple" />
        <KpiCard
          label="Rejects"
          value={bedlinerTotals.assemblyRejects + bedlinerTotals.sequenceRejects}
          tone="red"
        />
        <KpiCard label="Attainment" value={`${bedlinerAttainment}%`} tone="emerald" />
      </div>

      {activeView === "overview" && (
        <OverviewSection
          alerts={alerts}
          chartData={bedlinerChartData.length ? bedlinerChartData : chartData}
          productionByPart={productionByPart}
          logs={filteredLogs}
          bedlinerDaily={bedlinerDaily}
        />
      )}

      {activeView === "logbook" && (
        <LogbookSection
          fetchData={fetchData}
          logs={filteredLogs}
          selectedShift={selectedShift}
          activeShift={activeShift}
        />
      )}

      {activeView === "production-entry" && (
        <ProductionEntrySection
          productionEntry={productionEntry}
          setProductionEntry={setProductionEntry}
          selectedPart={selectedPart}
          activeShift={activeShift}
        />
      )}

      {activeView === "scrap" && (
        <ScrapSection
          chartData={bedlinerChartData.length ? bedlinerChartData : chartData}
          logs={filteredLogs}
          latestScrap={latestScrap}
          totalScrap={totalScrap}
        />
      )}

      {activeView === "reports" && (
        <ReportsSection
          productionByPart={productionByPart}
          bedlinerDaily={bedlinerDaily}
          avgOEE={avgOEE}
          achievement={achievement}
          totalScrap={totalScrap}
          activeReport={activeReport}
          setActiveReport={setActiveReport}
        />
      )}
    </div>
  );
}

function ModuleCard({ icon: Icon, title, description, color, active, onClick }) {
  const colorClasses = {
    blue: "text-blue-600 hover:border-blue-300 hover:bg-blue-50",
    green: "text-green-600 hover:border-green-300 hover:bg-green-50",
    red: "text-red-600 hover:border-red-300 hover:bg-red-50",
    purple: "text-purple-600 hover:border-purple-300 hover:bg-purple-50",
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left shadow-sm transition ${
        active
          ? "border-blue-300 bg-blue-50 ring-4 ring-blue-100"
          : "border-slate-200 bg-white"
      } ${colorClasses[color]}`}
    >
      <Icon className="h-6 w-6" />
      <h3 className="mt-3 font-bold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </button>
  );
}

function KpiCard({ label, value, tone }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-green-200 bg-green-50 text-green-800",
    purple: "border-purple-200 bg-purple-50 text-purple-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-semibold">{label}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function OverviewSection({
  alerts,
  chartData,
  productionByPart,
  logs,
  bedlinerDaily,
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-slate-950">
            Bedliner Attainment and Reject Trend
          </h2>
          <ProductionChart data={chartData} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">High Alerts</h2>
          <p className="text-sm text-slate-500">
            Issues that need supervisor attention.
          </p>

          <div className="mt-4 space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={`${alert.message}-${index}`}
                className={`rounded-xl border p-3 text-sm font-semibold ${
                  alert.type === "critical"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : alert.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : alert.type === "success"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ProductionByPartTable productionByPart={productionByPart} />

      <BedlinerDailyTable rows={bedlinerDaily} title="Bedliner Daily Production Summary" />

      <RecentLogs logs={logs} />
    </div>
  );
}

function ProductionByPartTable({ productionByPart }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">
        Production by Part
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="p-3">Part</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Actual</th>
              <th className="p-3">Scrap/Rejects</th>
              <th className="p-3">Attainment</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {productionByPart.map((part) => (
              <tr key={part.id} className="hover:bg-slate-50">
                <td className="p-3 font-semibold">{part.name}</td>
                <td className="p-3">{part.plan}</td>
                <td className="p-3">{part.actual}</td>
                <td className="p-3">{part.scrap}</td>
                <td className="p-3">{part.attainment}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BedlinerDailyTable({ rows, title }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="p-3">Work Date</th>
              <th className="p-3">Scheduled Seq</th>
              <th className="p-3">Assembly Prod</th>
              <th className="p-3">Assembly Rejects</th>
              <th className="p-3">Seq Rejects</th>
              <th className="p-3">Call Offs</th>
              <th className="p-3">Attainment</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-4 text-center text-slate-500">
                  No Bedliner production summary found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id || row.work_date} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold">{formatDate(row.work_date)}</td>
                  <td className="p-3">{row.total_scheduled_sequences}</td>
                  <td className="p-3">{row.total_assembly_production}</td>
                  <td className="p-3">{row.total_assembly_rejects}</td>
                  <td className="p-3">{row.total_sequencing_rejects}</td>
                  <td className="p-3">{row.total_call_offs}</td>
                  <td className="p-3">{row.attainment_percent}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogbookSection({ fetchData, logs, selectedShift, activeShift }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Logbook</h2>
        <p className="text-sm text-slate-500">
          Capture production issues, scrap reports, downtime and supervisor
          comments for {activeShift?.name}.
        </p>

        <div className="mt-5">
          <ProductionForm
            onSuccess={fetchData}
            selectedShift={selectedShift}
            activeShift={activeShift}
          />
        </div>
      </div>

      <RecentLogs logs={logs} title="Scrap Report and Production Logbook" />
    </div>
  );
}

function ProductionEntrySection({
  productionEntry,
  setProductionEntry,
  selectedPart,
  activeShift,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Production Entry</h2>
      <p className="text-sm text-slate-500">
        Paperless production capture for {activeShift?.name}. This screen is
        designed to reduce typing and prevent wrong selections.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Part Produced
          </label>

          <select
            value={productionEntry.partId}
            onChange={(event) =>
              setProductionEntry({
                partId: event.target.value,
                station: "",
              })
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Select part</option>
            {PARTS.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Station
          </label>

          <select
            value={productionEntry.station}
            disabled={!selectedPart}
            onChange={(event) =>
              setProductionEntry((prev) => ({
                ...prev,
                station: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
          >
            <option value="">Select station</option>
            {selectedPart?.stations.map((station) => (
              <option key={station}>{station}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Next step: this will capture part number, job number, plan, actual
        quantity, scrap quantity, scrap reason and supervisor submission status.
      </div>
    </div>
  );
}

function ScrapSection({ chartData, logs, latestScrap, totalScrap }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard label="Latest Scrap/Rejects" value={latestScrap} tone="red" />
        <KpiCard label="Total Scrap/Rejects" value={totalScrap} tone="red" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-950">Scrap Trend</h2>
        <ProductionChart data={chartData} />
      </div>

      <RecentLogs logs={logs} title="Scrap Report Log" />
    </div>
  );
}

function ReportsSection({
  productionByPart,
  bedlinerDaily,
  avgOEE,
  achievement,
  totalScrap,
  activeReport,
  setActiveReport,
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {["daily", "weekly", "monthly"].map((report) => (
            <button
              key={report}
              onClick={() => setActiveReport(report)}
              className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${
                activeReport === report
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {report} Report
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Average Attainment/OEE" value={`${avgOEE}%`} tone="emerald" />
        <KpiCard label="Achievement" value={`${achievement}%`} tone="purple" />
        <KpiCard label="Total Scrap/Rejects" value={totalScrap} tone="red" />
      </div>

      {activeReport === "daily" && (
        <BedlinerDailyTable
          rows={bedlinerDaily}
          title="Daily Bedliner Production Report"
        />
      )}

      {activeReport === "weekly" && (
        <div className="space-y-6">
          <ProductionByPartTable productionByPart={productionByPart} />
          <BedlinerDailyTable
            rows={bedlinerDaily}
            title="Weekly Bedliner Production Breakdown"
          />
        </div>
      )}

      {activeReport === "monthly" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Monthly Production Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Monthly reporting will aggregate the same MSSQL production snapshot
            data by part, station, rejects and attainment once monthly stored
            procedures or date-range procedures are available.
          </p>

          <div className="mt-5">
            <ProductionByPartTable productionByPart={productionByPart} />
          </div>
        </div>
      )}
    </div>
  );
}

function RecentLogs({ logs, title = "Recent Logbook Entries" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="p-3">Hour</th>
              <th className="p-3">Problem</th>
              <th className="p-3">NG Pieces</th>
              <th className="p-3">Scrap Description</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-4 text-center text-slate-500">
                  No production logs yet
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3">{log.hour}</td>
                  <td className="p-3">{log.problem}</td>
                  <td className="p-3">{log.ng_pcs}</td>
                  <td className="p-3">{log.scrap_desc}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}