import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { groupsApi, ticketsApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const OPERATIONS_ROLES = new Set(["agent", "operator", "manager", "admin", "superadmin"]);
const STATUS_OPTIONS = ["Open", "Assigned", "Pending", "Investigating", "Waiting Approval", "Resolved", "Closed", "Escalated"];
const STATUS_TABS = ["All", "Unresolved", ...STATUS_OPTIONS];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const WORKSPACE_OPTIONS = ["IT", "IT Service Request", "Change Management", "ERP / Syspro", "Infrastructure", "Applications", "Access & Security"];

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}
function formatAge(ticket) {
  if (ticket?.age) return ticket.age;
  const created = new Date(ticket?.created_at).getTime();
  if (!Number.isFinite(created)) return "N/A";
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
function priorityClass(value) {
  return ({ Critical: "bg-red-100 text-red-700 border-red-200", High: "bg-orange-100 text-orange-700 border-orange-200", Medium: "bg-amber-100 text-amber-700 border-amber-200", Low: "bg-emerald-100 text-emerald-700 border-emerald-200" })[value] || "bg-slate-100 text-slate-700";
}
function statusClass(value) {
  return ({ Open: "bg-blue-100 text-blue-700", Assigned: "bg-slate-100 text-slate-700", Pending: "bg-purple-100 text-purple-700", Investigating: "bg-indigo-100 text-indigo-700", "Waiting Approval": "bg-purple-100 text-purple-700", Resolved: "bg-emerald-100 text-emerald-700", Closed: "bg-slate-200 text-slate-700", Escalated: "bg-red-100 text-red-700" })[value] || "bg-slate-100 text-slate-700";
}

export default function TicketWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, employeeView } = useAuth();
  const operationsUser = OPERATIONS_ROLES.has(user?.role);
  const employeeExperience = user?.role === "user" || employeeView || location.pathname.startsWith("/employee");

  // Two years of imported Freshservice history shares the list with live work, so
  // staff land on unresolved tickets and reach the rest through search.
  const defaultStatus = searchParams.get("status") || (employeeExperience ? "All" : "Unresolved");
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_TABS.includes(defaultStatus) ? defaultStatus : "All");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // The search term goes to the server because the client only holds a page of
  // tickets, and history reaches back to June 2024.
  const [appliedQuery, setAppliedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setAppliedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchTickets = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = employeeExperience
        ? await ticketsApi.getEmployeeView()
        : await ticketsApi.getAll({ limit: 500, ...(appliedQuery ? { search: appliedQuery } : {}) });
      const data = Array.isArray(response.data) ? response.data : [];
      setTickets(data);
      setSelectedTicket((current) => data.find((item) => String(item.id) === String(current?.id)) || data[0] || null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Tickets could not be loaded."));
      setTickets([]); setSelectedTicket(null);
    } finally { setLoading(false); }
  }, [appliedQuery, employeeExperience]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => {
    if (!operationsUser || employeeExperience) return;
    groupsApi.getAll().then((response) => setGroups(Array.isArray(response.data) ? response.data : [])).catch((requestError) => setError(getErrorMessage(requestError, "Support groups could not be loaded.")));
  }, [employeeExperience, operationsUser]);

  const filteredTickets = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tickets.filter((item) => {
      const searchable = [item.ticket_ref, item.title, item.description, item.priority, item.status, item.workspace, item.requester_name, item.assigned_to_name, item.assigned_group_name].filter(Boolean).join(" ").toLowerCase();
      const statusMatches = statusFilter === "All" || (statusFilter === "Unresolved" ? !["Resolved", "Closed"].includes(item.status) : item.status === statusFilter);
      return (!search || searchable.includes(search)) && statusMatches;
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [query, statusFilter, tickets]);

  const statusCount = (status) => status === "All" ? tickets.length : status === "Unresolved" ? tickets.filter((item) => !["Resolved", "Closed"].includes(item.status)).length : tickets.filter((item) => item.status === status).length;

  const changeFilter = (value) => {
    setStatusFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === "All") next.delete("status"); else next.set("status", value);
    setSearchParams(next, { replace: true });
  };

  const runAction = async (action, message) => {
    setActionLoading(true); setError(""); setSuccess("");
    try { await action(); setSuccess(message); await fetchTickets(); }
    catch (requestError) { setError(getErrorMessage(requestError, "The ticket action failed.")); }
    finally { setActionLoading(false); }
  };

  const selectedGroup = groups.find((group) => String(group.id) === String(selectedTicket?.assigned_group_id));
  const canOperate = operationsUser && !employeeExperience;

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <header className="mx-auto flex max-w-[1650px] flex-wrap items-start justify-between gap-4">
        <div><button onClick={() => navigate(employeeExperience ? (user?.role === "user" ? "/" : "/employee") : "/")} className="mb-3 rounded-xl border bg-white px-4 py-2 text-sm font-bold">Back to Dashboard</button><p className="text-sm text-slate-500">Helpdesk / {employeeExperience ? "My Tickets" : "Ticket Workspace"}</p><h1 className="mt-1 text-3xl font-bold">{employeeExperience ? "My Tickets" : "Ticket Workspace"}</h1><p className="mt-1 text-sm text-slate-500">{employeeExperience ? "Track support requests created for your account." : "Review, triage, assign and manage all authorised tickets."}</p></div>
        <div className="flex gap-2"><button onClick={fetchTickets} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</button><button onClick={() => navigate("/tickets/new?type=incident")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" />New Ticket</button></div>
      </header>

      <main className="mx-auto mt-6 max-w-[1650px]">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{success}</div>}

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap gap-3 border-b p-4"><div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets" className="w-full rounded-xl border py-2.5 pl-10 pr-3" /></div></div>
            <div className="flex gap-2 overflow-x-auto border-b p-4">{STATUS_TABS.map((status) => <button key={status} onClick={() => changeFilter(status)} className={statusFilter === status ? "whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white" : "whitespace-nowrap rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"}>{status}<span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{statusCount(status)}</span></button>)}</div>
            <div className="divide-y">{loading ? <div className="p-10 text-center text-slate-500">Loading tickets...</div> : filteredTickets.length === 0 ? <div className="p-10 text-center"><Ticket className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-3 font-bold">No tickets found</p></div> : filteredTickets.map((item) => <button key={item.id} onClick={() => setSelectedTicket(item)} onDoubleClick={() => navigate(`/tickets/${item.id}`)} className={String(selectedTicket?.id) === String(item.id) ? "grid w-full gap-3 border-l-4 border-blue-600 bg-blue-50 p-5 text-left md:grid-cols-[1fr_120px_150px_80px]" : "grid w-full gap-3 border-l-4 border-transparent p-5 text-left hover:bg-slate-50 md:grid-cols-[1fr_120px_150px_80px]"}><div><div className="flex flex-wrap gap-2"><span className="font-bold text-blue-700">{item.ticket_ref || `TICKET-${item.id}`}</span><span className={`rounded-full border px-2 py-1 text-xs font-bold ${priorityClass(item.priority)}`}>{item.priority || "Medium"}</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.status || "Open"}</span></div><p className="mt-2 font-semibold">{item.title}</p><p className="text-sm text-slate-500">{employeeExperience ? item.workspace : item.requester_name || item.requester_email}</p></div><p className="text-sm font-semibold">{item.workspace || "IT"}</p><p className="text-sm font-semibold">{item.assigned_group_name || "Triage"}</p><span className="text-xs font-bold text-slate-500">{formatAge(item)}</span></button>)}</div>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            {!selectedTicket ? <div className="rounded-2xl border bg-white p-6 text-center text-slate-500">Select a ticket to view its details.</div> : <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">{selectedTicket.ticket_ref}</p><h2 className="mt-1 text-lg font-bold">{selectedTicket.title}</h2></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(selectedTicket.status)}`}>{selectedTicket.status}</span></div><p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{selectedTicket.description || "No description"}</p><div className="mt-4 grid grid-cols-2 gap-3"><Info label="Priority" value={selectedTicket.priority} /><Info label="Workspace" value={selectedTicket.workspace} /><Info label="Group" value={selectedTicket.assigned_group_name || "Triage"} /><Info label="Assigned To" value={selectedTicket.assigned_to_name || "Unassigned"} /></div><button onClick={() => navigate(`/tickets/${selectedTicket.id}`)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><ExternalLink className="h-4 w-4" />Open Full Ticket</button>{canOperate && <div className="mt-4 space-y-3 border-t pt-4"><select value={selectedTicket.assigned_to_user_id || ""} onChange={(event) => runAction(() => ticketsApi.assign(selectedTicket.id, event.target.value || null, selectedTicket.assigned_group_id || null), "Ticket assignment updated.")} disabled={actionLoading || !selectedTicket.assigned_group_id} className="w-full rounded-xl border px-3 py-2"><option value="">Unassigned</option>{(selectedGroup?.members || []).map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select><button onClick={() => runAction(() => ticketsApi.assign(selectedTicket.id, user.id, selectedTicket.assigned_group_id || null), "Ticket assigned to you.")} disabled={actionLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><UserCheck className="h-4 w-4" />Assign to Me</button><div className="grid grid-cols-2 gap-2"><button onClick={() => runAction(() => ticketsApi.resolve(selectedTicket.id), "Ticket resolved.")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><CheckCircle2 className="h-4 w-4" />Resolve</button><button onClick={() => runAction(() => ticketsApi.close(selectedTicket.id), "Ticket closed.")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"><XCircle className="h-4 w-4" />Close</button></div></div>}{selectedTicket.priority === "Critical" && <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />Critical ticket requiring priority attention.</div>}</div>}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value || "N/A"}</p></div>;
}
