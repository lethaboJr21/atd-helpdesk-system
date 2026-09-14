import { useMemo, useState } from "react";

function displayValue(value) {
  if (value == null || value === "") return "N/A";
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { return JSON.stringify(JSON.parse(trimmed), null, 2); } catch { return value; }
  }
  return value;
}
function activityLabel(value) {
  const text = String(value || "activity").replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function dateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-ZA") : "N/A";
}
export default function TicketActivityTable({ rows = [] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.actor_name, row.actor_email, row.action, row.old_value, row.new_value, row.source]
        .some((value) => String(value || "").toLowerCase().includes(needle))
    );
  }, [query, rows]);
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search participant, activity or value" className="min-w-64 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        <span className="text-xs font-bold text-slate-500">{filtered.length} of {rows.length} event(s)</span>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-sm"><tr>{["Participant", "Activity", "Previous value", "New value", "Date and time"].map((item) => <th key={item} className="border-b border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600">{item}</th>)}</tr></thead>
          <tbody>{filtered.map((row, index) => <tr key={row.id || String(row.created_at) + "-" + index} className="border-b border-slate-100 align-top last:border-0">
            <td className="px-4 py-3"><p className="font-bold text-slate-900">{row.actor_name || row.actor_email || "System"}</p>{row.actor_name && row.actor_email ? <p className="text-xs text-slate-500">{row.actor_email}</p> : null}</td>
            <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{activityLabel(row.action)}</span>{row.source ? <p className="mt-2 text-xs text-slate-500">Source: {row.source}</p> : null}</td>
            <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3">{displayValue(row.old_value)}</td>
            <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3">{displayValue(row.new_value)}</td>
            <td className="whitespace-nowrap px-4 py-3">{dateTime(row.created_at)}</td>
          </tr>)}</tbody>
        </table>
        {!filtered.length ? <p className="p-6 text-center text-sm text-slate-500">No matching activity.</p> : null}
      </div>
    </div>
  );
}
