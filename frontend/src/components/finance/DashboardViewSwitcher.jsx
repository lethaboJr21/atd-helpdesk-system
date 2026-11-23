const VIEW_OPTIONS = [
  { value: "management", label: "Management" },
  { value: "ticket-driven", label: "Ticket-Driven" },
];

export default function DashboardViewSwitcher({ view, onViewChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1" role="tablist" aria-label="Dashboard view">
      {VIEW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={view === value}
          onClick={() => onViewChange?.(value)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            view === value
              ? "border-slate-300 bg-white text-slate-900 shadow-sm"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}