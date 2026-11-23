import { ExternalLink } from "lucide-react";
import { workItemTone, formatFinanceDate, formatElapsed } from "../../../utils/financeShared";

export default function WorkItemCard({item,onOpen,actions}){
  const toneClass=workItemTone(item);
  return <article className={`rounded-xl border p-4 ${toneClass}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-xs font-bold text-sky-700">{item.reference}</div>
        <h4 className="mt-1 font-bold text-slate-900">{item.title}</h4>
        <p className="mt-1 text-xs text-slate-500">{item.finance_function||"Finance"} · {item.status} · {item.priority}{item.kpi_objective?` · KPI: ${item.kpi_objective}`:""}</p>
      </div>
      <div className="flex gap-2">
        {onOpen&&<button onClick={()=>onOpen(item.id)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Open <ExternalLink className="ml-1 inline h-3 w-3"/></button>}
        {item.evidenceRequired&&<span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Evidence required</span>}
        {actions}
      </div>
    </div>
    {item.due_at&&<><div className="mt-4 flex justify-between text-xs">
      <span>Due {formatFinanceDate(item.effective_due_at||item.due_at)}{item.effective_due_at&&item.original_due_at&&new Date(item.effective_due_at).getTime()!==new Date(item.original_due_at).getTime()&&<span className="ml-1 text-amber-600">(extended)</span>}</span>
      <span>{formatElapsed(item)}</span>
    </div><div className="mt-1 h-2 overflow-hidden rounded bg-white/80"><div className={`h-full ${item.isOverdue?"bg-red-500":item.dueWithin24h?"bgD-amber-500":"bg-sky-600"}`} style={{width:`${Math.min(100,Math.max(2,item.elapsedPercent||0))}%`}}/></div></>}
  </article>;
}