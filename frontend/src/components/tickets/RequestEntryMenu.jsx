import {
  BriefcaseBusiness, CircleHelp, FolderKanban, KeyRound, Laptop, LifeBuoy,
  Mail, Monitor, Network, PackagePlus, Phone, Plus, Printer, ShieldAlert,
  ShoppingCart, TriangleAlert, Wrench, X,
} from "lucide-react";
import { useEffect, useState } from "react";

const REQUEST_ENTRIES=[
 {key:"incident",title:"Report an Incident",description:"Report a fault, outage, error or service that is not working correctly.",icon:LifeBuoy,iconClass:"bg-rose-100 text-rose-700"},
 {key:"service",title:"Request a Service",description:"Request access, software, support or another standard company service.",path:"/services",icon:ShoppingCart,iconClass:"bg-blue-100 text-blue-700"},
 {key:"change",title:"Change Management",description:"Plan and submit an application, infrastructure or configuration change.",path:"/changes/new",icon:BriefcaseBusiness,iconClass:"bg-amber-100 text-amber-700"},
 {key:"asset",title:"Request an Asset",description:"Request equipment, devices, accessories, replacements or temporary assets.",path:"/request-asset",icon:PackagePlus,iconClass:"bg-emerald-100 text-emerald-700"},
 {key:"plant",title:"Plant Machine Support",description:"Report machine, station, control, safety, quality or production-impacting issues.",path:"/incidents/new?catalogue=plant-machine&title=Machine%20or%20plant%20equipment&priority=High&lockTitle=true&lockPriority=true",icon:Wrench,iconClass:"bg-cyan-100 text-cyan-700"},
 {key:"project",title:"Create a Project",description:"Initiate a structured project with ownership, objectives and target dates.",path:"/projects/new",icon:FolderKanban,iconClass:"bg-purple-100 text-purple-700"}
];
const INCIDENTS=[
 {key:"computer",title:"Computer or laptop",icon:Laptop,color:"bg-blue-100 text-blue-700",priority:"Medium"},
 {key:"printer",title:"Printer or scanner",icon:Printer,color:"bg-violet-100 text-violet-700",priority:"Medium"},
 {key:"network",title:"Network or Wi-Fi",icon:Network,color:"bg-cyan-100 text-cyan-700",priority:"High"},
 {key:"email",title:"Email or Microsoft 365",icon:Mail,color:"bg-sky-100 text-sky-700",priority:"Medium"},
 {key:"application",title:"Business application",icon:Monitor,color:"bg-indigo-100 text-indigo-700",priority:"Medium"},
 {key:"erp",title:"Syspro or ERP",icon:Monitor,color:"bg-fuchsia-100 text-fuchsia-700",priority:"High"},
 {key:"access",title:"Account or access problem",icon:KeyRound,color:"bg-amber-100 text-amber-700",priority:"Medium"},
 {key:"telephone",title:"Telephone or communication device",icon:Phone,color:"bg-teal-100 text-teal-700",priority:"Medium"},
 {key:"plant-machine",title:"Machine or plant equipment",icon:Wrench,color:"bg-orange-100 text-orange-700",priority:"High"},
 {key:"safety-technology",title:"Safety-related technology issue",icon:ShieldAlert,color:"bg-red-100 text-red-700",priority:"Critical"},
 {key:"asset-fault",title:"Asset damage or malfunction",icon:TriangleAlert,color:"bg-pink-100 text-pink-700",priority:"High"},
 {key:"other",title:"Other",icon:CircleHelp,color:"bg-slate-100 text-slate-700",priority:null}
];
export default function RequestEntryMenu({open,onClose,onSelect}){
 const [beneficiary,setBeneficiary]=useState("self");
 const [incidentOpen,setIncidentOpen]=useState(false);
 useEffect(()=>{if(!open)return undefined;setIncidentOpen(false);const h=e=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[open,onClose]);
 if(!open)return null;
 const choose=path=>{const join=path.includes("?")?"&":"?";onSelect({path:`${path}${join}beneficiary=${beneficiary}`});};
 const chooseIncident=item=>{
  if(item.key==="other"){choose("/incidents/new?catalogue=other&blank=true");return;}
  const title=encodeURIComponent(item.title);const priority=encodeURIComponent(item.priority);
  choose(`/incidents/new?catalogue=${item.key}&title=${title}&priority=${priority}&lockTitle=true&lockPriority=true`);
 };
 return <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-10 backdrop-blur-sm sm:items-center" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="request-entry-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-[var(--portal-border)] bg-[var(--portal-surface-raised)] shadow-2xl">
   <header className="flex items-start justify-between border-b border-[var(--portal-border)] p-6"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700"><Plus className="h-3.5 w-3.5"/>New request</div><h2 id="request-entry-title" className="text-2xl font-bold text-[var(--portal-text)]">Who is this ticket for?</h2><p className="mt-2 text-sm text-[var(--portal-text-soft)]">Choose the beneficiary before selecting the request type.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-[var(--portal-border)] p-2"><X className="h-5 w-5"/></button></header>
   <div className="p-6"><div className="grid gap-3 sm:grid-cols-2">{[["self","Ticket for Myself","Use my signed-in employee profile."],["other","For Someone Else","Choose the employee before opening the request."]].map(([key,title,copy])=><button key={key} type="button" onClick={()=>setBeneficiary(key)} className={`rounded-2xl border p-4 text-left ${beneficiary===key?"border-blue-500 bg-blue-50 ring-2 ring-blue-100":"border-[var(--portal-border)] bg-[var(--portal-surface)]"}`}><span className="block font-bold text-[var(--portal-text)]">{title}</span><span className="mt-1 block text-sm text-[var(--portal-text-soft)]">{copy}</span></button>)}</div>
    {!incidentOpen?<><h3 className="mt-6 text-lg font-bold text-[var(--portal-text)]">Choose request type</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{REQUEST_ENTRIES.map(item=>{const Icon=item.icon;return <button key={item.key} type="button" onClick={()=>item.key==="incident"?setIncidentOpen(true):choose(item.path)} className="flex items-start gap-4 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-left hover:border-blue-300"><span className={`rounded-xl p-3 ${item.iconClass}`}><Icon className="h-5 w-5"/></span><span><span className="block font-bold text-[var(--portal-text)]">{item.title}</span><span className="mt-1 block text-sm text-[var(--portal-text-soft)]">{item.description}</span></span></button>})}</div></>:<><div className="mt-6 flex items-center justify-between"><h3 className="text-lg font-bold text-[var(--portal-text)]">Report an Incident catalogue</h3><button type="button" onClick={()=>setIncidentOpen(false)} className="text-sm font-bold text-blue-700">Back to request types</button></div><p className="mt-1 text-sm text-[var(--portal-text-soft)]">Catalogue selections lock the governed short summary and priority. Other opens a blank editable incident.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{INCIDENTS.map(item=>{const Icon=item.icon;return <button key={item.key} type="button" onClick={()=>chooseIncident(item)} className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-left font-bold text-[var(--portal-text)] hover:border-rose-300 hover:shadow-sm"><span className={`rounded-xl p-2.5 ${item.color}`}><Icon className="h-5 w-5"/></span><span>{item.title}</span></button>})}</div></>}
   </div>
  </section>
 </div>;
}
