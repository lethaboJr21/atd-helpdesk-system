import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Factory,
  RefreshCw,
} from "lucide-react";
import { io } from "socket.io-client";

import ProductionChart from "../components/ProductionChart";
import ProductionForm from "../components/ProductionForm";
import { logsApi, notificationApi, productionApi } from "../services/api";

const API_ORIGIN = "http://localhost:3001";

export default function ProductionDashboard() {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [prod, logData, notifData] = await Promise.all([
        productionApi.getAll(),
        logsApi.getAll(),
        notificationApi.getAll(),
      ]);

      setData(Array.isArray(prod.data) ? prod.data : []);
      setLogs(Array.isArray(logData.data) ? logData.data : []);
      setNotifications(Array.isArray(notifData.data) ? notifData.data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch production dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        time: d.created_at
          ? new Date(d.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A",
        oee: Number(d.oee || 0),
        scrap: Number(d.scrap || 0),
      })),
    [data]
  );

  const avgOEE = useMemo(() => {
    if (!data.length) return "0.00";

    const total = data.reduce((sum, d) => sum + Number(d.oee || 0), 0);
    return (total / data.length).toFixed(2);
  }, [data]);

  const latestScrap = data.length > 0 ? Number(data[0].scrap || 0) : 0;

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

  const exportToCSV = () => {
    if (!logs.length) {
      alert("No production logs to export");
      return;
    }

    const headers = ["Hour", "Problem", "NG Pieces", "Scrap Description"];
    const rows = logs.map((log) => [
      log.hour,
      log.problem,
      log.ng_pcs,
      log.scrap_desc,
    ]);
    
    
const shifts = [
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
const [selectedShift, setSelectedShift] = useState("all");
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

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Factory className="h-4 w-4" />
            Production Module / Supervisor View
          </div>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Production Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor production output, scrap, OEE, and logbook issues.
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
          
          <div className="mb-6 grid gap-4 md:grid-cols-4">
          <button
            onClick={() => setSelectedShift("all")}
            className={`rounded-2xl border p-4 text-left shadow-sm ${
              selectedShift === "all"
                ? "border-blue-300 bg-blue-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-bold text-slate-950">All Shifts</p>
            <p className="text-sm text-slate-500">Full day overview</p>
          </button>
          
          {shifts.map((shift) => (
            <button
              key={shift.id}
              onClick={() => setSelectedShift(shift.id)}
              className={`rounded-2xl border p-4 text-left shadow-sm ${
                selectedShift === shift.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <p className="font-bold text-slate-950">{shift.name}</p>
              <p className="text-sm text-slate-500">{shift.description}</p>
            </button>
          ))}
      </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
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

      <p className="mb-4 text-xs text-slate-500">
        Last updated:{" "}
        {lastUpdated
          ? lastUpdated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "Never"}
      </p>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          <h3 className="mt-3 font-bold text-slate-950">Logbook</h3>
          <p className="mt-1 text-sm text-slate-500">
            Record hourly production issues and NG pieces.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Factory className="h-6 w-6 text-green-600" />
          <h3 className="mt-3 font-bold text-slate-950">Production Output</h3>
          <p className="mt-1 text-sm text-slate-500">
            Track plan, actual production, scrap, and OEE.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <h3 className="mt-3 font-bold text-slate-950">Scrap Tracking</h3>
          <p className="mt-1 text-sm text-slate-500">
            Monitor scrap trends and recurring loss causes.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <BarChart3 className="h-6 w-6 text-purple-600" />
          <h3 className="mt-3 font-bold text-slate-950">Weekly Reports</h3>
          <p className="mt-1 text-sm text-slate-500">
            Review production, scrap, OEE, and improvement suggestions.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <ProductionForm onSuccess={fetchData} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-green-700">Avg OEE</p>
          <h2 className="mt-2 text-3xl font-bold text-green-800">{avgOEE}%</h2>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-red-700">Latest Scrap</p>
          <h2 className="mt-2 text-3xl font-bold text-red-800">
            {latestScrap}
          </h2>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-blue-700">Metric Entries</p>
          <h2 className="mt-2 text-3xl font-bold text-blue-800">
            {data.length}
          </h2>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-950">
          OEE and Scrap Trend
        </h2>
        <ProductionChart data={chartData} />
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-950">
          Production Metrics
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3">Machine</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Actual</th>
                <th className="p-3">Scrap</th>
                <th className="p-3">OEE</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {data.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-500">
                    No production metrics yet
                  </td>
                </tr>
              ) : (
                data.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3">{d.machine}</td>
                    <td className="p-3">{d.plan}</td>
                    <td className="p-3">{d.actual}</td>
                    <td className="p-3">{d.scrap}</td>
                    <td className="p-3">{d.oee}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-950">
          Production Logs
        </h2>

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
    </div>
  );
}
