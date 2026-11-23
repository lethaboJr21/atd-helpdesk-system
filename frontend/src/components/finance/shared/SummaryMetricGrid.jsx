const GRID_COLS = {
  3: "grid gap-3 sm:grid-cols-3 xl:grid-cols-3",
  6: "grid gap-3 sm:grid-cols-3 xl:grid-cols-6",
  9: "grid gap-3 sm:grid-cols-3 xl:grid-cols-9",
};

export default function SummaryMetricGrid({metrics,columns=9}){
  const gridCols=GRID_COLS[columns]||GRID_COLS[9];
  return <div className={gridCols}>{metrics.map(({label,value,Icon,tone},i)=><div key={label||i} className={`rounded-xl border bg-white p-4 ${tone||""}`}>{Icon&&<Icon className="h-4 w-4 text-sky-700"/>}<div className="mt-3 text-2xl font-bold">{value}</div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div></div>)}</div>;
}