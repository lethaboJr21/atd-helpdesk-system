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

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);
const STATUS_OPTIONS = [
  "Open",
  "Assigned",
  "Pending",
  "Investigating",
  "Waiting Approval",
  "Resolved",
  "Closed",
  "Escalated",
];
const STATUS_TABS = ["All", "Unresolved", ...STATUS_OPTIONS];
const PAGE_SIZE = 30;

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

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
  return (
    {
      Critical: "bg-red-100 text-red-700 border-red-200",
      High: "bg-orange-100 text-orange-700 border-orange-200",
      Medium: "bg-amber-100 text-amber-700 border-amber-200",
      Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    }[value] || "bg-slate-100 text-slate-700 border-slate-200"
  );
}

function statusClass(value) {
  return (
    {
      Open: "bg-blue-100 text-blue-700",
      Assigned: "bg-slate-100 text-slate-700",
      Pending: "bg-purple-100 text-purple-700",
      Investigating: "bg-indigo-100 text-indigo-700",
      "Waiting Approval": "bg-purple-100 text-purple-700",
      Resolved: "bg-emerald-100 text-emerald-700",
      Closed: "bg-slate-200 text-slate-700",
      Escalated: "bg-red-100 text-red-700",
    }[value] || "bg-slate-100 text-slate-700"
  );
}

function unwrapTickets(payload) {
  if (Array.isArray(payload)) {
    return { tickets: payload, pagination: null, counts: null };
  }
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
  if (current >= total - 2) {
    [total - 1, total - 2, total - 3].forEach((value) => pages.add(value));
  }
  return [...pages]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b);
}

