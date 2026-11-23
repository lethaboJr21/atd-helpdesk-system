const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom" },
];

export default function TimeRangeSelector({ value, onChange, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
      >
        {RANGES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      {value === "custom" && (
        <>
          <input type="date" onChange={(e) => onChange("custom", { from: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" />
          <span className="text-slate-400">to</span>
          <input type="date" onChange={(e) => onChange("custom", { to: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" />
        </>
      )}
    </div>
  );
}