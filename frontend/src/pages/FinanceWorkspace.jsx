import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, Bell, CalendarDays, ChevronRight, ClipboardList, Download, FileCheck2, HelpCircle, Inbox, LayoutDashboard, Mail, Menu, Plus, Search, ShieldCheck, Ticket, UserCog, Users, X } from "lucide-react";
import { financeWorkspaceApi, ticketsApi } from "../services/api";
import FinanceEmployeeDashboard from "../components/finance/FinanceEmployeeDashboard";
import CompanyAnnouncements from "../components/dashboard/CompanyAnnouncements";
import { useAuth } from "../hooks/useAuth";
import FinanceTeamDirectory from "../components/finance/FinanceTeamDirectory";
import FinanceEmailIntakePanel from "../components/finance/FinanceEmailIntakePanel";
import FinanceApprovalsPanel from "../components/finance/FinanceApprovalsPanel";
import FinanceMonthEndClosePanel from "../components/finance/FinanceMonthEndClosePanel";
import FinanceGovernancePanel from "../components/finance/FinanceGovernancePanel";
import FinancePeoplePerformancePanel from "../components/finance/FinancePeoplePerformancePanel";
import FinanceManagerDashboard from "../components/finance/FinanceManagerDashboard";

const navGroups=[
 {label:"Workspace",items:[["overview","Executive Overview",LayoutDashboard],["manager-dashboard","Manager Dashboard",BarChart3],["raise","Raise a Ticket",Plus],["register","Ticket Register",Ticket],["emails","Tickets from Emails",Mail],["my-work","My Work",ClipboardList]]},
 {label:"Finance Operations",items:[["month-end","Month-End Close",CalendarDays],["journals","Journal Approvals",FileCheck2],["reconciliations","Reconciliation Approvals",ShieldCheck],["audit","Audit Management",ShieldCheck],["kpis","Monthly KPI Review",LayoutDashboard]]},
 {label:"Governance",items:[["evidence","SharePoint Evidence",Inbox],["notifications","Notifications",Bell],["access","Access Requests",ShieldCheck]]},
 {label:"Administration",items:[["team","Team Administration",Users],["email-settings","Email Intake Settings",Mail],["system","System Administration",UserCog]]}
];
const field="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
const priorityOptions=["Low","Medium","High","Critical"];
const statusTone=s=>({Assigned:"bg-rose-50 text-rose-700",Open:"bg-blue-50 text-blue-700",Resolved:"bg-emerald-50 text-emerald-700",Closed:"bg-slate-100 text-slate-600"}[s]||"bg-sky-50 text-sky-700");
const initials=name=>String(name||"Unassigned").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
const monthValue=()=>new Date().toISOString().slice(0,7);
const fmtDate=v=>v?new Date(v).toLocaleDateString("en-ZA"):"Not set";
const downloadBlob=(blob,name)=>{const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)};

