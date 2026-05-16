import { useState } from "react";
import { logsApi } from "../services/api";
import { AlertTriangle } from "lucide-react";

export default function ProductionForm({ onSuccess }) {
  const [form, setForm] = useState({
    hour: "",
    problem: "",
    ng_pcs: "",
    scrap_desc: "",
  });

  const [error, setError] = useState("");

  const problems = [
    "Damaged sheet",
    "Bubble defect",
    "Scratches",
    "Machine fault",
    "Other",
  ];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.hour) return "Select hour";
    if (!form.problem) return "Select problem";
    if (!form.ng_pcs) return "Enter NG pieces";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    await logsApi.create({
      ...form,
      hour: Number(form.hour),
      ng_pcs: Number(form.ng_pcs),
    });

    setError("");
    setForm({ hour: "", problem: "", ng_pcs: "", scrap_desc: "" });
    if (onSuccess) onSuccess();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
      <h2 className="text-lg font-bold text-slate-950 mb-4">
        Add Production Log
      </h2>

      {error && (
        <div className="flex items-center gap-2 text-red-600 mb-3">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">

        {/* Hour */}
        <select
          name="hour"
          value={form.hour}
          onChange={handleChange}
          className="rounded-xl border border-slate-200 p-3"
        >
          <option value="">Select Hour</option>
          {[...Array(12)].map((_, i) => (
            <option key={i} value={i + 1}>
              Hour {i + 1}
            </option>
          ))}
        </select>

        {/* Problem */}
        <select
          name="problem"
          value={form.problem}
          onChange={handleChange}
          className="rounded-xl border border-slate-200 p-3"
        >
          <option value="">Select Problem</option>
          {problems.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        {/* NG */}
        <input
          type="number"
          name="ng_pcs"
          placeholder="NG Pieces"
          value={form.ng_pcs}
          onChange={handleChange}
          className="rounded-xl border border-slate-200 p-3"
        />

        {/* Scrap */}
        <input
          name="scrap_desc"
          placeholder="Scrap Description"
          value={form.scrap_desc}
          onChange={handleChange}
          className="rounded-xl border border-slate-200 p-3"
        />

        <button
          className="md:col-span-2 rounded-2xl bg-blue-600 py-3 font-semibold text-white shadow-lg hover:bg-blue-700"
        >
          Submit Log
        </button>
      </form>
    </div>
  );
}
