import { useEffect, useState } from "react";
import { productionApi, logsApi } from "../services/api";
import ProductionForm from "../components/ProductionForm";
import ProductionChart from "../components/ProductionChart";

export default function ProductionDashboard() {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    const prod = await productionApi.getAll();
    const logData = await logsApi.getAll();

    setData(prod.data);
    setLogs(logData.data);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const avgOEE =
    data.length > 0
      ? (data.reduce((sum, d) => sum + d.oee, 0) / data.length).toFixed(2)
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
      [headers, ...rows]
        .map((row) => row.join(","))
        .join("\n");

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

      {/* ✅ Last Updated */}
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

      {/* ✅ Buttons */}
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

      {/* ✅ Form */}
      <ProductionForm onSuccess={fetchData} />

      {/* KPI */}
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

      {/* Chart */}
      <ProductionChart data={data} />

      {/* Production Table */}
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

      {/* Logs Table */}
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
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.hour}</td>
                <td>{l.problem}</td>
                <td>{l.ng_pcs}</td>
                <td>{l.scrap_desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}