import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function ProductionChart({ data }) {
  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="font-bold mb-4">Production Trends</h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />

          {/* ✅ FIXED */}
          <XAxis dataKey="time" />

          <YAxis />
          <Tooltip />

          {/* ✅ CLEAN COLORS */}
          <Line type="monotone" dataKey="oee" stroke="#22c55e" />
          <Line type="monotone" dataKey="scrap" stroke="#ef4444" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}