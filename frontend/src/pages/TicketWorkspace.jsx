import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  Columns3,
  BarChart3,
  Eye,
  Filter,
  Maximize2,
  PanelRightClose,
  Pin,
  PinOff,
  List,
  SquareCheck,
  RotateCcw,
  X,
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

import OperationsShell from "../components/OperationsShell";
import StickyListShell, { StickyListBody, StickyListFooter } from "../components/lists/StickyListShell";
import RequestEntryMenu from "../components/tickets/RequestEntryMenu";
import BulkTicketActions from "../components/tickets/BulkTicketActions";
import AdvancedTicketFilterBar from "../components/tickets/AdvancedTicketFilterBar";
import { moduleForTicketType } from "../data/requestModules";
import { groupsApi, ticketsApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/notifications/ToastProvider";
import useCrossPageTicketSelection from "../hooks/useCrossPageTicketSelection";
import { showLatestTicketActivity } from "../components/notifications/ticketActivityToast";

function initialsFor(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

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
const UNRESOLVED_STATUSES = STATUS_OPTIONS.filter(
  (status) => !["Resolved", "Closed"].includes(status)
);
const STATUS_OPTION_KEYS = new Set(STATUS_OPTIONS);
const PAGE_SIZES = [25, 50, 100, 250, 500];
const DEFAULT_PAGE_SIZE = 25;

function normalizeStatusSelection(values, fallback = []) {
  const clean = [...new Set(values)].filter((value) => STATUS_OPTION_KEYS.has(value));
  return clean.length ? clean : [...fallback];
}

function sameStatuses(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
const ASSIGNMENT_SCOPES = [
  { key: "all", label: "All Tickets" },
  { key: "mine", label: "Assigned to Me" },
  { key: "unassigned", label: "Unassigned" },
  { key: "my-groups", label: "My Support Groups" },
];
const ASSIGNMENT_SCOPE_KEYS = new Set(
  ASSIGNMENT_SCOPES.map((item) => item.key)
);
const LEGACY_ASSIGNMENT_SCOPE_ALIASES = {
  "assigned-to-me": "mine",
  "my-groups": "my-groups",
  "my-support-groups": "my-groups",
};

function getLegacyAssignmentScope(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ _]+/g, "-");

  return LEGACY_ASSIGNMENT_SCOPE_ALIASES[key] || null;
}
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
      Critical: "portal-priority-critical",
      High: "portal-priority-high",
      Medium: "portal-priority-medium",
      Low: "portal-priority-low",
    }[value] || "bg-slate-100 text-slate-700 border-slate-200"
  );
}

function formatDue(value) {
  if (!value || value === 0 || value === "0") return "Not set";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() >= 86400000
    ? parsed.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
    : "Not set";
}

function slaState(ticket, now = Date.now()) {
  const started = new Date(ticket?.sla_calculated_at || ticket?.created_at).getTime();
  const due = new Date(ticket?.due_at || ticket?.sla?.resolutionDueAt).getTime();
  const active = !["Resolved", "Closed"].includes(ticket?.status);
  if (!Number.isFinite(started) || !Number.isFinite(due) || due <= started) {
    return { percent: null, tone: "normal", overdue: false, label: "SLA countdown unavailable" };
  }
  const percent = Math.max(0, Math.min(100, Math.round(((due - now) / (due - started)) * 100)));
  const overdue = active && now >= due;
  const tone = overdue ? "breached" : percent <= 25 ? "risk" : percent <= 50 ? "attention" : "normal";
  return { percent, tone, overdue, label: overdue ? `Overdue since ${formatDue(due)}` : `${percent}% SLA time remaining` };
}

