import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
const PAGE_SIZE = 30;

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
function unwrapTickets(payload) {
  if (Array.isArray(payload)) return { tickets: payload, pagination: null, counts: null };
  return {
    tickets: Array.isArray(payload?.tickets) ? payload.tickets : [],
    pagination: payload?.pagination || null,
    counts: payload?.counts || null,
  };
}

function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((value) => pages.add(value));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((value) => pages.add(value));
  return [...pages].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
}

function PaginationBar({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.total <= 0) return null;
  const pages = pageWindow(pagination.page, pagination.totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-t border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm text-slate-600">
        Page <span className="font-bold text-slate-950">{pagination.page}</span> of{" "}
        <span className="font-bold text-slate-950">{pagination.totalPages}</span>
        {" · "}
        <span className="font-bold text-slate-950">{pagination.total.toLocaleString("en-ZA")}</span> tickets
        {" · "}
        {pagination.perPage} per page
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pagination.page <= 1 || loading}
          onClick={() => onPageChange(pagination.page - 1)}
          className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        {pages.map((pageNumber, index) => {
          const previous = pages[index - 1];
          const showGap = previous && pageNumber - previous > 1;
          return (
            <span key={pageNumber} className="inline-flex items-center gap-1.5">
              {showGap ? <span className="px-1 text-slate-400">…</span> : null}
              <button
                type="button"
                disabled={loading}
                onClick={() => onPageChange(pageNumber)}
                className={
                  pageNumber === pagination.page
                    ? "min-w-9 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                    : "min-w-9 rounded-xl border bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                }
              >
                {pageNumber}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages || loading}
          onClick={() => onPageChange(pagination.page + 1)}
          className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function TicketWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, employeeView } = useAuth();
  const operationsUser = OPERATIONS_ROLES.has(user?.role);
  const employeeExperience = user?.role === "user" || employeeView || location.pathname.startsWith("/employee");

  // Two years of imported Freshservice history shares the list with live work, so
  // staff land on unresolved tickets and reach the rest through search / Closed.
  const defaultStatus = searchParams.get("status") || (employeeExperience ? "All" : "Unresolved");
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_TABS.includes(defaultStatus) ? defaultStatus : "All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // The search term goes to the server because history reaches back to June 2024.
  const [appliedQuery, setAppliedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(query.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchTickets = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (employeeExperience) {
        const response = await ticketsApi.getEmployeeView();
        const data = Array.isArray(response.data) ? response.data : [];
        const filtered = data.filter((item) => {
          if (statusFilter === "All") return true;
          if (statusFilter === "Unresolved") return !["Resolved", "Closed"].includes(item.status);
          return item.status === statusFilter;
        });
        setTickets(filtered);
        setPagination(null);
        setCounts(null);
        setSelectedTicket((current) => filtered.find((item) => String(item.id) === String(current?.id)) || null);
        return;
      }

      const response = await ticketsApi.getAll({
        page,
        per_page: PAGE_SIZE,
        status: statusFilter === "All" ? undefined : statusFilter,
        ...(appliedQuery ? { search: appliedQuery } : {}),
        ...(searchParams.get("view") === "mine" ? { view: "mine" } : {}),
      });
      const { tickets: data, pagination: nextPagination, counts: nextCounts } = unwrapTickets(response.data);
      setTickets(data);
      setPagination(nextPagination);
      setCounts(nextCounts);
      setSelectedTicket((current) => data.find((item) => String(item.id) === String(current?.id)) || null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Tickets could not be loaded."));
      setTickets([]); setSelectedTicket(null); setPagination(null); setCounts(null);
    } finally { setLoading(false); }
  }, [appliedQuery, employeeExperience, page, searchParams, statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => {
    if (!operationsUser || employeeExperience) return;
    groupsApi.getAll().then((response) => setGroups(Array.isArray(response.data) ? response.data : [])).catch((requestError) => setError(getErrorMessage(requestError, "Support groups could not be loaded.")));
  }, [employeeExperience, operationsUser]);

  const statusCount = (status) => {
    if (counts && counts[status] != null) return counts[status];
    if (status === "All") return tickets.length;
    if (status === "Unresolved") return tickets.filter((item) => !["Resolved", "Closed"].includes(item.status)).length;
    return tickets.filter((item) => item.status === status).length;
  };

  const changeFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
    setSelectedTicket(null);
    const next = new URLSearchParams(searchParams);
    if (value === "All") next.delete("status");
    else next.set("status", value);
    setSearchParams(next, { replace: true });
  };

  const runAction = async (action, message) => {
    setActionLoading(true); setError(""); setSuccess("");
    try { await action(); setSuccess(message); await fetchTickets(); }
    catch (requestError) { setError(getErrorMessage(requestError, "The ticket action failed.")); }
    finally { setActionLoading(false); }
  };

  const selectedGroup =
    groups.find((group) => String(group.id) === String(selectedTicket?.assigned_group_id)) ||
    groups.find(
      (group) =>
        selectedTicket?.assigned_group_name &&
        String(group.name).toLowerCase() === String(selectedTicket.assigned_group_name).toLowerCase()
    ) ||
    null;

  const assigneeOptions = useMemo(() => {
    const members = Array.isArray(selectedGroup?.members) ? [...selectedGroup.members] : [];
    if (
      selectedTicket?.assigned_to_user_id &&
      !members.some((member) => String(member.id) === String(selectedTicket.assigned_to_user_id))
    ) {
      members.unshift({
        id: selectedTicket.assigned_to_user_id,
        name: selectedTicket.assigned_to_name || "Current assignee",
        email: selectedTicket.assigned_to_email || "",
      });
    }
    return members;
  }, [selectedGroup, selectedTicket]);

  const resolvedGroupId = selectedTicket?.assigned_group_id || selectedGroup?.id || null;
  const canOperate = operationsUser && !employeeExperience;

  const assignTicket = (assigneeId, groupId = resolvedGroupId) =>
    runAction(
      () => ticketsApi.assign(selectedTicket.id, assigneeId || null, groupId || null),
      assigneeId ? "Ticket assignment updated." : "Ticket unassigned."
    );

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
            {!employeeExperience ? (
              <PaginationBar
                pagination={pagination}
                loading={loading}
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  setSelectedTicket(null);
                }}
              />
            ) : null}
            <div className="max-h-[65vh] divide-y overflow-y-auto">{loading ? <div className="p-10 text-center text-slate-500">Loading tickets...</div> : tickets.length === 0 ? <div className="p-10 text-center"><Ticket className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-3 font-bold">No tickets found</p></div> : tickets.map((item) => <button key={item.id} onClick={() => setSelectedTicket((current) => String(current?.id) === String(item.id) ? null : item)} onDoubleClick={() => navigate(`/tickets/${item.id}`)} className={String(selectedTicket?.id) === String(item.id) ? "grid w-full gap-3 border-l-4 border-blue-600 bg-blue-50 p-5 text-left md:grid-cols-[1fr_120px_150px_80px]" : "grid w-full gap-3 border-l-4 border-transparent p-5 text-left hover:bg-slate-50 md:grid-cols-[1fr_120px_150px_80px]"}><div><div className="flex flex-wrap gap-2"><span className="font-bold text-blue-700">{item.ticket_ref || `TICKET-${item.id}`}</span><span className={`rounded-full border px-2 py-1 text-xs font-bold ${priorityClass(item.priority)}`}>{item.priority || "Medium"}</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.status || "Open"}</span></div><p className="mt-2 font-semibold">{item.title}</p><p className="text-sm text-slate-500">{employeeExperience ? item.workspace : item.requester_name || item.requester_email}</p></div><p className="text-sm font-semibold">{item.workspace || "IT"}</p><p className="text-sm font-semibold">{item.assigned_group_name || "Triage"}</p><span className="text-xs font-bold text-slate-500">{formatAge(item)}</span></button>)}</div>
            {!employeeExperience ? (
              <PaginationBar
                pagination={pagination}
                loading={loading}
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  setSelectedTicket(null);
                }}
              />
            ) : null}
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            {!selectedTicket ? <div className="rounded-2xl border bg-white p-6 text-center text-slate-500">Select a ticket to view its details.</div> : <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">{selectedTicket.ticket_ref}</p><h2 className="mt-1 text-lg font-bold">{selectedTicket.title}</h2></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(selectedTicket.status)}`}>{selectedTicket.status}</span></div><p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{selectedTicket.description || "No description"}</p><div className="mt-4 grid grid-cols-2 gap-3"><Info label="Priority" value={selectedTicket.priority} /><Info label="Workspace" value={selectedTicket.workspace} /><Info label="Group" value={selectedTicket.assigned_group_name || "Triage"} /><Info label="Assigned To" value={selectedTicket.assigned_to_name || "Unassigned"} /></div><button onClick={() => navigate(`/tickets/${selectedTicket.id}`)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><ExternalLink className="h-4 w-4" />Open Full Ticket</button>{canOperate && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <select
                    value={resolvedGroupId || ""}
                    onChange={(event) =>
                      runAction(
                        () =>
                          ticketsApi.assign(
                            selectedTicket.id,
                            selectedTicket.assigned_to_user_id || null,
                            event.target.value || null
                          ),
                        "Support group updated."
                      )
                    }
                    disabled={actionLoading}
                    className="w-full rounded-xl border px-3 py-2"
                  >
                    <option value="">Select support group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedTicket.assigned_to_user_id || ""}
                    onChange={(event) => assignTicket(event.target.value || null)}
                    disabled={actionLoading || !resolvedGroupId}
                    className="w-full rounded-xl border px-3 py-2"
                  >
                    <option value="">Unassigned</option>
                    {assigneeOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name || member.email}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      assignTicket(
                        user.id,
                        resolvedGroupId || groups[0]?.id || null
                      )
                    }
                    disabled={actionLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"
                  >
                    <UserCheck className="h-4 w-4" />
                    Assign to Me
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => runAction(() => ticketsApi.resolve(selectedTicket.id), "Ticket resolved.")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Resolve
                    </button>
                    <button
                      onClick={() => runAction(() => ticketsApi.close(selectedTicket.id), "Ticket closed.")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                    >
                      <XCircle className="h-4 w-4" />
                      Close
                    </button>
                  </div>
                </div>
              )}{selectedTicket.priority === "Critical" && <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />Critical ticket requiring priority attention.</div>}</div>}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value || "N/A"}</p></div>;
}
