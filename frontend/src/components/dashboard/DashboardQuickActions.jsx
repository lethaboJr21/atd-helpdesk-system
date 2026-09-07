export default function DashboardQuickActions({ title = "Quick actions", actions = [] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.key || action.label} type="button" onClick={action.onClick} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50">
              {Icon ? <Icon className="h-5 w-5 text-blue-700" /> : null}
              <span className="font-semibold text-slate-900">{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
