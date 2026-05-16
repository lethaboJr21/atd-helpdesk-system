import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

export default function ProductionChart({ data }) {
  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="font-bold mb-4">Production Trends</h2>

      <LineChart width={700} height={300} data={data}>
        <CartesianGrid stroke="#ccc" />
        <XAxis dataKey="machine" />
        <YAxis />
        <Tooltip />

        <Line type="monotone" dataKey="oee" stroke="#4CAF50" />
        <Line type="monotone" dataKey="scrap" stroke="#f44336" />
      </LineChart>
    </div>
  );
}