import { ChevronRight } from "lucide-react";

export default function DashboardNav({ items, activeId, onSelect, groups }) {
  if (groups) {
    return (
      <nav className="space-y-4">
        {groups.map((group) => (
          <div key={group.id || group.label}>
            {group.label && (
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {(group.items || []).map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  onClick={() => onSelect(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {items?.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          active={activeId === item.id}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </nav>
  );
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge != null && (
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {item.badge}
        </span>
      )}
      {active && <ChevronRight className="h-4 w-4" />}
    </button>
  );
}