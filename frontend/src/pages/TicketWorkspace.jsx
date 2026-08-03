import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Ticket,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { ticketsApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const OPERATIONS_ROLES = new Set(["agent", "operator", "manager", "admin", "superadmin"]);
const CLOSED = new Set(["Resolved", "Closed"]);

const QUEUES = [
  { id: "unresolved", label: "Unresolved" },
  { id: "overdue", label: "Overdue" },
  { id: "unassigned", label: "Unassigned" },
  { id: "mine", label: "My open" },
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "all", label: "All tickets" },
];

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

function formatAge(ticket) {
  if (ticket?.age) return ticket.age;
  const created = new Date(ticket?.created_at).getTime();
  if (!Number.isFinite(created)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function formatDue(ticket) {
  if (!ticket?.due_at) return "—";
  const due = new Date(ticket.due_at);
  if (!Number.isFinite(due.getTime())) return "—";
  return due.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priorityClass(value) {
  return (
    {
      Critical: "bg-red-100 text-red-700",
      High: "bg-orange-100 text-orange-700",
      Medium: "bg-amber-100 text-amber-800",
      Low: "bg-emerald-100 text-emerald-700",
    }[value] || "bg-slate-100 text-slate-700"
  );
}

function statusClass(value) {
  return (
    {
      Open: "bg-blue-100 text-blue-700",
      Assigned: "bg-sky-100 text-sky-800",
      Pending: "bg-purple-100 text-purple-700",
      Investigating: "bg-indigo-100 text-indigo-700",
      "Waiting Approval": "bg-violet-100 text-violet-700",
      Resolved: "bg-emerald-100 text-emerald-700",
      Closed: "bg-slate-200 text-slate-700",
      Escalated: "bg-red-100 text-red-700",
    }[value] || "bg-slate-100 text-slate-700"
  );
}

function matchesQueue(ticket, queue, userId) {
  const open = !CLOSED.has(ticket.status);
  switch (queue) {
    case "unresolved":
      return open;
    case "overdue":
      return open && Boolean(ticket.overdue);
    case "unassigned":
      return open && !ticket.assigned_to_user_id;
    case "mine":
      return open && String(ticket.assigned_to_user_id) === String(userId);
    case "open":
      return ticket.status === "Open";
    case "pending":
      return ticket.status === "Pending";
    case "all":
      return true;
    default:
      return ticket.status === queue;
  }
}

export default function TicketWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, employeeView } = useAuth();
  const operationsUser = OPERATIONS_ROLES.has(user?.role);
  const employeeExperience =
    user?.role === "user" || employeeView || location.pathname.startsWith("/employee");

  const requestedQueue = searchParams.get("queue") || searchParams.get("view");
  const defaultQueue = employeeExperience ? "all" : "unresolved";
  const queue = QUEUES.some((item) => item.id === requestedQueue)
    ? requestedQueue
    : defaultQueue;

  const [tickets, setTickets] = useState([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setAppliedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = employeeExperience
        ? await ticketsApi.getEmployeeView()
        : await ticketsApi.getAll({
            limit: 500,
            ...(appliedQuery ? { search: appliedQuery } : {}),
          });
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Tickets could not be loaded."));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, employeeExperience]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filteredTickets = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tickets
      .filter((item) => matchesQueue(item, queue, user?.id))
      .filter((item) => {
        if (!search) return true;
        const haystack = [
          item.ticket_ref,
          item.title,
          item.description,
          item.priority,
          item.status,
          item.workspace,
          item.requester_name,
          item.requester_email,
          item.assigned_to_name,
          item.assigned_group_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => {
        const rank = { Critical: 1, High: 2, Medium: 3, Low: 4 };
        const byPriority = (rank[a.priority] || 5) - (rank[b.priority] || 5);
        if (byPriority) return byPriority;
        if (Boolean(b.overdue) !== Boolean(a.overdue)) return a.overdue ? -1 : 1;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
  }, [tickets, queue, query, user?.id]);

  const queueCount = (id) =>
    tickets.filter((item) => matchesQueue(item, id, user?.id)).length;

  const changeQueue = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultQueue) next.delete("queue");
    else next.set("queue", value);
    setSearchParams(next, { replace: true });
  };

  const openTicket = (ticket) => navigate(`/tickets/${ticket.id}`);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4 xl:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() =>
                navigate(
                  employeeExperience
                    ? user?.role === "user"
                      ? "/"
                      : "/employee"
                    : "/"
                )
              }
              className="mb-3 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              {employeeExperience ? "My Tickets" : "Tickets"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {employeeExperience
                ? "Support requests raised for your account."
                : "Freshservice-style inbox — open a row to work the ticket."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchTickets}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/tickets/new?type=incident")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#12344d] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0c2434]"
            >
              <Plus className="h-4 w-4" />
              New ticket
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-5 xl:px-8">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {!employeeExperience ? (
          <section className="mb-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {QUEUES.filter((item) => item.id !== "all").map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeQueue(item.id)}
                className={`rounded-lg border px-3 py-3 text-left ${
                  queue === item.id
                    ? "border-[#2c5cc5] bg-[#e5f0ff]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-950">
                  {queueCount(item.id)}
                </p>
              </button>
            ))}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by ID, subject, requester, agent…"
                className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2c5cc5]"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(employeeExperience
                ? [
                    { id: "all", label: "All" },
                    { id: "unresolved", label: "Open" },
                    { id: "pending", label: "Pending" },
                  ]
                : QUEUES
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeQueue(item.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    queue === item.id
                      ? "bg-[#12344d] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 text-xs opacity-80">{queueCount(item.id)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">{employeeExperience ? "Workspace" : "Requester"}</th>
                  {!employeeExperience ? <th className="px-4 py-3">Agent</th> : null}
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-16 text-center text-slate-500">
                      Loading tickets…
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-16 text-center text-slate-500">
                      <Ticket className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                      No tickets in this view
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openTicket(item)}
                      className={`cursor-pointer hover:bg-[#f5f8fc] ${
                        item.overdue ? "bg-red-50/50" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#2c5cc5]">
                        {item.ticket_ref || `TICKET-${item.id}`}
                      </td>
                      <td className="max-w-[320px] px-4 py-3">
                        <p className="truncate font-semibold text-slate-900">{item.title}</p>
                        {item.overdue ? (
                          <p className="mt-0.5 text-xs font-semibold text-red-600">Overdue</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {employeeExperience
                          ? item.workspace || "IT"
                          : item.requester_name || item.requester_email || "—"}
                      </td>
                      {!employeeExperience ? (
                        <td className="px-4 py-3 text-slate-600">
                          {item.assigned_to_name || (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-slate-600">
                        {item.assigned_group_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${statusClass(
                            item.status
                          )}`}
                        >
                          {item.status || "Open"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${priorityClass(
                            item.priority
                          )}`}
                        >
                          {item.priority || "Medium"}
                        </span>
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 ${
                          item.overdue ? "font-semibold text-red-600" : "text-slate-600"
                        }`}
                      >
                        {formatDue(item)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatAge(item)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {operationsUser && !employeeExperience ? (
          <p className="mt-3 text-xs text-slate-400">
            Showing {filteredTickets.length} ticket
            {filteredTickets.length === 1 ? "" : "s"}. Click a row to open it.
          </p>
        ) : null}
      </main>
    </div>
  );
}
