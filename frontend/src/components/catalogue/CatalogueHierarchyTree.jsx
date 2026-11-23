import { useMemo, useState } from "react";

export default function CatalogueHierarchyTree({ items, onSelectItem, onSelectCategory, renderItemExtras }) {
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const grouped = useMemo(() => {
    const map = new Map();
    (items || []).forEach((x) => {
      const category = x.category || "Uncategorised";
      if (!map.has(category)) map.set(category, new Map());
      const subs = map.get(category);
      const sub = x.sub_category ?? null;
      if (!subs.has(sub)) subs.set(sub, []);
      subs.get(sub).push(x);
    });
    return Array.from(map.entries()).map(([category, subs]) => {
      const subEntries = Array.from(subs.entries())
        .sort((a, b) => (a[0] == null) - (b[0] == null) || String(a[0]).localeCompare(String(b[0])))
        .map(([sub, subItems]) => ({
          sub,
          items: subItems
            .slice()
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || String(a.item_name || a.item || "").localeCompare(String(b.item_name || b.item || ""))),
        }));
      return { category, subs: subEntries, count: subEntries.reduce((n, s) => n + s.items.length, 0) };
    }).sort((a, b) => String(a.category).localeCompare(String(b.category)));
  }, [items]);
  const toggleCategory = (category) => {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };
  if (!grouped.length) {
    return <p className="text-sm text-slate-500">Catalogue classifications appear here when available.</p>;
  }
  return (
    <div className="space-y-2">
      {grouped.map((group) => {
        const isOpen = openCategories.has(group.category);
        const hasNamedSubs = group.subs.some((s) => s.sub != null);
        return (
          <details key={group.category} open={isOpen} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <summary
              className="cursor-pointer list-none text-sm font-black text-slate-800"
              onClick={(e) => {
                e.preventDefault();
                toggleCategory(group.category);
                if (onSelectCategory) onSelectCategory(group.category);
              }}
            >
              {group.category}
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{group.count} issue paths</span>
            </summary>
            {isOpen ? (
              <div className="mt-3 space-y-3">
                {group.subs.map((subGroup) => (
                  <div key={subGroup.sub ?? "__general__"} className="space-y-2">
                    {subGroup.sub != null || hasNamedSubs ? (
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{subGroup.sub ?? "General"}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {subGroup.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectItem) onSelectItem(item);
                            }}
                            className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left hover:bg-cyan-50"
                          >
                            <span className="block font-bold text-slate-800">{item.item_name || item.item}</span>
                            <span className="mt-1 block text-slate-500">{item.sub_category || "General"} · {item.default_priority}</span>
                          </button>
                          {renderItemExtras ? renderItemExtras(item) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}