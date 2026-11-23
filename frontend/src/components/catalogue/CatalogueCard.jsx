import { ArrowRight } from "lucide-react";

export default function CatalogueCard({ item, onSelect, iconResolver, artSrcResolver }) {
  const Icon = iconResolver?.(item);
  const artSrc = artSrcResolver?.(item);
  return (
    <button
      onClick={() => onSelect?.(item)}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-sky-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        {artSrc ? <img src={artSrc} alt="" className="h-7 w-7 object-contain" /> : Icon ? <Icon className="h-5 w-5 text-slate-600" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-slate-900">{item.name || item.item_name}</h3>
        <p className="line-clamp-2 text-xs text-slate-500">{item.description || item.user_description || ""}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-sky-600" />
    </button>
  );
}