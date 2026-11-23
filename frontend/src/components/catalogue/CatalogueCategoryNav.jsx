import { FolderOpen, Star } from "lucide-react";

export default function CatalogueCategoryNav({ categories, activeCategoryId, onCategoryChange, quickLabel = "Popular Items", allLabel = "All Items", siblingModules, onNavigateSibling }) {
  const base = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  const active = "bg-sky-50 text-sky-700";
  const inactive = "text-slate-600 hover:bg-slate-100";
  return (
    <nav className="space-y-1">
      <button onClick={() => onCategoryChange("popular")} className={`${base} ${activeCategoryId === "popular" ? active : inactive}`}>
        <Star className="h-4 w-4" /> {quickLabel}
      </button>
      <button onClick={() => onCategoryChange("all")} className={`${base} ${activeCategoryId === "all" ? active : inactive}`}>
        <FolderOpen className="h-4 w-4" /> {allLabel}
      </button>
      {categories.map(cat => (
        <button key={cat.id} onClick={() => onCategoryChange(cat.id)} className={`${base} ${activeCategoryId === cat.id ? active : inactive}`}>
          {cat.name}
        </button>
      ))}
      {siblingModules && siblingModules.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Other modules</p>
          {siblingModules.map(mod => (
            <button key={mod.key} onClick={() => onNavigateSibling?.(mod)} className={`${base} ${inactive} w-full`}>
              {mod.title}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}