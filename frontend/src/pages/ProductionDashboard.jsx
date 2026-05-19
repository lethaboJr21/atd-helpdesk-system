import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { productionApi, logsApi, notificationApi } from "../services/api";
import ProductionForm from "../components/ProductionForm";
import ProductionChart from "../components/ProductionChart";

export default function ProductionDashboard() {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const fetchData = useCallback(async () => {
    try {
      const prod = await productionApi.getAll();
      const logData = await logsApi.getAll();
      const notifData = await notificationApi.getAll();

      setData(prod.data);
      setLogs(logData.data);
      setLastUpdated(new Date());

      setNotifications(
        notifData.data.map((n) => ({
          ...n,
          isRead: true,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch production dashboard data:", error);
    }
  }, []);

  const chartData = data.map((d) => ({
    time: new Date(d.created_at).toLocaleTimeString(),
    oee: Number(d.oee),
    scrap: Number(d.scrap),
  }));

  // Real-time updates with Socket.IO
  useEffect(() => {
    const socket = io("http://localhost:3001");

    socket.on("new-log", ({ notification }) => {
      fetchData();

      if (notification) {
        setNotifications((prev) => [
          {
            id: Date.now(),
            ...notification,
            isRead: false,
          },
          ...prev.slice(0, 19),
        ]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  // Initial fetch + auto-refresh every 10 seconds
  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const avgOEE =
    data.length > 0
      ? (
          data.reduce((sum, d) => sum + Number(d.oee || 0), 0) / data.length
        ).toFixed(2)
      : 0;

  const exportToCSV = () => {
    if (!logs.length) {
      alert("No data to export");
      return;
    }

    const headers = ["Hour", "Problem", "NG Pieces", "Scrap Description"];

    const rows = logs.map((log) => [
      log.hour,
      log.problem,
      log.ng_pcs,
      log.scrap_desc,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((row) => row.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "production_logs.csv");

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Production Dashboard</h1>

      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="font-bold">Notifications</h2>

          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-2 rounded text-sm ${
                n.type === "critical"
                  ? "bg-red-100 border border-red-400"
                  : n.type === "warning"
                  ? "bg-yellow-100 border border-yellow-400"
                  : "bg-green-100 border border-green-400"
              } ${!n.isRead ? "ring-2 ring-blue-400" : ""}`}
            >
              {n.message}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Last updated:{" "}
        {lastUpdated
          ? lastUpdated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "Never"}
      </p>

      <div className="flex gap-3 mb-4">
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
        >
          Refresh Data
        </button>

        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-green-700"
        >
          Download CSV
        </button>
      </div>

      <ProductionForm onSuccess={fetchData} />

      <div className="flex gap-4 mb-6">
        <div className="bg-green-100 p-4 rounded shadow">
          <p className="text-gray-600">Avg OEE</p>
          <h2 className="text-2xl font-bold text-green-700">{avgOEE}%</h2>
        </div>

        <div className="bg-red-100 p-4 rounded shadow">
          <p className="text-gray-600">Scrap Trend</p>
          <h2 className="text-2xl font-bold text-red-600">
            {data.length > 0 ? data[data.length - 1].scrap : 0}%
          </h2>
        </div>

        <div className="bg-blue-100 p-4 rounded shadow">
          <p className="text-gray-600">Entries</p>
          <h2 className="text-2xl font-bold text-blue-700">{data.length}</h2>
        </div>
      </div>

      <ProductionChart data={chartData} />

      <div className="bg-white p-4 shadow rounded mb-6">
        <h2 className="font-bold mb-2">Production Metrics</h2>

        <table className="w-full">
          <thead>
            <tr>
              <th>Machine</th>
              <th>Plan</th>
              <th>Actual</th>
              <th>Scrap</th>
              <th>OEE</th>
            </tr>
          </thead>

          <tbody>
            {data.map((d) => (
              <tr key={d.id}>
                <td>{d.machine}</td>
                <td>{d.plan}</td>
                <td>{d.actual}</td>
                <td>{d.scrap}</td>
                <td>{d.oee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-4 shadow rounded">
        <h2 className="font-bold mb-2">Production Logs</h2>

        <table className="w-full">
          <thead>
            <tr>
              <th>Hour</th>
              <th>Problem</th>
              <th>NG</th>
              <th>Scrap</th>
            </tr>
          </thead>

          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.hour}</td>
                <td>{log.problem}</td>
                <td>{log.ng_pcs}</td>
                <td>{log.scrap_desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}