function Placeholder({title,description}){return <section className="rounded-xl border bg-white p-12 text-center"><ClipboardList className="mx-auto h-10 w-10 text-sky-300"/><h2 className="mt-4 text-xl font-semibold text-slate-800">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p></section>}
function Metric({label,value,caption,tone="text-slate-900",onClick}){return <button type="button" onClick={onClick} className="rounded-xl border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="text-sm text-slate-500">{label}</span><strong className={`mt-4 block text-4xl ${tone}`}>{value}</strong><span className="mt-3 block text-xs text-slate-400">{caption}</span></button>}

function FinanceRequestModal({open,onClose,employees,functions,prefill,afterSave}){
 const {user:authenticatedUser}=useAuth();
 const period=monthValue();
 const emptyForm={
  title:"",description:"",assignedToUserId:prefill?.id||"",financeFunction:"",
  dueAt:"",priority:"Medium",department:"Finance",entity:"",requestType:"",
  businessImpact:"",financialExposure:"",rootCause:"",resolution:"",
  reference:"",internalNotes:"",
 };
 const [form,setForm]=useState(emptyForm);
 const [files,setFiles]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [kpiError,setKpiError]=useState("");
 const [kpis,setKpis]=useState([]);
 const [kpiChoice,setKpiChoice]=useState("");
 const [addKpiOpen,setAddKpiOpen]=useState(false);
 const [kpiDraft,setKpiDraft]=useState({name:"",description:""});
 const [showDetails,setShowDetails]=useState(false);
 const targetEmployeeId=form.assignedToUserId||prefill?.id||authenticatedUser?.id||"";

 useEffect(()=>{
  if(!open)return;
  setForm({...emptyForm,assignedToUserId:prefill?.id||""});
  setFiles([]);
  setKpis([]);
  setKpiChoice("");
  setKpiError("");
  setError("");
  setAddKpiOpen(false);
  setShowDetails(false);
 },[open,prefill?.id]);

 useEffect(()=>{
  if(!open||!targetEmployeeId)return;
  let active=true;
  setKpiError("");
  financeWorkspaceApi.financeKpis(period,targetEmployeeId)
   .then(response=>{
    if(active)setKpis((response.data.kpis||[]).filter(item=>item.status==="active"));
   })
   .catch(requestError=>{
    if(active)setKpiError(requestError.response?.data?.error||requestError.message||"Employee KPIs could not be loaded.");
   });
  return ()=>{active=false};
 },[open,targetEmployeeId,period]);

 if(!open)return null;

 const selectedKpi=kpis.find(item=>String(item.id)===String(kpiChoice));
 const createKpi=async()=>{
  const name=kpiDraft.name.trim();
  if(!targetEmployeeId){setKpiError("Select an employee before adding a KPI.");return}
  if(!name){setKpiError("Enter a KPI name.");return}
  setBusy(true);
  setKpiError("");
  try{
   const [year,monthNumber]=String(period||"").split("-").map(Number);
   const periodStart=`${period}-01`;
   const periodEnd=`${period}-${String(new Date(year,monthNumber,0).getDate()).padStart(2,"0")}`;
   const response=await financeWorkspaceApi.createFinanceKpi({
    name,
    description:kpiDraft.description.trim()||null,
    ownerUserId:Number(targetEmployeeId),
    periodStart,
    periodEnd,
    weight:0,
    progressPercent:0,
   });
   const created=response.data;
   setKpis(current=>[...current,created].sort((a,b)=>a.name.localeCompare(b.name)));
   setKpiChoice(String(created.id));
   setKpiDraft({name:"",description:""});
   setAddKpiOpen(false);
  }catch(requestError){
   setKpiError(requestError.response?.data?.error||requestError.message||"KPI could not be added.");
  }finally{setBusy(false)}
 };

 const submit=async event=>{
  event.preventDefault();
  setError("");
  const skipped=kpiChoice==="skip";
  if(!selectedKpi&&!skipped){
   setError("Select an employee KPI or choose Skip KPI.");
   return;
  }
  const title=selectedKpi
   ?form.title.trim()||`Finance support: ${selectedKpi.name}`
   :form.title.trim();
  if(!title){
   setError("Enter a short issue summary when skipping KPI linking.");
   return;
  }
  const description=form.description.trim()||(
   selectedKpi
    ?`Finance support requested in relation to the KPI "${selectedKpi.name}".`
    :`Finance support request: ${title}.`
  );
  const financeFunction=form.financeFunction||"General Finance Administration";
  setBusy(true);
  try{
   await ticketsApi.create({
    title,
    description,
    priority:form.priority,
    dueAt:form.dueAt||null,
    assignedToUserId:form.assignedToUserId||null,
    workspace:"Finance",
    department:form.department,
    category:financeFunction,
    financeFunction,
    financeKpiId:selectedKpi?.id||null,
    source:"portal",
    financeMetadata:{
     ...form,
     financeFunction,
     financeKpiId:selectedKpi?.id||null,
     financeKpiName:selectedKpi?.name||null,
     origin:prefill?"finance_team_directory":"finance_workspace",
    },
   },files);
   await afterSave?.();
   onClose();
  }catch(requestError){
   setError(requestError.response?.data?.error||requestError.message||"Finance ticket could not be created.");
  }finally{setBusy(false)}
 };

 const financeFunctionOptions=[...new Set(["General Finance Administration",...functions].filter(Boolean))];
 return <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
  <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
   <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-6 py-5">
    <div><p className="text-[11px] font-bold uppercase tracking-[.22em] text-sky-700">ATD Finance Service Desk</p><h2 className="text-xl font-semibold">Open a Finance ticket</h2><p className="mt-1 text-sm text-slate-500">Link it to an employee KPI or skip the link and give a short issue summary.</p></div>
    <button type="button" onClick={onClose} aria-label="Close"><X/></button>
   </header>
   {error&&<p className="mx-6 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
   <div className="space-y-5 p-6">
    <div className="grid gap-4 sm:grid-cols-2">
     <label className="text-xs font-semibold text-slate-600">Employee / KPI owner
      <select className={field} value={form.assignedToUserId} onChange={event=>{setForm({...form,assignedToUserId:event.target.value});setKpiChoice("")}}>
       <option value="">My own KPI list</option>
       {employees.map(employee=><option key={employee.id} value={employee.id}>{employee.name} · {employee.job_title||"Finance"}</option>)}
      </select>
     </label>
     <label className="text-xs font-semibold text-slate-600">Priority
      <select className={field} value={form.priority} onChange={event=>setForm({...form,priority:event.target.value})}>
       {priorityOptions.map(option=><option key={option}>{option}</option>)}
      </select>
     </label>
    </div>

    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold text-slate-900">Employee KPI</h3><p className="mt-1 text-sm text-slate-600">Choose a KPI to create a linked ticket in one click.</p></div>
      <button type="button" onClick={()=>setAddKpiOpen(value=>!value)} className="rounded-lg border border-sky-700 bg-white px-3 py-2 text-sm font-bold text-sky-800">{addKpiOpen?"Cancel":"Add KPI"}</button>
     </div>
     <label className="mt-4 block text-xs font-semibold text-slate-600">KPI selection
      <select className={field} value={kpiChoice} onChange={event=>setKpiChoice(event.target.value)}>
       <option value="">Select an active employee KPI</option>
       {kpis.map(kpi=><option key={kpi.id} value={kpi.id}>{kpi.name}{kpi.function_name?` · ${kpi.function_name}`:""}</option>)}
       <option value="skip">Skip KPI link</option>
      </select>
     </label>
     {kpiError&&<p className="mt-2 text-sm text-red-700" role="alert">{kpiError}</p>}
     {!kpis.length&&!kpiError&&<p className="mt-2 text-sm text-slate-500">No active KPIs are assigned to this employee yet. Add one here or skip KPI linking.</p>}
     {addKpiOpen&&<div className="mt-4 grid gap-3 rounded-xl border bg-white p-4">
      <label className="text-xs font-semibold text-slate-600">New KPI name<input autoFocus className={field} value={kpiDraft.name} onChange={event=>setKpiDraft({...kpiDraft,name:event.target.value})} maxLength={200}/></label>
      <label className="text-xs font-semibold text-slate-600">Description (optional)<textarea className={field} rows="2" value={kpiDraft.description} onChange={event=>setKpiDraft({...kpiDraft,description:event.target.value})}/></label>
      <button type="button" disabled={busy} onClick={createKpi} className="justify-self-start rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?"Adding...":"Add to employee KPI list"}</button>
     </div>}
    </section>

    {kpiChoice==="skip"&&<label className="block text-xs font-semibold text-slate-600">Issue summary
     <input autoFocus required className={field} maxLength={180} value={form.title} onChange={event=>setForm({...form,title:event.target.value})} placeholder="What Finance issue needs attention?"/>
    </label>}
    {selectedKpi&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>{selectedKpi.name}</strong> will be linked to the new ticket. You can open it without filling in a long form.</div>}

    <details open={showDetails} onToggle={event=>setShowDetails(event.currentTarget.open)} className="rounded-xl border border-slate-200">
     <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">Optional details</summary>
     <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Ticket subject (optional when KPI is selected)<input className={field} maxLength={180} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600">Finance function
       <select className={field} value={form.financeFunction} onChange={event=>setForm({...form,financeFunction:event.target.value})}>
        <option value="">General Finance Administration</option>
        {financeFunctionOptions.filter(option=>option!=="General Finance Administration").map(option=><option key={option} value={option}>{option}</option>)}
       </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">Required completion date<input type="datetime-local" className={field} value={form.dueAt} onChange={event=>setForm({...form,dueAt:event.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600">Request type<input className={field} value={form.requestType} onChange={event=>setForm({...form,requestType:event.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600">Entity<input className={field} value={form.entity} onChange={event=>setForm({...form,entity:event.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600">Financial exposure<input className={field} value={form.financialExposure} onChange={event=>setForm({...form,financialExposure:event.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Detailed request / narration<textarea className={field} rows="3" value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Business impact<textarea className={field} rows="2" value={form.businessImpact} onChange={event=>setForm({...form,businessImpact:event.target.value})}/></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Evidence / attachments<input type="file" multiple className={`${field} mt-1`} onChange={event=>setFiles(Array.from(event.target.files||[]))}/></label>
     </div>
    </details>
   </div>
   <footer className="sticky bottom-0 flex items-center justify-between border-t bg-white px-6 py-4">
    <span className="text-xs text-slate-500">Saved to the Finance workspace only.</span>
    <button disabled={busy} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Saving...":selectedKpi?"Open linked ticket":"Open ticket"}</button>
   </footer>
  </form>
 </div>
}

function TicketRegister({tickets,onRaise,title="Ticket Register",mine=false}){
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("all");
 const [preview,setPreview]=useState(null);
 const rows=useMemo(
  ()=>tickets.filter(ticket=>
   (!mine||ticket.isMine)&&
   (!query||[ticket.ticket_ref,ticket.title,ticket.assignee_name,ticket.status,ticket.finance_kpi_name].join(" ").toLowerCase().includes(query.toLowerCase()))&&
   (status==="all"||ticket.status===status)
  ),
  [tickets,mine,query,status]
 );
 const exportCsv=()=>{
  const csv=[
   "Reference,Title,Employee,KPI,Due,Status,Priority",
   ...rows.map(ticket=>[
    ticket.ticket_ref,ticket.title,ticket.assignee_name||"Unassigned",
    ticket.finance_kpi_name||"",ticket.due_at||"",ticket.status,ticket.priority,
   ].map(value=>`"${String(value||"").replaceAll('"','""')}"`).join(",")),
  ].join("\n");
  downloadBlob(new Blob([csv],{type:"text/csv"}),`ATD_Finance_${mine?"My_Work":"Ticket_Register"}.csv`);
 };
 return <section className="rounded-xl border bg-white shadow-sm">
  <div className="flex flex-wrap items-center gap-3 p-6">
   <label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className={`${field} pl-9`} placeholder="Search records, owners or references..." value={query} onChange={event=>setQuery(event.target.value)}/></label>
   <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set(tickets.map(ticket=>ticket.status).filter(Boolean))].map(option=><option key={option}>{option}</option>)}</select>
   <button onClick={exportCsv} className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold"><Download className="mr-2 inline h-4 w-4"/>Export</button>
   <button onClick={onRaise} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-2 inline h-4 w-4"/>New ticket</button>
  </div>
  {!mine&&<div className="flex flex-wrap items-center gap-3 border-y px-6 py-4">
   <button className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold" onClick={()=>downloadBlob(new Blob(["Subject,Description,Finance Function,Due Date,Priority,Entity,Request Type"],{type:"text/csv"}),"ATD_Finance_Import_Template.csv")}>Download Excel Template</button>
   <label className="text-sm">Preview Excel upload<input type="file" accept=".csv,.xlsx" className="ml-3" onChange={event=>setPreview(event.target.files?.[0]?.name||null)}/></label>
   {preview&&<span className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">Selected for governed preview: {preview}. Import requires validation before confirmation.</span>}
   <p className="w-full text-xs text-slate-500">Requestor is always the signed-in identity. Uploaded requestor details remain source metadata.</p>
  </div>}
  <div className="overflow-x-auto">
   <table className="min-w-full text-sm">
    <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-4">Reference / work item</th><th>Responsible employee</th><th>Due date</th><th>Status</th><th>Evidence</th><th/></tr></thead>
    <tbody>{rows.map(ticket=><tr key={ticket.id} className="border-t">
     <td className="p-4"><span className="text-[10px] uppercase text-slate-500">Ticket · {ticket.ticket_ref}</span><strong className="block">{ticket.title}</strong>{ticket.finance_kpi_name&&<small className="mt-1 block font-semibold text-sky-700">Linked KPI: {ticket.finance_kpi_name}</small>}</td>
     <td><span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-xs font-bold text-sky-700">{initials(ticket.assignee_name)}</span>{ticket.assignee_name||"Unassigned - manager mapping required"}</td>
     <td className={ticket.overdue?"text-red-600":""}>{fmtDate(ticket.due_at)}{ticket.overdue&&<small className="block">Overdue</small>}</td>
     <td><span className={`rounded-md px-2 py-1 text-xs ${statusTone(ticket.status)}`}>{ticket.status}</span></td>
     <td>{ticket.evidence_count||0} files</td><td><a href={`/helpdesk/finance-workspace/tickets/${ticket.id}`} aria-label={`Open ${ticket.ticket_ref}`}><ChevronRight/></a></td>
    </tr>)}{!rows.length&&<tr><td colSpan="6" className="p-14 text-center text-slate-500">No work items here yet. New records appear here as the Finance team starts working.</td></tr>}</tbody>
   </table>
  </div>
 </section>
}

export default function FinanceWorkspace(){
 const navigate=useNavigate();
 const {user,logout}=useAuth();
 const [page,setPage]=useState("overview"),[mobile,setMobile]=useState(false),[month,setMonth]=useState(monthValue()),[demo,setDemo]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[warning,setWarning]=useState(""),[data,setData]=useState({summary:{wholePeriod:{},tickets:[]},dashboard:{},admin:{employees:[],functions:[],offices:[],availabilityStates:[]}}),[requestOpen,setRequestOpen]=useState(false),[prefill,setPrefill]=useState(null),[employeeDrafts,setEmployeeDrafts]=useState({}),[saving,setSaving]=useState(false);
 const load=async()=>{setLoading(true);setError("");setWarning("");try{const [summary,dashboard,admin]=await Promise.all([financeWorkspaceApi.reportingSummary(),financeWorkspaceApi.dashboard(),financeWorkspaceApi.administration()]);const dashData=dashboard.data;const notices=[];if(dashData?.warning_code==="DASHBOARD_AGGREGATION_PARTIAL"||dashData?.code==="DASHBOARD_AGGREGATION_PARTIAL")notices.push(dashData?.warning_message||dashData?.message||"Some dashboard data could not be fully aggregated. Figures may be incomplete.");if(summary.data?.kpiLinkAvailable===false)notices.push("Finance KPI links are unavailable until the database migration is applied; ticket reporting remains available.");setWarning(notices.join(" "));setData({summary:summary.data,dashboard:dashData,admin:admin.data});setEmployeeDrafts(Object.fromEntries((admin.data.employees||[]).map(x=>[x.id,{officeCode:x.office_code||"MAIN_CFO",financeFunction:x.finance_function||"General Finance Administration",managerUserId:x.manager_user_id||"",backupUserId:x.backup_user_id||"",availabilityStatus:x.availability_status||"available",delegationEligible:x.delegation_eligible!==false,isFinanceManager:Boolean(x.is_finance_manager)}])))}catch(ex){const code=ex.response?.data?.code||ex.response?.data?.warning_code;if(code==="DASHBOARD_AGGREGATION_PARTIAL"){setWarning(ex.response?.data?.message||"Some dashboard data could not be fully aggregated. Figures may be incomplete.");}else{setError(ex.response?.data?.error||ex.message);}}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 const employees=(data.admin.employees||[]),tickets=(data.summary.tickets||[]).map(x=>({...x,isMine:String(x.assigned_to_user_id)===String(user?.id)})),whole=data.summary.wholePeriod||{};
 const workload=useMemo(()=>{const map={};tickets.filter(x=>!["Resolved","Closed"].includes(x.status)).forEach(x=>{const k=x.assignee_name||"Unassigned - manager mapping required";map[k]=(map[k]||0)+1});return Object.entries(map).sort((a,b)=>b[1]-a[1])},[tickets]);
 const maxWork=Math.max(1,...workload.map(x=>x[1]));
 const pageTitle=navGroups.flatMap(g=>g.items).find(x=>x[0]===page)?.[1]||"Executive Overview";
 const openRaise=employee=>{setPrefill(employee||null);setRequestOpen(true)};
 const saveEmployee=async e=>{setSaving(true);try{await financeWorkspaceApi.updateEmployee(e.id,employeeDrafts[e.id]);await load()}finally{setSaving(false)}};
 const body=()=>{
  if(page==='overview')return <div className="space-y-6"><CompanyAnnouncements /><section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#123d57] to-[#0c5a70] p-10 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Your Finance Control Centre</p><h2 className="mt-4 text-3xl">Every action. Clear ownership.</h2><p className="mt-3 text-sm text-cyan-50">Keep requests moving, close with confidence and make performance visible.</p><button onClick={()=>setPage('my-work')} className="mt-6 rounded-lg bg-white px-5 py-3 text-sm font-bold text-slate-800">Open my work <ChevronRight className="inline h-4 w-4"/></button><div className="absolute right-10 top-12 border-l border-cyan-300/30 pl-8"><p className="text-[10px] uppercase tracking-[.2em] text-cyan-200">Reporting period</p><strong className="mt-3 block text-2xl">{new Date(`${month}-01T00:00:00`).toLocaleDateString('en-ZA',{month:'long',year:'numeric'})}</strong><small>Live operations · demo {demo?'included':'excluded'}</small></div></section><div className="grid gap-4 md:grid-cols-4"><Metric label="Open tickets" value={whole.active||0} caption="Active Finance requests" onClick={()=>setPage('register')}/><Metric label="Overdue items" value={whole.overdue||0} caption="Require immediate attention" tone="text-red-600" onClick={()=>setPage('my-work')}/><Metric label="Awaiting review" value={data.dashboard.metrics?.unacknowledged||0} caption="Across approval workflows"/><Metric label="Month-end progress" value={`${Math.round(Number(data.dashboard.metrics?.month_end_progress||0))}%`} caption="Evidence-backed completion" onClick={()=>setPage('month-end')}/></div><div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]"><section className="rounded-xl border bg-white p-6"><div className="flex justify-between"><div><h3 className="text-xl">Workload by employee</h3><p className="text-sm text-slate-500">Open work across Finance operations</p></div><span className="rounded bg-sky-50 px-3 py-1 text-xs text-sky-700">{whole.active||0} active</span></div><div className="mt-7 space-y-5">{workload.map(([name,count])=><button key={name} onClick={()=>setPage('register')} className="grid w-full grid-cols-[210px_1fr_35px] items-center gap-4 text-left"><span><i className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 not-italic text-xs font-bold text-sky-700">{initials(name)}</i>{name}</span><span className="h-2 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-cyan-600" style={{width:`${count/maxWork*100}%`}}/></span><strong>{count}</strong></button>)}{!workload.length&&<p className="text-sm text-slate-500">No active workload.</p>}</div><button onClick={()=>setPage('team')} className="mt-7 text-sm font-semibold text-sky-700">View Finance team <ChevronRight className="inline h-4 w-4"/></button></section><section className="rounded-xl border bg-white p-6"><h3 className="text-xl">Attention & escalation</h3><p className="text-sm text-slate-500">Focus on what needs a decision</p><div className="mt-6 divide-y">{[["Overdue work",whole.overdue||0,"text-red-500"],["Approvals awaiting action",data.dashboard.metrics?.unacknowledged||0,"text-amber-500"],["Unassigned work",whole.unattended||0,"text-sky-600"],["Email-origin work",whole.emailOrigin||0,"text-amber-500"]].map(([label,n,tone])=><button key={label} onClick={()=>setPage('register')} className="flex w-full items-center justify-between py-5"><span className={tone}><span className="mr-2 inline-block h-2 w-2 rounded-full bg-current align-middle"/><span className="ml-1 text-slate-700">{label}</span></span><strong>{n} <ChevronRight className="ml-3 inline h-4 w-4"/></strong></button>)}</div></section></div><TicketRegister tickets={tickets.slice(0,5)} onRaise={()=>openRaise()} title="Recent Finance activity"/></div>;
  if(page==='register')return <TicketRegister tickets={tickets} onRaise={()=>openRaise()}/>;
  if(page==='my-work')return <FinanceEmployeeDashboard onOpenTicket={id=>navigate(`/finance-workspace/tickets/${id}`)}/>;
  if(page==='emails')return <FinanceEmailIntakePanel tickets={tickets} employees={employees} functions={data.admin.functions||[]} onRaise={()=>openRaise()}/>;
  if(page==='email-settings')return <FinanceEmailIntakePanel tickets={tickets} employees={employees} functions={data.admin.functions||[]} onRaise={()=>openRaise()}/>;
   if(page==='kpis')return <FinancePeoplePerformancePanel mode="kpis" employees={employees} functions={data.admin.functions||[]}/>;
   if(page==='manager-dashboard')return <FinanceManagerDashboard />;
   if(page==='team')return <FinanceTeamDirectory employees={data.admin.employees||[]} offices={(data.admin.offices||[]).filter(o=>!/boardroom/i.test(o.name||''))} functions={data.admin.functions||[]} availabilityStates={data.admin.availabilityStates||[]} eligible={employees} drafts={employeeDrafts} setDrafts={setEmployeeDrafts} onSave={saveEmployee} saving={saving}/>;

  if(page==='audit')return <FinanceGovernancePanel area="audit" employees={employees}/>;
  if(page==='evidence')return <FinanceGovernancePanel area="evidence" employees={employees}/>;
  if(page==='notifications')return <FinanceGovernancePanel area="notifications" employees={employees}/>;
  if(page==='access')return <FinanceGovernancePanel area="access" employees={employees}/>;
  if(page==='month-end')return <FinanceMonthEndClosePanel employees={employees} functions={data.admin.functions||[]}/>;
  if(page==='journals')return <FinanceApprovalsPanel key={page} type="journals" employees={employees}/>;
  if(page==='reconciliations')return <FinanceApprovalsPanel key={page} type="reconciliations" employees={employees}/>;  if(page==='team-legacy')return <FinanceTeamDirectory employees={data.admin.employees||[]} offices={(data.admin.offices||[]).filter(o=>!/boardroom/i.test(o.name||''))} functions={data.admin.functions||[]} availabilityStates={data.admin.availabilityStates||[]} eligible={employees} drafts={employeeDrafts} setDrafts={setEmployeeDrafts} onSave={saveEmployee} saving={saving}/>;
  const descriptions={"month-end":"Manage recurring, monthly and one-off close work with weighted progress and evidence.",journals:"Create, review and approve journals with governed separation of duties.",reconciliations:"Review reconciliations, variances, evidence and approval decisions.",audit:"Manage internal and external audit requests, findings and corrective actions.",kpis:"Review weighted monthly Finance KPIs, evidence and corrective actions.",evidence:"Manage linked Finance evidence and governed SharePoint references.",notifications:"Review actionable Finance assignments, approvals and warnings.",access:"Review governed Finance access requests and effective scope.","email-settings":"Configure authorised Finance mailboxes and routing rules.",system:"Finance workspace configuration and health controls."};
  return <Placeholder title={pageTitle} description={descriptions[page]||"This governed Finance function is scheduled for the next implementation batch."}/>;
 };
 return <div className="min-h-screen bg-[#f4f7fa] text-slate-800"><aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0d3049] text-slate-100 transition-transform lg:translate-x-0 ${mobile?'translate-x-0':'-translate-x-full'}`}><div className="flex h-full flex-col"><div className="p-7"><div className="rounded-lg bg-white p-3 text-center text-xl font-black tracking-widest text-[#075077]">ATD<br/><span className="text-[10px]">ALLIANCE</span></div><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-sky-200">Finance Service Desk</p><div className="mt-6 rounded-lg border border-sky-700/60 p-3 text-xs uppercase tracking-widest"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400"/>Private Workspace</div></div><nav className="flex-1 overflow-y-auto px-4 pb-6">{navGroups.map(g=><div key={g.label} className="mb-5"><p className="px-3 text-[10px] font-bold uppercase tracking-[.22em] text-sky-300/60">{g.label}</p><div className="mt-2 space-y-1">{g.items.map(([id,label,Icon])=><button key={id} onClick={()=>{if(id==='raise')openRaise();else setPage(id);setMobile(false)}} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm ${page===id?'bg-[#175574] text-cyan-300 ring-1 ring-cyan-400/30':'text-slate-200 hover:bg-white/5'}`}><Icon className="h-5 w-5"/>{label}</button>)}</div></div>)}</nav><div className="border-t border-sky-900 p-5 text-xs"><ShieldCheck className="mr-2 inline h-4 w-4"/>Private · authenticated access<p className="mt-2 text-[10px] uppercase tracking-widest text-sky-300/60">ATD Alliance · Finance</p></div></div></aside><main className="lg:ml-72"><header className="flex h-20 items-center justify-between border-b bg-white px-5 lg:px-10"><button onClick={()=>setMobile(!mobile)} className="lg:hidden"><Menu/></button><div className="text-sm text-slate-500">Finance Workspace <ChevronRight className="mx-2 inline h-4 w-4"/> <span className="text-slate-800">{pageTitle}</span></div><div className="flex items-center gap-4"><button type="button" onClick={() => navigate("/")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Return to IT Helpdesk</button><Bell className="h-5 w-5"/><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 font-bold text-sky-700">{initials(user?.name)}</span><div className="hidden text-sm sm:block"><strong className="block">{user?.name||"Signed-in user"}</strong><small className="text-slate-500">{user?.job_title||user?.role}</small></div><button onClick={logout} className="text-xs text-slate-500">Sign out</button></div></header><div className="p-5 lg:p-10"><section className="mb-7"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[11px] font-bold uppercase tracking-[.22em] text-sky-700">ATD Alliance · Finance Operations</p><h1 className="mt-3 text-4xl font-medium text-[#062b49]">{pageTitle}</h1><p className="mt-2 text-slate-500">Manage ownership, evidence and progress in one place.</p></div><div className="flex flex-wrap gap-3"><button className="rounded-lg border border-slate-500 bg-white px-4 py-3 text-sm font-semibold"><HelpCircle className="mr-2 inline h-4 w-4"/>Help with this page</button><input type="month" className="rounded-lg border bg-white px-4 py-3 text-sm" value={month} onChange={e=>setMonth(e.target.value)}/><button onClick={()=>openRaise()} className="rounded-lg bg-sky-700 px-5 py-3 text-sm font-bold text-white"><Plus className="mr-2 inline h-4 w-4"/>Raise a ticket</button></div></div><div className="mt-7 flex flex-wrap items-center justify-between border-b pb-5 text-xs text-slate-500"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-teal-400"/>Central workspace <span className="mx-4">·</span>{user?.email}</span><label><input type="checkbox" checked={demo} onChange={e=>setDemo(e.target.checked)} className="mr-2"/>Include demonstration data</label></div></section>{warning&&<div className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span><AlertTriangle className="mr-2 inline h-4 w-4 align-text-bottom"/>{warning}</span><button onClick={()=>setWarning("")} aria-label="Dismiss" className="shrink-0 text-amber-500 hover:text-amber-700"><X className="h-4 w-4"/></button></div>}{error&&<p className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}{loading?<p className="rounded-xl bg-white p-12 text-center">Loading Finance Workspace...</p>:body()}<section data-feature="SCRIPT_916_FINANCE_TASK_MONITORING_UI" className="mt-6 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold text-slate-900">Finance task control</h2><p className="mt-1 text-sm text-slate-500">Track ownership, assistants, reviewers, due dates, evidence submission, review, acknowledgement and KPI-linked feedback.</p><div className="mt-4 flex flex-wrap gap-2">{["Assigned","In Progress","Submitted","Awaiting Review","Returned for Correction","Accepted","Acknowledged","Closed"].map((state,index)=><span key={state} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{index+1}. {state}</span>)}</div></section><section data-feature="SCRIPT_918_FINANCE_CONTROL_GUIDANCE" className="mt-4 grid gap-3 md:grid-cols-4"><div className="rounded-xl border bg-white p-4"><b>Assignment</b><p className="mt-1 text-xs text-slate-500">Owner, assistant and reviewer roles can be governed independently.</p></div><div className="rounded-xl border bg-white p-4"><b>Reminders</b><p className="mt-1 text-xs text-slate-500">Assigner and assignee reminder settings support due-soon and overdue follow-up.</p></div><div className="rounded-xl border bg-white p-4"><b>Communication</b><p className="mt-1 text-xs text-slate-500">Clarification, evidence, review, correction and acknowledgement remain classified.</p></div><div className="rounded-xl border bg-white p-4"><b>Visibility</b><p className="mt-1 text-xs text-slate-500">Collaborators receive explicit view, comment and edit permissions.</p></div></section><footer className="mt-10 flex justify-between text-[10px] uppercase tracking-wider text-slate-400"><span>ATD Alliance · Finance Service Desk</span><span>Private workspace · Shared central records</span></footer></div></main><FinanceRequestModal open={requestOpen} onClose={()=>setRequestOpen(false)} employees={employees} functions={data.admin.functions||[]} prefill={prefill} afterSave={load}/></div>
}