function statusClass(value) {
  return (
    {
      Open: "portal-accent-fill bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]",
      Assigned: "bg-slate-100 text-slate-700",
      Pending: "bg-amber-100 text-amber-800",
      Investigating: "portal-accent-fill bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]",
      "Waiting Approval": "bg-amber-100 text-amber-800",
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

function PaginationBar({ pagination, loading, onPageChange, pageSize, onPageSizeChange }) {
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
        <label className="mr-2 text-xs font-bold text-slate-600">Rows <select value={pageSize} disabled={loading} onChange={(event)=>onPageSizeChange(Number(event.target.value))} className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">{PAGE_SIZES.map((size)=><option key={size} value={size}>{size}</option>)}</select></label>
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
                    ? "min-w-9 rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-3 py-1.5 text-sm font-bold text-white"
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
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, employeeView, logout } = useAuth();
  const operationsUser = OPERATIONS_ROLES.has(user?.role);
  const employeeExperience =
    user?.role === "user" ||
    employeeView ||
    location.pathname.startsWith("/employee");

  // Two years of imported Freshservice history shares the list with live work, so
  // staff land on unresolved tickets and reach the rest through search / Closed.
  const legacyStatus = searchParams.get("status");
  const legacyAssignment = getLegacyAssignmentScope(legacyStatus);
  const statusQuery = searchParams.get("statuses");
  const defaultStatuses = statusQuery
    ? normalizeStatusSelection(statusQuery.split(","))
    : legacyAssignment
      ? []
      : legacyStatus === "All"
      ? []
      : legacyStatus === "Unresolved" || (!legacyStatus && !employeeExperience)
        ? [...UNRESOLVED_STATUSES]
        : legacyStatus && STATUS_OPTION_KEYS.has(legacyStatus)
          ? [legacyStatus]
          : [];
  const requestedAssignmentScope =
    searchParams.get("assignment") ||
    legacyAssignment ||
    (searchParams.get("view") === "mine" ? "mine" : "all");
  const defaultAssignmentScope = ASSIGNMENT_SCOPE_KEYS.has(
    requestedAssignmentScope
  )
    ? requestedAssignmentScope
    : "all";
  const defaultPage = Math.max(Number(searchParams.get("page")) || 1, 1);
  const defaultQuery = searchParams.get("search") || "";
  const defaultPriority = ["Low", "Medium", "High", "Critical"].includes(searchParams.get("priority"))
    ? searchParams.get("priority")
    : "";
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [query, setQuery] = useState(defaultQuery);
  const [assignmentScope, setAssignmentScope] = useState(
    defaultAssignmentScope
  );
  const [selectedStatuses, setSelectedStatuses] = useState(defaultStatuses);
  const [selectedPriority] = useState(defaultPriority);
  const [page, setPage] = useState(defaultPage);
  const [pagination, setPagination] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [groupsError, setGroupsError] = useState("");
  const [requestEntryOpen, setRequestEntryOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [advancedFilters,setAdvancedFilters]=useState(()=>({view:searchParams.get("view")||"unresolved",search:defaultQuery,requester:searchParams.get("requester")||"",department:searchParams.get("department")||"",source:searchParams.get("source")||"",type:searchParams.get("type")||"",priority:searchParams.get("priority")||defaultPriority,sort:searchParams.get("sort")||"created_at",direction:searchParams.get("direction")||"desc"}));
  const [workspaceView, setWorkspaceView] = useState(() => localStorage.getItem("atd-ticket-workspace-view") === "kanban" ? "kanban" : "list");
  const [panelMode,setPanelMode]=useState(()=>localStorage.getItem("atd-ticket-workspace-panel-mode") || (localStorage.getItem("atd-ticket-preview-visible") === "false" ? "hidden" : "preview"));
  const [panelPinned,setPanelPinned]=useState(()=>localStorage.getItem("atd-ticket-workspace-panel-pinned")!=="false");
  const [panelWidth,setPanelWidth]=useState(()=>Math.min(640,Math.max(360,Number(localStorage.getItem("atd-ticket-workspace-panel-width"))||460)));
  const listScrollRef=useRef(null);
  const [selectMode, setSelectMode] = useState(false);
  const selection = useCrossPageTicketSelection();
  const [pageSize,setPageSize]=useState(()=>{const value=Number(localStorage.getItem("atd-ticket-workspace-page-size"));return PAGE_SIZES.includes(value)?value:DEFAULT_PAGE_SIZE;});
  const [draftAssignmentScope, setDraftAssignmentScope] = useState(
    defaultAssignmentScope
  );
  const [draftStatuses, setDraftStatuses] = useState(defaultStatuses);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [dropTarget, setDropTarget] = useState("");
  const filterPanelRef = useRef(null);
  const ticketClickTimerRef = useRef(null);
  const lastSingleClickRef = useRef({ ticketId: null, clickedAt: 0 });
  const [doubleClickGuidance, setDoubleClickGuidance] = useState("");

  // The search term goes to the server because history reaches back to June 2024.
  const [appliedQuery, setAppliedQuery] = useState(
    defaultQuery.trim()
  );

  useEffect(() => {
    if (!legacyAssignment) return;

    const next = new URLSearchParams(searchParams);

    next.delete("status");
    next.delete("view");
    next.delete("page");
    next.set("assignment", legacyAssignment);

    setPage(1);
    setSearchParams(next, { replace: true });
  }, [legacyAssignment, searchParams, setSearchParams]);

  useEffect(() => {

    const timer = setTimeout(() => {
      const nextQuery = query.trim();
      if (nextQuery === appliedQuery) return;
      setAppliedQuery(nextQuery);
      setPage(1);
      setSelectedTicket(null);
      setSearchParams((currentParams) => {
        const next = new URLSearchParams(currentParams);
        if (nextQuery) next.set("search", nextQuery);
        else next.delete("search");
        next.delete("page");
        return next;
      }, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [appliedQuery, query, setSearchParams]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (employeeExperience) {
        const response = await ticketsApi.getEmployeeView();
        const data = Array.isArray(response.data) ? response.data : [];
        const filtered = data.filter(
          (item) => !selectedStatuses.length || selectedStatuses.includes(item.status)
        );
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
        per_page: pageSize,
        ...(selectedStatuses.length
          ? { statuses: selectedStatuses.join(",") }
          : {}),
        ...(appliedQuery ? { search: appliedQuery } : {}),
        ...(advancedFilters.priority || selectedPriority ? { priority: advancedFilters.priority || selectedPriority } : {}),
        ...(assignmentScope !== "all" ? { assignmentScope } : {}),
        requester: advancedFilters.requester || undefined, department: advancedFilters.department || undefined, source: advancedFilters.source || undefined, type: advancedFilters.type || undefined, sort: advancedFilters.sort, direction: advancedFilters.direction, view: advancedFilters.view,
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
  }, [advancedFilters, appliedQuery, assignmentScope, employeeExperience, page, pageSize, selectedPriority, selectedStatuses]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => { localStorage.setItem("atd-ticket-workspace-view", workspaceView); }, [workspaceView]);
  useEffect(()=>localStorage.setItem("atd-ticket-workspace-panel-mode",panelMode),[panelMode]);
  useEffect(()=>localStorage.setItem("atd-ticket-workspace-panel-pinned",String(panelPinned)),[panelPinned]);
  useEffect(()=>localStorage.setItem("atd-ticket-workspace-panel-width",String(panelWidth)),[panelWidth]);
  useEffect(()=>{const saved=Number(sessionStorage.getItem("atd-ticket-workspace-scroll"));if(listScrollRef.current&&Number.isFinite(saved))listScrollRef.current.scrollTop=saved;return()=>{if(listScrollRef.current)sessionStorage.setItem("atd-ticket-workspace-scroll",String(listScrollRef.current.scrollTop));};},[]);
  const toggleTicketSelection=(id)=>{const ticket=tickets.find((item)=>String(item.id)===String(id));if(ticket)selection.toggle(ticket);};

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

  useEffect(() => {
    if (!filterPanelOpen) return undefined;

    const closeOnPointer = (event) => {
      if (!filterPanelRef.current?.contains(event.target)) {
        setFilterPanelOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setFilterPanelOpen(false);
    };

    document.addEventListener("mousedown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filterPanelOpen]);

  const activeAssignmentLabel =
    ASSIGNMENT_SCOPES.find((scope) => scope.key === assignmentScope)?.label ||
    "All Tickets";
  const unresolvedSelected = sameStatuses(selectedStatuses, UNRESOLVED_STATUSES);
  const activeStatusLabel = !selectedStatuses.length
    ? "All statuses"
    : unresolvedSelected
      ? "Unresolved"
      : selectedStatuses.length === 1
        ? selectedStatuses[0]
        : `${selectedStatuses.length} statuses`;
  const activeFilterCount =
    (assignmentScope === "all" ? 0 : 1) + (selectedStatuses.length ? 1 : 0);
  const hasSearchOrStatusFilter = Boolean(appliedQuery) || selectedStatuses.length > 0;

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

  const toggleDraftStatus = (value) => {
    setDraftStatuses((current) =>
      current.includes(value)
        ? current.filter((status) => status !== value)
        : [...current, value]
    );
  };

  const applyTicketFilters = () => {
    const nextAssignment = ASSIGNMENT_SCOPE_KEYS.has(draftAssignmentScope)
      ? draftAssignmentScope
      : "all";
    const nextStatuses = normalizeStatusSelection(draftStatuses);

    setAssignmentScope(nextAssignment);
    setSelectedStatuses(nextStatuses);
    setPage(1);
    setSelectedTicket(null);
    setFilterPanelOpen(false);

    const next = new URLSearchParams(searchParams);
    next.delete("view");
    next.delete("status");
    if (nextAssignment === "all") next.delete("assignment");
    else next.set("assignment", nextAssignment);
    if (nextStatuses.length) next.set("statuses", nextStatuses.join(","));
    else next.delete("statuses");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const clearDraftTicketFilters = () => {
    setDraftAssignmentScope("all");
    setDraftStatuses([]);
  };

  const cancelTicketFilters = () => {
    setDraftAssignmentScope(assignmentScope);
    setDraftStatuses(selectedStatuses);
    setFilterPanelOpen(false);
  };

  const resetAppliedTicketFilters = () => {
    setDraftAssignmentScope("all");
    setAssignmentScope("all");
    setDraftStatuses([]);
    setSelectedStatuses([]);
    setQuery("");
    setAppliedQuery("");
    setPage(1);
    setSelectedTicket(null);
    setFilterPanelOpen(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const changePage = (nextPage) => {
    const safePage = Math.max(Number(nextPage) || 1, 1);
    setPage(safePage);
    setSelectedTicket(null);
    const next = new URLSearchParams(searchParams);
    if (safePage === 1) next.delete("page");
    else next.set("page", String(safePage));
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
  const canDeleteTickets = user?.role === "superadmin";
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

  const moveTicketToStatus = async (ticket, nextStatus) => {
    const previousStatus = ticket?.status || "Open";
    if (!canOperate || !ticket?.id || !STATUS_OPTION_KEYS.has(nextStatus) || previousStatus === nextStatus) return;
    const reference = ticket.ticket_ref || `TICKET-${ticket.id}`;
    if (!["Resolved", "Closed"].includes(previousStatus) && ["Resolved", "Closed"].includes(nextStatus)) {
      setError(`Open ${reference} and use the governed ${nextStatus} workflow so required resolution communication is not bypassed.`);
      return;
    }
    if (!window.confirm(`Move ${reference} from ${previousStatus} to ${nextStatus}?`)) return;
    setActionLoading(true); setError(""); setSuccess("");
    try {
      await ticketsApi.updateStatus(ticket.id, nextStatus);
      setSuccess(`${reference} moved from ${previousStatus} to ${nextStatus}.`);
      await fetchTickets();
      await showLatestTicketActivity({ toast, ticketsApi, ticketId: ticket.id, ticketRef: reference, fallback: `Status changed from ${previousStatus} to ${nextStatus}.` });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The ticket status could not be changed."));
      await fetchTickets();
    } finally {
      setActionLoading(false); setDraggedTicket(null); setDropTarget("");
    }
  };

  const selectTicketForPreview = (item) => {
    const now = Date.now();
    const sameTicket =
      String(lastSingleClickRef.current.ticketId) === String(item.id);
    const withinGuidanceWindow =
      now - lastSingleClickRef.current.clickedAt <= 1600;

    setSelectedTicket(item);

    if (sameTicket && withinGuidanceWindow) {
      setDoubleClickGuidance(
        "Double-click the ticket to open the full ticket."
      );
      window.setTimeout(() => setDoubleClickGuidance(""), 3500);
    }

    lastSingleClickRef.current = {
      ticketId: item.id,
      clickedAt: now,
    };
  };

  const openFullTicket = (item) => {
    if (ticketClickTimerRef.current) {
      window.clearTimeout(ticketClickTimerRef.current);
      ticketClickTimerRef.current = null;
    }
    setDoubleClickGuidance("");
    navigate(`/tickets/${item.id}`);
  };

  useEffect(() => () => {
    if (ticketClickTimerRef.current) {
      window.clearTimeout(ticketClickTimerRef.current);
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const pageTitle = employeeExperience ? "My Tickets" : "Ticket Workspace";
  const pageSubtitle = employeeExperience
    ? "Track support requests created for your account."
    : "Review, triage, assign and manage all authorised tickets.";

  return (
    <OperationsShell
      breadcrumb={`Helpdesk / ${pageTitle}`}
      title={pageTitle}
      subtitle={pageSubtitle}
      contentOverflow="hidden"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 lg:px-4 lg:py-3 xl:px-6 xl:py-4"
      actions={
        <>
          <button
            type="button"
            onClick={fetchTickets}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 xl:px-4 xl:py-2.5"
          >
            <RefreshCw
              className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 xl:px-4 xl:py-2.5"
          >
            Logout
          </button>
          <button
            type="button"
            onClick={() => setRequestEntryOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-3 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 xl:px-4 xl:py-2.5"
          >
            <Plus className="h-4 w-4" />
            Create Request
          </button>
        </>
      }
    >
      {(error || success) && (
        <div className="mb-3 shrink-0 space-y-2">
          {error ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              <div>
                <p className="font-bold">Tickets could not be loaded.</p>
                <p className="mt-0.5">{error}</p>
              </div>
              <button
                type="button"
                onClick={fetchTickets}
                disabled={loading}
                className="rounded-xl border border-red-300 bg-white px-3 py-2 font-bold hover:bg-red-100 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          ) : null}
          {success ? (
            <div
              className="fixed left-1/2 top-20 z-[90] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-2xl backdrop-blur"
              role="status"
            >
              {success}
            </div>
          ) : null}
        </div>
      )}

      {/* Laptop: stacked list then preview. Monitor (xl+): side-by-side triage. */}
      <div
        className={classNames(
          "grid min-h-0 w-full flex-1 gap-3 lg:gap-4",
          panelMode !== "hidden"
            ? "ticket-workspace-with-panel"
            : "grid-cols-1"
        )}
      >
        <div ref={listScrollRef} onScroll={(event)=>sessionStorage.setItem("atd-ticket-workspace-scroll",String(event.currentTarget.scrollTop))} className="min-h-0 overflow-auto"><StickyListShell label={employeeExperience ? "My tickets" : "Ticket workspace results"} className="xl:min-h-0">
          {!employeeExperience ? <AdvancedTicketFilterBar value={advancedFilters} onChange={setAdvancedFilters} onApply={()=>{const presets={unresolved:{assignment:"all",statuses:[...UNRESOLVED_STATUSES]},mine:{assignment:"mine",statuses:[...UNRESOLVED_STATUSES]},"my-groups":{assignment:"my-groups",statuses:[...UNRESOLVED_STATUSES]},today:{assignment:"all",statuses:[...UNRESOLVED_STATUSES]},overdue:{assignment:"all",statuses:[...UNRESOLVED_STATUSES]},"aged-seven":{assignment:"all",statuses:[...UNRESOLVED_STATUSES]},"aged-overdue":{assignment:"all",statuses:[...UNRESOLVED_STATUSES]},high:{assignment:"all",statuses:[...UNRESOLVED_STATUSES]},all:{assignment:"all",statuses:[]}};const preset=presets[advancedFilters.view]||presets.unresolved;setAssignmentScope(preset.assignment);setDraftAssignmentScope(preset.assignment);setSelectedStatuses(preset.statuses);setDraftStatuses(preset.statuses);const next=new URLSearchParams(searchParams);next.delete("status");if(preset.assignment==="all")next.delete("assignment");else next.set("assignment",preset.assignment);if(preset.statuses.length)next.set("statuses",preset.statuses.join(","));else next.delete("statuses");Object.entries(advancedFilters).forEach(([key,value])=>value?next.set(key,value):next.delete(key));setQuery(advancedFilters.search||"");setAppliedQuery((advancedFilters.search||"").trim());next.delete("page");setPage(1);setSearchParams(next,{replace:true});}} onReset={()=>{const reset={view:"unresolved",search:"",requester:"",department:"",source:"",type:"",priority:"",sort:"created_at",direction:"desc"};setAdvancedFilters(reset);setQuery("");setAppliedQuery("");setPage(1);setSearchParams(new URLSearchParams(),{replace:true});}} /> : null}
          <div className="shrink-0 border-b border-slate-200 px-3 py-2.5 xl:px-4 xl:py-3">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tickets"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--portal-primary)]/40 focus:bg-white focus:ring-4 focus:ring-[#172b57]/15 xl:py-2.5"
              />
            </div>
          </div>


          {!employeeExperience ? (
            <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-3 py-2.5 xl:px-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Active filters
                </p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {activeStatusLabel} | {activeAssignmentLabel}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setSelectMode((current) => !current); selection.clear(); }} className={classNames("portal-control inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold", selectMode && "portal-selected")}><SquareCheck className="h-4 w-4"/>Select</button><div className="portal-surface-muted inline-flex rounded-xl border p-1"><button type="button" aria-pressed={workspaceView === "list"} onClick={() => setWorkspaceView("list")} className={classNames("rounded-lg px-2.5 py-1.5 text-xs font-bold", workspaceView === "list" && "portal-selected")}><List className="mr-1 inline h-3.5 w-3.5"/>List</button><button type="button" aria-pressed={workspaceView === "kanban"} onClick={() => setWorkspaceView("kanban")} className={classNames("rounded-lg px-2.5 py-1.5 text-xs font-bold", workspaceView === "kanban" && "portal-selected")}><Columns3 className="mr-1 inline h-3.5 w-3.5"/>Kanban</button></div><div className="portal-surface-muted inline-flex flex-wrap rounded-xl border p-1" aria-label="Ticket workspace panel mode"><button type="button" aria-pressed={panelMode==="preview"} onClick={()=>setPanelMode("preview")} className={classNames("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold",panelMode==="preview"&&"portal-selected")}><Eye className="h-3.5 w-3.5"/>Ticket Preview</button><button type="button" aria-pressed={panelMode==="statistics"} onClick={()=>setPanelMode("statistics")} className={classNames("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold",panelMode==="statistics"&&"portal-selected")}><BarChart3 className="h-3.5 w-3.5"/>Ticket Statistics</button><button type="button" aria-pressed={panelMode==="hidden"} onClick={()=>setPanelMode("hidden")} className={classNames("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold",panelMode==="hidden"&&"portal-selected")}><PanelRightClose className="h-3.5 w-3.5"/>Hide Panel</button></div><div ref={filterPanelRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDraftAssignmentScope(assignmentScope);
                    setDraftStatuses(selectedStatuses);
                    setFilterPanelOpen((current) => !current);
                  }}
                  aria-expanded={filterPanelOpen}
                  aria-haspopup="dialog"
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold shadow-sm transition",
                    activeFilterCount
                      ? "border-[var(--portal-primary)] portal-accent-fill bg-[var(--portal-primary)] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Filter className="h-4 w-4" />
                  Filter
                  {activeFilterCount ? (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>

                {filterPanelOpen ? (
                  <section
                    role="dialog"
                    aria-label="Ticket filters"
                    className="fixed inset-x-3 bottom-3 top-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-text)] shadow-2xl sm:inset-x-auto sm:left-auto sm:right-4 sm:bottom-4 sm:top-24 sm:w-[min(28rem,calc(100vw-2rem))]"
                  >
                    <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between border-b border-[var(--portal-border)] bg-[var(--portal-surface)] p-4">
                      <div>
                        <p className="font-bold text-slate-950">Filter tickets</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Combine compatible statuses with one assignment scope.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={cancelTicketFilters}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        aria-label="Close filters"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </header>

                    <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Ticket status
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setDraftStatuses([])}
                              className={classNames(
                                "rounded-lg border px-2.5 py-1 text-xs font-bold",
                                !draftStatuses.length
                                  ? "border-[var(--portal-primary)] portal-accent-fill bg-[var(--portal-primary)] text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              )}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setDraftStatuses([...UNRESOLVED_STATUSES])}
                              className={classNames(
                                "rounded-lg border px-2.5 py-1 text-xs font-bold",
                                sameStatuses(draftStatuses, UNRESOLVED_STATUSES)
                                  ? "border-[var(--portal-primary)] portal-accent-fill bg-[var(--portal-primary)] text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              )}
                            >
                              Unresolved
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 min-[420px]:grid-cols-2">
                          {STATUS_OPTIONS.map((status) => {
                            const selected = draftStatuses.includes(status);
                            return (
                              <button
                                key={status}
                                type="button"
                                role="checkbox"
                                aria-checked={selected}
                                onClick={() => toggleDraftStatus(status)}
                                className={classNames(
                                  "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
                                  selected
                                    ? "ticket-row-selected border-[var(--portal-selected-border)]"
                                    : "border-slate-200 hover:bg-slate-50"
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={classNames(
                                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                      selected
                                        ? "border-[var(--portal-primary)] portal-accent-fill bg-[var(--portal-primary)] text-white"
                                        : "border-slate-300 text-transparent"
                                    )}
                                  >
                                    <Check className="h-3 w-3" />
                                  </span>
                                  <span className="min-w-0 whitespace-normal break-words text-sm font-bold leading-5 text-slate-900">
                                    {status}
                                  </span>
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                                  {statusCount(status)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-slate-200 pt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Assignment scope
                        </p>
                      {ASSIGNMENT_SCOPES.map((scope) => (
                        <button
                          key={scope.key}
                          type="button"
                          onClick={() => setDraftAssignmentScope(scope.key)}
                          className={classNames(
                            "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                            draftAssignmentScope === scope.key
                              ? "ticket-row-selected border-[var(--portal-selected-border)]"
                              : "border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={classNames(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              draftAssignmentScope === scope.key
                                ? "border-[var(--portal-primary)] portal-accent-fill bg-[var(--portal-primary)] text-white"
                                : "border-slate-300 text-transparent"
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <span>
                            <span className="block text-sm font-bold text-slate-900">
                              {scope.label}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                              {scope.key === "all" && "All tickets you are authorised to view."}
                              {scope.key === "mine" && "Tickets assigned directly to your account."}
                              {scope.key === "unassigned" && "Tickets that do not yet have an assigned agent."}
                              {scope.key === "my-groups" && "Tickets routed to your active support groups."}
                            </span>
                          </span>
                        </button>
                      ))}
                      </div>
                    </div>

                    <footer className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-3 border-t border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-3 min-[420px]:p-4 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={clearDraftTicketFilters}
                        disabled={
                          draftAssignmentScope === "all" &&
                          !draftStatuses.length
                        }
                        className="portal-control inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                      >
                        <RotateCcw className="h-4 w-4" /> Clear all
                      </button>
                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                        <button
                          type="button"
                          onClick={cancelTicketFilters}
                          className="portal-control rounded-xl border px-4 py-2 text-sm font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={applyTicketFilters}
                          className="portal-accent-fill rounded-xl bg-[var(--portal-primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                        >
                          Apply filters
                        </button>
                      </div>
                    </footer>
                  </section>
                ) : null}
              </div></div>
            </div>
          ) : null}
          {selectMode ? <div className="portal-surface-muted flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm"><span className="font-bold">{selection.count} selected across pages</span><div className="flex gap-2"><button type="button" onClick={() => selection.selectPage(tickets)} className="portal-control rounded-lg border px-3 py-1.5 text-xs font-bold">Select current page</button><button type="button" onClick={() => selection.clearPage(tickets)} className="portal-control rounded-lg border px-3 py-1.5 text-xs font-bold">Clear current page</button><button type="button" onClick={selection.clear} className="portal-control rounded-lg border px-3 py-1.5 text-xs font-bold">Clear all</button></div></div> : null}
          <StickyListBody label="Ticket rows" className="divide-y divide-slate-100">
            {!employeeExperience && workspaceView === "list" && !loading && tickets.length > 0 ? <div className="portal-surface-muted sticky top-0 z-20 hidden grid-cols-[minmax(0,1fr)_140px_120px_70px] gap-3 border-l-4 border-transparent px-4 py-2 text-[11px] font-bold uppercase tracking-wide xl:grid"><span>Ticket / Requestor</span><span>Assigned agent</span><span>Workspace</span><span className="text-right">Age</span></div> : null}
            {employeeExperience && !loading && tickets.length > 0 ? (
              <div className="sticky top-0 z-10 hidden items-center gap-3 border-l-4 border-l-transparent bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:flex xl:px-4">
                <span className="hidden w-10 shrink-0 sm:block" />
                <span className="min-w-0 flex-1">Ticket</span>
                <span className="w-44 shrink-0">Agent</span>
                <span className="w-[7.5rem] shrink-0 text-right">
                  Status · Priority
                </span>
              </div>
            ) : null}
            {workspaceView === "kanban" && !loading ? <div className="scroll-slim flex min-h-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain p-3 pb-4">{STATUS_OPTIONS.map((columnStatus) => { const columnTickets = tickets.filter((ticket) => (ticket.status || "Open") === columnStatus); return <section key={columnStatus} onDragOver={(event) => { if (!canOperate || actionLoading) return; event.preventDefault(); setDropTarget(columnStatus); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(""); }} onDrop={(event) => { event.preventDefault(); const ticket=draggedTicket; setDropTarget(""); if (ticket) moveTicketToStatus(ticket,columnStatus); }} className={classNames("portal-surface-muted flex max-h-full w-[min(88vw,22rem)] min-w-[min(88vw,22rem)] shrink-0 snap-start flex-col rounded-xl border p-2 md:w-[20rem] md:min-w-[20rem] xl:w-[calc((100%-1.5rem)/3)] xl:min-w-[18rem]",dropTarget===columnStatus&&"ring-2 ring-[var(--portal-primary)]")}><header className="portal-surface-muted sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-[var(--portal-border)] px-1 py-2"><h3 className="portal-title text-sm font-black">{columnStatus}</h3><span className="portal-accent-soft rounded-full px-2 py-0.5 text-xs font-black">{columnTickets.length}</span></header><div className="scroll-slim min-h-0 flex-1 space-y-2 overflow-y-auto pt-2">{columnTickets.map((item) => { const gauge=slaState(item); return <article key={item.id} draggable={canOperate&&!actionLoading&&!selectMode} onDragStart={(event)=>{setDraggedTicket(item);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(item.id));}} onDragEnd={()=>{setDraggedTicket(null);setDropTarget("");}} className={classNames("portal-surface-raised rounded-xl border p-3",draggedTicket?.id===item.id&&"opacity-50")}><div className="flex items-start gap-2">{selectMode ? <input type="checkbox" checked={selection.has(item.id)} onChange={() => toggleTicketSelection(item.id)} aria-label={`Select ${item.ticket_ref || item.id}`}/> : null}<button type="button" onClick={() => setSelectedTicket(item)} onDoubleClick={() => navigate(`/tickets/${item.id}`)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center justify-between gap-2"><span className="portal-ticket-reference text-xs font-black">{item.ticket_ref || `TICKET-${item.id}`}</span><span className={classNames("rounded-full border px-2 py-0.5 text-[11px] font-bold",priorityClass(item.priority))}>{item.priority||"Medium"}</span></div><p className="portal-title mt-2 line-clamp-2 text-sm font-bold">{item.title}</p><div className="mt-3 flex items-center gap-2"><span className="portal-avatar-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black">{initialsFor(item.assigned_to_name)||"?"}</span><div className="min-w-0"><p className="portal-title truncate text-xs font-bold">{item.assigned_to_name||"Unassigned"}</p><p className="portal-muted text-[10px]">Assignee</p></div></div><p className={classNames("mt-3 text-xs font-bold",gauge.overdue?"text-[var(--portal-danger)]":"portal-copy")}>Ticket Due: {formatDue(item.due_at)}</p>{gauge.percent===null?<p className="portal-muted mt-1 text-[11px]">SLA countdown unavailable</p>:<><div className="portal-sla-bar mt-2 h-2" role="progressbar" aria-label={gauge.label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={gauge.percent}><span className={`portal-sla-${gauge.tone}`} style={{width:`${gauge.percent}%`}}/></div><p className={classNames("mt-1 text-[11px] font-bold",gauge.overdue?"text-[var(--portal-danger)]":"portal-muted")}>{gauge.label}</p></>}</button></div></article>})}</div></section>})}</div> : loading ? (
              Array.from({ length: 8 }, (_, index) => (
                <TicketRowSkeleton key={index} />
              ))
            ) : tickets.length === 0 ? (
              <div className="p-10 text-center">
                <Ticket className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-3 font-bold text-slate-950">
                  {assignmentScope === "my-groups"
                    ? "No tickets in your support groups"
                    : "No tickets match the current filters"}
                </p>
                <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">
                  {assignmentScope === "my-groups"
                    ? groups.length === 0
                      ? "No active support groups are linked to your account. Ask a Helpdesk administrator to add your account to a support group."
                      : "No tickets are currently routed to your active support groups."
                    : "Clear the assignment filter, change the status, or try another search term."}
                </p>
                {assignmentScope !== "all" || hasSearchOrStatusFilter ? (
                  <button
                    type="button"
                    onClick={resetAppliedTicketFilters}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : (
              workspaceView === "list" ? tickets.map((item) => {
                const selected =
                  String(selectedTicket?.id) === String(item.id);

                if (employeeExperience) {
                  const module = moduleForTicketType(item.ticket_type);
                  const ModuleIcon = module.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTicketForPreview(item)}
                      onDoubleClick={() => openFullTicket(item)}
                      className={classNames(
                        "flex w-full items-center gap-3 border-l-4 px-3 py-3 text-left transition xl:px-4",
                        selected
                          ? "ticket-row-selected border-[var(--portal-selected-border)]"
                          : "border-transparent hover:bg-slate-50"
                      )}
                    >
                      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl portal-accent-fill bg-[var(--portal-primary)]/[0.06] text-[var(--portal-primary)] sm:flex">
                        <ModuleIcon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-950">
                          {item.title}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-slate-500">
                          <span className="portal-ticket-reference font-bold">
                            {item.ticket_ref || `TICKET-${item.id}`}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span>{module.shortLabel}</span>
                          <span className="text-slate-300">·</span>
                          <span>{formatAge(item)} ago</span>
                        </p>
                      </div>

                      <div className="hidden w-44 min-w-0 items-center gap-2 md:flex">
                        {item.assigned_to_name ? (
                          <>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full portal-accent-fill bg-[var(--portal-primary)] text-[10px] font-bold text-white">
                              {initialsFor(item.assigned_to_name)}
                            </span>
                            <span className="truncate text-sm font-semibold text-slate-800">
                              {item.assigned_to_name}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-slate-300" />
                            <span className="truncate text-sm font-semibold text-slate-400">
                              Awaiting agent
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex w-[7.5rem] shrink-0 flex-col items-end gap-1">
                        <span
                          className={classNames(
                            "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold",
                            statusClass(item.status)
                          )}
                        >
                          {item.status || "Open"}
                        </span>
                        <span
                          className={classNames(
                            "whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold",
                            priorityClass(item.priority)
                          )}
                        >
                          {item.priority || "Medium"}
                        </span>
                      </div>
                    </button>
                  );
                }

                return (
                  <div key={item.id} className="flex items-stretch">{selectMode ? <label className="portal-surface-muted flex w-10 shrink-0 items-center justify-center border-r"><input type="checkbox" checked={selection.has(item.id)} onChange={() => toggleTicketSelection(item.id)} aria-label={`Select ${item.ticket_ref || item.id}`}/></label> : null}<button
                    type="button"
                    onClick={() => selectTicketForPreview(item)}
                    onDoubleClick={() => openFullTicket(item)}
                    className={classNames(
                      "grid w-full gap-2 border-l-4 px-3 py-2 text-left transition md:grid-cols-[1fr_120px_64px] md:items-center xl:grid-cols-[1fr_140px_120px_70px] xl:gap-3 xl:px-4 xl:py-2.5",
                      selected
                        ? "ticket-row-selected border-[var(--portal-selected-border)]"
                        : "border-transparent hover:bg-slate-50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="portal-ticket-reference font-bold">
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

                    <div className="hidden min-w-0 md:block">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {item.assigned_to_name || "Unassigned"}
                      </p>
                      <p className="text-xs text-slate-500">Assigned agent</p>
                    </div>

                    <div className="hidden min-w-0 xl:block">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {item.workspace || "IT"}
                      </p>
                      <p className="text-xs text-slate-500">Workspace</p>
                    </div>

                    <span className="text-xs font-bold text-slate-500 md:text-right">
                      {formatAge(item)}
                    </span>
                  </button></div>
                );
              }) : null
            )}
          </StickyListBody>
          {!employeeExperience ? (
            <StickyListFooter>
              <PaginationBar
                pagination={pagination}
                loading={loading}
                onPageChange={changePage}
                pageSize={pageSize}
                onPageSizeChange={(value)=>{localStorage.setItem("atd-ticket-workspace-page-size",String(value));setPageSize(value);setPage(1);}}
              />
            </StickyListFooter>
          ) : null}
        </StickyListShell></div>
        {panelMode !== "hidden" ? <aside
          style={{"--ticket-workspace-panel-width":`${panelWidth}px`}}
          className={classNames(
            "ticket-workspace-adaptive-panel min-h-0 overflow-y-auto",
            // On laptop, only show the preview pane when a ticket is selected
            // so the list keeps vertical room. Monitors always show the pane.
            selectedTicket
              ? "max-h-[42vh] xl:max-h-none"
              : "hidden xl:block"
          )}
        >
          <div className="portal-surface-raised sticky top-0 z-30 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2"><div className="flex items-center gap-2"><button type="button" onClick={()=>setPanelPinned(value=>!value)} className="portal-control hidden rounded-lg border p-2 xl:inline-flex" aria-label={panelPinned?"Unpin panel":"Pin panel"}>{panelPinned?<Pin className="h-4 w-4"/>:<PinOff className="h-4 w-4"/>}</button><span className="portal-title text-xs font-bold">{panelMode==="statistics"?"Ticket Statistics":"Ticket Preview"}</span></div><div className="flex items-center gap-2"><label className="portal-muted hidden text-xs xl:flex">Width<input type="range" min="360" max="640" step="20" value={panelWidth} onChange={event=>setPanelWidth(Number(event.target.value))} className="ml-2 w-24"/></label><button type="button" onClick={()=>setPanelMode("hidden")} className="portal-control rounded-lg border p-2" aria-label="Hide panel"><X className="h-4 w-4"/></button></div></div>
          {panelMode === "statistics" ? <TicketWorkspaceStatistics tickets={tickets} counts={counts} pagination={pagination}/> : !selectedTicket ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <Ticket className="h-8 w-8 text-slate-400" />
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
              <div className="flex items-start justify-between gap-3"><button type="button" onClick={()=>setPanelMode("hidden")} className="portal-control order-last rounded-lg border p-1.5" aria-label="Close ticket preview"><X className="h-4 w-4"/></button>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--portal-primary)]">
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

              <p className="mt-3 line-clamp-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600 xl:line-clamp-6">
                {selectedTicket.description || "No description"}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Info label="Priority" value={selectedTicket.priority} />
                {employeeExperience ? (
                  <Info
                    label="Type"
                    value={
                      moduleForTicketType(selectedTicket.ticket_type).shortLabel
                    }
                  />
                ) : (
                  <Info label="Workspace" value={selectedTicket.workspace} />
                )}
                <Info
                  label="Group"
                  value={selectedTicket.assigned_group_name || "No group"}
                />
                <Info
                  label="Assigned To"
                  value={
                    selectedTicket.assigned_to_name ||
                    (employeeExperience ? "Awaiting agent" : "Unassigned")
                  }
                />
              </div>

              <button
                type="button"
                onClick={() => navigate(`/tickets/${selectedTicket.id}`)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--portal-primary)]/40 focus:ring-4 focus:ring-[#172b57]/15 disabled:opacity-50"
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
                      actionLoading ||
                      !resolvedGroupId ||
                      Boolean(groupsError)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--portal-primary)]/40 focus:ring-4 focus:ring-[#172b57]/15 disabled:opacity-50"
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
                      actionLoading ||
                      !canAssignToSelf ||
                      Boolean(groupsError)
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
                    <button type="button" disabled={actionLoading} onClick={() => navigate(`/tickets/${selectedTicket.id}#governed-closure`)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><XCircle className="h-4 w-4" />Close</button>
                  </div>
                </div>
              )}

              {canOperate && selectedTicket.priority === "Critical" && (
                <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Critical ticket requiring priority attention.
                </div>
              )}
            </div>
          )}
        </aside> : null}
      </div>

      {selectMode ? <BulkTicketActions ticketIds={selection.ids} tickets={selection.tickets} groups={groups} busy={actionLoading} onBusyChange={setActionLoading} canDelete={canDeleteTickets} onClear={selection.clear} onComplete={async (result) => { toast.success(result.message, { title: "Bulk ticket operation" }); selection.clear(); await fetchTickets(); }} /> : null}

      {doubleClickGuidance ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-2xl"
        >
          {doubleClickGuidance}
        </div>
      ) : null}
      <RequestEntryMenu
        open={requestEntryOpen}
        onClose={() => setRequestEntryOpen(false)}
        onSelect={(entry) => {
          setRequestEntryOpen(false);
          navigate(entry.path);
        }}
      />
    </OperationsShell>
  );
}

function TicketWorkspaceStatistics({tickets,counts,pagination}) {
  const statusRows=STATUS_OPTIONS.map(status=>({label:status,value:counts?.[status]??tickets.filter(ticket=>ticket.status===status).length}));
  const priorityRows=["Critical","High","Medium","Low"].map(priority=>({label:priority,value:tickets.filter(ticket=>ticket.priority===priority).length}));
  const groupMap=new Map();tickets.forEach(ticket=>{const key=ticket.assigned_group_name||ticket.workspace||"Unassigned / Other";groupMap.set(key,(groupMap.get(key)||0)+1);});
  const groupRows=[...groupMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value}));
  const total=Number(pagination?.total??counts?.All??tickets.length)||0;
  const overdue=tickets.filter(ticket=>slaState(ticket).overdue).length;
  const reopened=tickets.filter(ticket=>Number(ticket.reopen_count||0)>0).length;
  const section=(title,rows)=><section className="portal-surface-raised rounded-xl border p-4"><h3 className="portal-title text-sm font-black">{title}</h3><div className="mt-3 space-y-2">{rows.map(row=><div key={row.label} className="flex items-center justify-between gap-3 text-sm"><span className="portal-copy truncate">{row.label}</span><span className="portal-accent-soft rounded-full px-2 py-0.5 text-xs font-black">{row.value}</span></div>)}</div></section>;
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><Info label="Authorised total" value={total.toLocaleString("en-ZA")}/><Info label="Current page" value={tickets.length}/><Info label="Overdue on page" value={overdue}/><Info label="Reopened on page" value={reopened}/></div>{section("Lifecycle status",statusRows)}{section("Priority on current page",priorityRows)}{section("Support group / workspace",groupRows.length?groupRows:[{label:"No current data",value:0}])}<p className="portal-muted px-1 text-xs leading-5">Authorised total uses the server count. Priority, SLA, reopened and support-group breakdowns describe the currently loaded page and preserve the active filters.</p></div>;
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
