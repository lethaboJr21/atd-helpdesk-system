import { Search } from "lucide-react";
import useDebouncedValue from "../../hooks/useDebouncedValue";

export default function CatalogueSearchBox({ value, onChange, placeholder = "Search...", debounceMs = 300 }) {
  const debounced = useDebouncedValue(value, debounceMs);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
    </div>
  );
}