function PaginationBar({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.total <= 0) return null;
  const pages = pageWindow(pagination.page, pagination.totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-t border-slate-200 bg-slate-50 px-4 py-2.5">
      <p className="text-sm text-slate-600">
        Page{" "}
        <span className="font-bold text-slate-950">{pagination.page}</span> of{" "}
        <span className="font-bold text-slate-950">
          {pagination.totalPages}
        </span>
        {" · "}
        <span className="font-bold text-slate-950">
          {pagination.total.toLocaleString("en-ZA")}
        </span>{" "}
        tickets
        {" · "}
        {pagination.perPage} per page
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pagination.page <= 1 || loading}
          onClick={() => onPageChange(pagination.page - 1)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 disabled:opacity-40"
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
                    ? "min-w-9 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-bold text-white"
                    : "min-w-9 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
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
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TicketRowSkeleton() {
  return (
    <div className="grid animate-pulse gap-3 border-l-4 border-transparent px-4 py-2.5 md:grid-cols-[1fr_140px_120px_70px]">
      <div>
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-3/4 rounded bg-slate-100" />
        <div className="mt-1.5 h-3 w-1/2 rounded bg-slate-100" />
      </div>
      <div className="h-4 w-28 rounded bg-slate-100" />
      <div className="h-4 w-24 rounded bg-slate-100" />
      <div className="h-3 w-12 rounded bg-slate-100" />
    </div>
  );
}

export default function TicketWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, employeeView } = useAuth();
  const operationsUser = OPERATIONS_ROLES.has(user?.role);
  const employeeExperience =
    user?.role === "user" ||
    employeeView ||
    location.pathname.startsWith("/employee");

  // Two years of imported Freshservice history shares the list with live work, so
  // staff land on unresolved tickets and reach the rest through search / Closed.
  const defaultStatus =
    searchParams.get("status") || (employeeExperience ? "All" : "Unresolved");
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    STATUS_TABS.includes(defaultStatus) ? defaultStatus : "All"
  );
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [groupsError, setGroupsError] = useState("");

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
    setLoading(true);
    setError("");
    try {
      if (employeeExperience) {
        const response = await ticketsApi.getEmployeeView();
        const data = Array.isArray(response.data) ? response.data : [];
        const filtered = data.filter((item) => {
          if (statusFilter === "All") return true;
          if (statusFilter === "Unresolved") {
            return !["Resolved", "Closed"].includes(item.status);
          }
          return item.status === statusFilter;
        });
        setTickets(filtered);
        setPagination(null);
        setCounts(null);
        setSelectedTicket(
          (current) =>
            filtered.find((item) => String(item.id) === String(current?.id)) ||
            null
        );
        return;
      }

      const response = await ticketsApi.getAll({
        page,
        per_page: PAGE_SIZE,
        status: statusFilter === "All" ? undefined : statusFilter,
        ...(appliedQuery ? { search: appliedQuery } : {}),
        ...(searchParams.get("view") === "mine" ? { view: "mine" } : {}),
      });
      const {
        tickets: data,
        pagination: nextPagination,
        counts: nextCounts,
      } = unwrapTickets(response.data);
      setTickets(data);
      setPagination(nextPagination);
      setCounts(nextCounts);
      setSelectedTicket(
        (current) =>
          data.find((item) => String(item.id) === String(current?.id)) || null
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Tickets could not be loaded."));
      setTickets([]);
      setSelectedTicket(null);
      setPagination(null);
      setCounts(null);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, employeeExperience, page, searchParams, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (!operationsUser || employeeExperience) return;
    groupsApi
      .getAll()
      .then((response) => {
        setGroups(Array.isArray(response.data) ? response.data : []);
        setGroupsError("");
      })
      .catch((requestError) =>
        setGroupsError(
          getErrorMessage(requestError, "Support groups could not be loaded.")
        )
      );
  }, [employeeExperience, operationsUser]);

  const statusCount = (status) => {
    if (counts && counts[status] != null) return counts[status];
    if (status === "All") return tickets.length;
    if (status === "Unresolved") {
      return tickets.filter(
        (item) => !["Resolved", "Closed"].includes(item.status)
      ).length;
    }
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
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
      await fetchTickets();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The ticket action failed."));
    } finally {
      setActionLoading(false);
    }
  };

  const selectedGroup =
    groups.find(
      (group) => String(group.id) === String(selectedTicket?.assigned_group_id)
    ) ||
    groups.find(
      (group) =>
        selectedTicket?.assigned_group_name &&
        String(group.name).toLowerCase() ===
          String(selectedTicket.assigned_group_name).toLowerCase()
    ) ||
    null;

  const assigneeOptions = useMemo(() => {
    const members = Array.isArray(selectedGroup?.members)
      ? [...selectedGroup.members]
      : [];
    if (
      selectedTicket?.assigned_to_user_id &&
      !members.some(
        (member) =>
          String(member.id) === String(selectedTicket.assigned_to_user_id)
      )
    ) {
      members.unshift({
        id: selectedTicket.assigned_to_user_id,
        name: selectedTicket.assigned_to_name || "Current assignee",
        email: selectedTicket.assigned_to_email || "",
      });
    }
    return members;
  }, [selectedGroup, selectedTicket]);

  const resolvedGroupId =
    selectedTicket?.assigned_group_id || selectedGroup?.id || null;
  const canOperate = operationsUser && !employeeExperience;
  const canAssignToSelf = Boolean(resolvedGroupId);

  const assignTicket = (assigneeId, groupId = resolvedGroupId) =>
    runAction(
      () =>
        ticketsApi.assign(
          selectedTicket.id,
          assigneeId || null,
          groupId || null
        ),
      assigneeId ? "Ticket assignment updated." : "Ticket unassigned."
    );

  const changeSupportGroup = (groupId) => {
    const nextGroup = groups.find(
      (group) => String(group.id) === String(groupId)
    );
    const members = Array.isArray(nextGroup?.members) ? nextGroup.members : [];
    const currentAssigneeStillValid =
      selectedTicket?.assigned_to_user_id &&
      members.some(
        (member) =>
          String(member.id) === String(selectedTicket.assigned_to_user_id)
      );
    const nextAssigneeId = currentAssigneeStillValid
      ? selectedTicket.assigned_to_user_id
      : null;

    return runAction(
      () =>
        ticketsApi.assign(
          selectedTicket.id,
          nextAssigneeId,
          groupId || null
        ),
      "Support group updated."
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <header className="mx-auto flex max-w-[1650px] flex-wrap items-start justify-between gap-4">
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
            className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </button>
          <p className="text-sm text-slate-500">
            Helpdesk /{" "}
            {employeeExperience ? "My Tickets" : "Ticket Workspace"}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {employeeExperience ? "My Tickets" : "Ticket Workspace"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {employeeExperience
              ? "Track support requests created for your account."
              : "Review, triage, assign and manage all authorised tickets."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchTickets}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate("/tickets/new?type=incident")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-[1650px]">
        {error && (
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"
            role="status"
          >
            {success}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="relative min-w-[260px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tickets"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3 [scrollbar-width:thin]">
              {STATUS_TABS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => changeFilter(status)}
                  className={classNames(
                    "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold",
                    statusFilter === status
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {status}
                  <span
                    className={classNames(
                      "ml-2 rounded-full px-2 py-0.5 text-xs",
                      statusFilter === status
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500"
                    )}
                  >
                    {statusCount(status)}
                  </span>
                </button>
              ))}
            </div>

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

            <div className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
              {loading ? (
                Array.from({ length: 8 }, (_, index) => (
                  <TicketRowSkeleton key={index} />
                ))
              ) : tickets.length === 0 ? (
                <div className="p-10 text-center">
                  <Ticket className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 font-bold text-slate-950">
                    No tickets found
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try another status filter or clear the search.
                  </p>
                </div>
              ) : (
                tickets.map((item) => {
                  const selected =
                    String(selectedTicket?.id) === String(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedTicket((current) =>
                          String(current?.id) === String(item.id)
                            ? null
                            : item
                        )
                      }
                      onDoubleClick={() => navigate(`/tickets/${item.id}`)}
                      className={classNames(
                        "grid w-full gap-3 border-l-4 px-4 py-2.5 text-left transition md:grid-cols-[1fr_140px_120px_70px] md:items-center",
                        selected
                          ? "border-blue-600 bg-blue-50/70"
                          : "border-transparent hover:bg-slate-50"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-blue-700">
                            {item.ticket_ref || `TICKET-${item.id}`}
                          </span>
                          <span
                            className={classNames(
                              "whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold",
                              priorityClass(item.priority)
                            )}
                          >
                            {item.priority || "Medium"}
                          </span>
                          <span
                            className={classNames(
                              "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold",
                              statusClass(item.status)
                            )}
                          >
                            {item.status || "Open"}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-semibold text-slate-950">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {employeeExperience
                            ? item.workspace
                            : item.requester_name ||
                              item.requester_email ||
                              "Unknown requester"}
                          {!employeeExperience
                            ? ` · ${item.assigned_group_name || item.workspace || "No group"}`
                            : null}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {item.assigned_to_name || "Unassigned"}
                        </p>
                        <p className="text-xs text-slate-500">Assigned agent</p>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {item.workspace || "IT"}
                        </p>
                        <p className="text-xs text-slate-500">Workspace</p>
                      </div>

                      <span className="text-xs font-bold text-slate-500">
                        {formatAge(item)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

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
            {!selectedTicket ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <Ticket className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-950">
                  Select a ticket to view its details
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Click a row to preview it here. Double-click to open the full
                  case.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-700">
                      {selectedTicket.ticket_ref}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">
                      {selectedTicket.title}
                    </h2>
                  </div>
                  <span
                    className={classNames(
                      "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold",
                      statusClass(selectedTicket.status)
                    )}
                  >
                    {selectedTicket.status}
                  </span>
                </div>

                <p className="mt-3 line-clamp-6 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                  {selectedTicket.description || "No description"}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Info label="Priority" value={selectedTicket.priority} />
                  <Info label="Workspace" value={selectedTicket.workspace} />
                  <Info
                    label="Group"
                    value={selectedTicket.assigned_group_name || "No group"}
                  />
                  <Info
                    label="Assigned To"
                    value={selectedTicket.assigned_to_name || "Unassigned"}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/tickets/${selectedTicket.id}`)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Full Ticket
                </button>

                {canOperate && (
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                    {(groupsError || !resolvedGroupId) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        {groupsError ||
                          "Choose a support group before assigning an agent."}
                      </div>
                    )}

                    <select
                      value={resolvedGroupId || ""}
                      onChange={(event) =>
                        changeSupportGroup(event.target.value || null)
                      }
                      disabled={actionLoading || Boolean(groupsError)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
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
                      onChange={(event) =>
                        assignTicket(event.target.value || null)
                      }
                      disabled={
                        actionLoading || !resolvedGroupId || Boolean(groupsError)
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {assigneeOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => assignTicket(user.id, resolvedGroupId)}
                      disabled={
                        actionLoading || !canAssignToSelf || Boolean(groupsError)
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <UserCheck className="h-4 w-4" />
                      Assign to Me
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          runAction(
                            () => ticketsApi.resolve(selectedTicket.id),
                            "Ticket resolved."
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Resolve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          runAction(
                            () => ticketsApi.close(selectedTicket.id),
                            "Ticket closed."
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {selectedTicket.priority === "Critical" && (
                  <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Critical ticket requiring priority attention.
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">
        {value || "N/A"}
      </p>
    </div>
  );
}
