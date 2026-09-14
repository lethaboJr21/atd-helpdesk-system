import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { currentTicketArchiveApi } from "../services/api";

function formatRemaining(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h remaining`;
  return value > 0 ? "Less than 1h remaining" : "Grace period complete";
}

function DecisionDialog({ mode, ticket, onCancel, onComplete }) {
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const destructive = mode === "delete";
  const valid = reason.trim().length >= (destructive ? 10 : 5) && (!destructive || confirmation === `DELETE ${ticket.ticket_ref}`);
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      if (destructive) await currentTicketArchiveApi.remove(ticket.id, { reason: reason.trim(), confirmation });
      else await currentTicketArchiveApi.restore(ticket.id, reason.trim());
      onComplete();
    } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">{destructive ? "Permanently delete ticket" : "Restore ticket"}</h2><p className="mt-2 text-sm text-slate-600">{ticket.ticket_ref} | {ticket.title}</p><label className="mt-5 block text-sm font-bold">Reason</label><textarea value={reason} onChange={(event)=>setReason(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border p-3" />{destructive ? <><p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">This action cannot be undone. Tombstone evidence will be retained.</p><label className="mt-4 block text-sm font-bold">Type DELETE {ticket.ticket_ref}</label><input value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border p-3" /></> : null}<div className="mt-6 flex justify-end gap-3"><button onClick={onCancel} className="rounded-xl border px-4 py-2 font-bold">Cancel</button><button disabled={!valid||busy} onClick={submit} className={`rounded-xl px-4 py-2 font-bold text-white disabled:opacity-40 ${destructive?"bg-red-600":"bg-emerald-600"}`}>{busy?"Working...":destructive?"Delete permanently":"Restore"}</button></div></div></div>;
}

export default function CurrentTicketArchivePage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ tickets: [], total: 0, permissions: {} });
  const [view, setView] = useState("archived");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [decision, setDecision] = useState(null);
  const load = useCallback(async () => {
    try {
      setError("");
      const response = await currentTicketArchiveApi.list({ q: query, view });
      setData(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not load the ticket archive.");
    }
  }, [query, view]);
  useEffect(() => { load(); }, [load]);
  const tabs = [
    { key: "active", label: "Active Tickets" },
    { key: "archived", label: "Archived Tickets" },
    { key: "pending-deletion", label: "Pending Deletion" },
  ];
  const selectView = (key) => {
    if (key === "active") navigate("/tickets");
    else setView(key);
  };
  return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">Current Ticket Lifecycle</h1><p className="text-sm text-slate-600">Active, recoverable archived, and governed pending-deletion views. Freshservice imports remain separate.</p></div><button onClick={()=>navigate("/dashboard")} className="rounded-xl border bg-white px-4 py-2 font-bold">Back to Dashboard</button></div><div className="mt-6 flex flex-wrap gap-2">{tabs.map((tab)=><button key={tab.key} onClick={()=>selectView(tab.key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${view===tab.key?"bg-slate-900 text-white":"border bg-white text-slate-700"}`}>{tab.label}</button>)}</div><div className="mt-4 rounded-2xl border bg-white p-4"><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search reference, title or requester" className="w-full rounded-xl border px-4 py-3" /></div>{error?<p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>:null}<div className="mt-4 overflow-hidden rounded-2xl border bg-white"><div className="border-b p-4 text-sm font-bold">{data.total} {view === "pending-deletion" ? "pending-deletion" : "archived"} tickets</div>{data.tickets.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No tickets in this view.</p> : data.tickets.map((ticket)=><div key={ticket.id} className="grid gap-3 border-b p-4 md:grid-cols-[1fr_210px_280px]"><button onClick={()=>navigate(`/tickets/${ticket.id}`)} className="text-left"><div className="font-black text-cyan-700">{ticket.ticket_ref}</div><div className="font-bold">{ticket.title}</div><div className="text-sm text-slate-500">{ticket.requester_name||"Unknown requester"} | {ticket.requester_department||"No department"}</div><div className="mt-1 text-xs text-slate-500">Archived by {ticket.archived_by_name||"System"} | {ticket.archive_reason||"No reason recorded"}</div></button><div className="text-sm"><div>{ticket.priority} | Previous status: {ticket.status}</div><div>{new Date(ticket.archived_at).toLocaleString("en-ZA")}</div><div className={`mt-1 font-bold ${ticket.pending_deletion?"text-red-700":"text-amber-700"}`}>{ticket.pending_deletion?"Pending governed deletion":formatRemaining(ticket.grace_seconds_remaining)}</div></div><div className="flex flex-wrap content-start gap-2"><button onClick={()=>navigate(`/tickets/${ticket.id}`)} className="rounded-xl border px-3 py-2 font-bold">View Ticket</button>{data.permissions?.canRestore?<button onClick={()=>setDecision({mode:"restore",ticket})} className="rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white">Restore</button>:null}{data.permissions?.canPermanentlyDelete&&ticket.pending_deletion?<button onClick={()=>setDecision({mode:"delete",ticket})} className="rounded-xl border border-red-300 px-3 py-2 font-bold text-red-700">Delete permanently</button>:null}</div></div>)}</div></div>{decision?<DecisionDialog {...decision} onCancel={()=>setDecision(null)} onComplete={()=>{setDecision(null);load();}}/>:null}</div>;
}
