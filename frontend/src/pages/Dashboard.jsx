import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  Clock,
  Factory,
  Gauge,
  HardDrive,
  Info,
  LifeBuoy,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Ticket,
  UserCircle,
  LogOut,
  Monitor,
  Moon,
  Sun,
  LayoutDashboard,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Sidebar from "../components/Sidebar";
import CompanyAnnouncements from "../components/dashboard/CompanyAnnouncements";
import { useToast } from "../components/notifications/ToastProvider";
import NotificationCenter from "../components/notifications/NotificationCenter";
import SharedAccountMenu from "../components/account/AccountMenu";

import RequestEntryMenu from "../components/tickets/RequestEntryMenu";
import PendingAcceptanceCards from "../components/tickets/PendingAcceptanceCards";
import BulkTicketActions from "../components/tickets/BulkTicketActions";
import useCrossPageTicketSelection from "../hooks/useCrossPageTicketSelection";
import { REQUEST_MODULES, formPathForType } from "../data/requestModules";
import useSidebarCollapsed from "../hooks/useSidebarCollapsed";
import { useAuth } from "../hooks/useAuth";
import {
  accessRequestsApi,
  assetsApi,
  groupsApi,
  knowledgeApi,
  notificationApi,
  statsApi,
  ticketsApi,
} from "../services/api";
import assignmentAcceptanceApi from "../services/assignmentAcceptanceApi";
import useAppearance from "../hooks/useAppearance";

const DASHBOARD_PAGE_SIZES = [25, 50, 100, 250, 500];
const DASHBOARD_PAGE_SIZE_KEY = "atd-helpdesk-dashboard-priority-page-size";
const NOTIFICATION_MODULES = ["admin", "helpdesk"];
const SEARCH_DEBOUNCE_MS = 300;
const ADMIN_ROLES = new Set(["manager", "admin", "superadmin"]);
const WORKSPACE_OPTIONS = [
  { code: "IT", label: "Information Technology" },
  { code: "HR", label: "Human Resources" },
  { code: "FIN", label: "Finance" },
  { code: "PDM", label: "Process Engineering (PDM)" },
  { code: "FAC", label: "Facilities" },
];
const DASHBOARD_VIEW_STORAGE_KEY = "atd-helpdesk-dashboard-view";
const DASHBOARD_SEARCH_SCOPE_KEY = "atd-helpdesk-dashboard-search-scope";
const DASHBOARD_ASSIGNMENT_SCOPE_KEY = "atd-helpdesk-dashboard-assignment-scope";
const DASHBOARD_VIEW_OPTIONS = new Set(["simple", "explorative"]);

function ticketWorkspaceCode(value) {
  const workspace = String(value || "").trim().toLowerCase();
  if (["hr", "human resources", "hr workspace"].includes(workspace)) return "HR";
  if (["fin", "finance", "finance department", "finance workspace", "finance service desk"].includes(workspace)) return "FIN";
  if (["pdm", "process engineering", "process engineering (pdm)", "process engineering workspace"].includes(workspace)) return "PDM";
  if (["fac", "facilities"].includes(workspace)) return "FAC";
  if (["it", "information technology", "it helpdesk", "it workspace", "helpdesk"].includes(workspace)) return "IT";
  return "IT";
}

function notificationWorkspace(notification, payload) {
  return ticketWorkspaceCode(
    payload?.workspace ||
    payload?.ticket?.workspace ||
    notification?.workspace ||
    "IT"
  );
}

function storedPreference(key, allowedValues, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowedValues.has(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
function mergeNotifications(lists) {
  const byId = new Map();

  for (const list of lists) {
    for (const notification of list) {
      if (!notification?.id) continue;
      byId.set(notification.id, notification);
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    return new Date(right.created_at || 0) - new Date(left.created_at || 0);
  });
}


function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds <= 0) {
    return "0m";
  }

  const minutes = Math.floor(milliseconds / 60000);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function formatCount(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-ZA")
    : "N/A";
}

function getTicketAge(ticketItem) {
  if (!ticketItem.created_at) {
    return "—";
  }

  return formatDuration(
    Date.now() - new Date(ticketItem.created_at).getTime()
  );
}

function getSlaPercent(ticketItem) {
  if (!ticketItem.due_at || !ticketItem.created_at) {
    return 100;
  }

  const createdAt = new Date(ticketItem.created_at).getTime();
  const dueAt = new Date(ticketItem.due_at).getTime();
  const completionTime = ticketItem.resolved_at || ticketItem.closed_at;
  const comparisonTime = completionTime
    ? new Date(completionTime).getTime()
    : Date.now();

  const totalDuration = dueAt - createdAt;
  const remainingDuration = dueAt - comparisonTime;

  if (totalDuration <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round((remainingDuration / totalDuration) * 100)
    )
  );
}

function getPriorityClassName(priority) {
  const classes = {
    Critical: "border-red-200 bg-red-100 text-red-700",
    High: "border-orange-200 bg-orange-100 text-orange-700",
    Medium: "border-amber-200 bg-amber-100 text-amber-700",
    Low: "border-emerald-200 bg-emerald-100 text-emerald-700",
  };

  return ({ Critical: "portal-priority-critical", High: "portal-priority-high", Medium: "portal-priority-medium", Low: "portal-priority-low" })[priority] || "portal-priority-medium";
}

function getStatusClassName(status) {
  const classes = {
    Open: "bg-blue-100 text-[var(--portal-primary)]",
    Assigned: "bg-slate-100 text-slate-700",
    Pending: "bg-purple-100 text-purple-700",
    Investigating: "bg-indigo-100 text-indigo-700",
    "Waiting Approval": "bg-purple-100 text-purple-700",
    Resolved: "bg-emerald-100 text-emerald-700",
    Closed: "bg-slate-200 text-slate-700",
    Escalated: "bg-red-100 text-red-700",
  };

  return classes[status] || classes.Open;
}

function getErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

function ticketReferenceCandidates(notification, payload, targetUrl) {
  const values = [
    notification?.ticket_ref,
    notification?.ticketReference,
    notification?.ticket_reference,
    payload?.ticketRef,
    payload?.ticket_ref,
    payload?.ticketReference,
    payload?.ticket_reference,
    payload?.requestRef,
    payload?.request_ref,
    payload?.reference,
  ];
  const searchableText = [targetUrl, notification?.message, ...values]
    .filter(Boolean)
    .join(" ");
  const detected = searchableText.match(/\b(?:ATD\s+)?(?:REQ|INC|TMP-FS)-\d+\b/i)?.[0] || "";
  if (detected) values.push(detected);
  return Array.from(new Set(values
    .map((value) => String(value || "").trim().replace(/^ATD\s+/i, ""))
    .filter(Boolean)));
}
async function resolveNotificationTicketId(notification, payload, targetUrl, directTicketId) {
  if (Number.isInteger(directTicketId) && directTicketId > 0) return directTicketId;
  for (const reference of ticketReferenceCandidates(notification, payload, targetUrl)) {
    const response = await ticketsApi.getAll({
      workspace: notificationWorkspace(notification, payload),
      page: 1,
      per_page: 10,
      search: reference,
      searchScope: "reference",
    });
    const body = response?.data;
    const rows = Array.isArray(body) ? body : Array.isArray(body?.tickets) ? body.tickets : [];
    const normalized = reference.toUpperCase();
    const exact = rows.find((row) => String(row?.ticket_ref || "").trim().toUpperCase() === normalized);
    const id = Number(exact?.id);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}
export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { logout, user } = useAuth();
  const adminUser = ADMIN_ROLES.has(user?.role);
  const canSelectTicketWorkspace = ["superadmin", "system_administrator"].includes(user?.role);
  const userWorkspaceCode = ticketWorkspaceCode(user?.department);
  const canDeleteTickets = ["admin", "superadmin"].includes(user?.role);
  const { appearance, setMode } = useAppearance();

  const [tickets, setTickets] = useState([]);
  const [kpiStats, setKpiStats] = useState(null);
  const [volumeStats, setVolumeStats] = useState(null);
  const [serviceMixStats, setServiceMixStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [assetStats, setAssetStats] = useState(null);
  const [knowledgeArticles, setKnowledgeArticles] = useState(null);
  const [groups, setGroups] = useState([]);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const ticketSelection = useCrossPageTicketSelection();
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPageSize, setTicketPageSize] = useState(() => {
    const stored = Number(localStorage.getItem(DASHBOARD_PAGE_SIZE_KEY));
    return DASHBOARD_PAGE_SIZES.includes(stored) ? stored : 25;
  });
  const [ticketPagination, setTicketPagination] = useState({ page: 1, perPage: 25, total: 0, totalPages: 1 });
  const [query, setQuery] = useState(() => sessionStorage.getItem("atd-helpdesk-dashboard-search") || "");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchScope, setSearchScope] = useState(() => localStorage.getItem(DASHBOARD_SEARCH_SCOPE_KEY) || "everything");
  const [assignmentScope, setAssignmentScope] = useState(() => localStorage.getItem(DASHBOARD_ASSIGNMENT_SCOPE_KEY) || "mine-or-groups");
  const [workspaceFilter, setWorkspaceFilter] = useState(() => (
    ["superadmin", "system_administrator"].includes(user?.role)
      ? "IT"
      : ticketWorkspaceCode(user?.department)
  ));
  const [requesterFilter, setRequesterFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [rangeDays, setRangeDays] = useState(7);

  const [loading, setLoading] = useState(true);
  const [ticketLoading, setTicketLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [sectionErrors, setSectionErrors] = useState({});

  const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapsed();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [dashboardView, setDashboardView] = useState(() =>
    storedPreference(DASHBOARD_VIEW_STORAGE_KEY, DASHBOARD_VIEW_OPTIONS, "explorative")
  );
  const notificationMenuRef = useRef(null);
  const accountMenuRef = useRef(null);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showEscalationModal, setShowEscalationModal] = useState(false);

  const [pendingAssigneeId, setPendingAssigneeId] = useState("");
  const [pendingAcceptances, setPendingAcceptances] = useState([]);


  useEffect(() => {
    localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, dashboardView);
  }, [dashboardView]);

  useEffect(() => {
    if (!showNotifications && !showAccountMenu) return undefined;
    const closeOnPointer = (event) => {
      if (
        showNotifications &&
        !notificationMenuRef.current?.contains(event.target)
      ) {
        setShowNotifications(false);
      }
      if (
        showAccountMenu &&
        !accountMenuRef.current?.contains(event.target)
      ) {
        setShowAccountMenu(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showAccountMenu, showNotifications]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      statsApi.getDashboard(),
      statsApi.getVolumeData({ days: rangeDays }),
      statsApi.getServiceMix(),
      ...NOTIFICATION_MODULES.map((module) => notificationApi.getAll({ module })),
      assetsApi.getStats(),
      knowledgeApi.getAll(),
      groupsApi.getAll(),
    ]);

    const [
      statsResult,
      volumeResult,
      serviceMixResult,
      adminNotificationResult,
      helpdeskNotificationResult,
      assetResult,
      knowledgeResult,
      groupResult,
    ] = results;

    const failedSections = {};

    if (statsResult.status === "fulfilled" && statsResult.value?.data) {
      setKpiStats(statsResult.value.data);
    } else {
      failedSections.kpis = "KPI totals could not be refreshed.";
    }

    if (volumeResult.status === "fulfilled" && Array.isArray(volumeResult.value?.data)) {
      setVolumeStats(volumeResult.value.data);
    } else {
      failedSections.volume = "Ticket volume could not be refreshed.";
    }

    if (serviceMixResult.status === "fulfilled" && Array.isArray(serviceMixResult.value?.data)) {
      setServiceMixStats(serviceMixResult.value.data);
    } else {
      failedSections.serviceMix = "Service mix could not be refreshed.";
    }

    const notificationLists = [adminNotificationResult, helpdeskNotificationResult]
      .filter((result) => result.status === "fulfilled")
      .map((result) => (Array.isArray(result.value.data) ? result.value.data : []));

    if (notificationLists.length > 0) {
      setNotifications(mergeNotifications(notificationLists));
    } else {
      failedSections.notifications = "Alerts could not be refreshed.";
    }

    if (assetResult.status === "fulfilled") {
      setAssetStats(assetResult.value.data || null);
    } else {
      failedSections.assets = "Asset inventory could not be refreshed.";
    }

    if (knowledgeResult.status === "fulfilled") {
      setKnowledgeArticles(
        Array.isArray(knowledgeResult.value.data)
          ? knowledgeResult.value.data
          : []
      );
    } else {
      failedSections.knowledge = "Knowledge suggestions could not be refreshed.";
    }

    if (groupResult.status === "fulfilled") {
      setGroups(
        Array.isArray(groupResult.value.data)
          ? groupResult.value.data
          : []
      );
    } else {
      failedSections.groups = "Assignment options could not be refreshed.";
    }

    setSectionErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      [
        "kpis",
        "volume",
        "serviceMix",
        "notifications",
        "assets",
        "knowledge",
        "groups",
      ].forEach((key) => delete nextErrors[key]);
      return { ...nextErrors, ...failedSections };
    });

    try {
      const pendingResponse = await assignmentAcceptanceApi.getPendingMine();
      setPendingAcceptances(Array.isArray(pendingResponse.data?.items) ? pendingResponse.data.items : []);
      setSectionErrors((current) => { const next={...current}; delete next.pendingAcceptances; return next; });
    } catch (requestError) {
      setPendingAcceptances([]);
      setSectionErrors((current) => ({...current,pendingAcceptances:getErrorMessage(requestError,"Pending assignments could not be refreshed.")}));
    }
    setLoading(false);
  }, [rangeDays]);

  const fetchTicketQueue = useCallback(async () => {
    setTicketLoading(true);

    try {
      const response = await ticketsApi.getAll({
        page: ticketPage,
        per_page: ticketPageSize,
        status: "Unresolved",
        search: debouncedQuery || undefined,
        searchScope,
        assignmentScope,
        workspace: workspaceFilter,
        requester: requesterFilter || undefined,
        department: departmentFilter || undefined,
        priority: priorityFilter || undefined,
        sort: "created_at",
        direction: "desc",
      });
      const payload = response.data;
      const ticketData = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.tickets)
          ? payload.tickets
          : [];

      setTickets(ticketData);
      const pagination = !Array.isArray(payload) && payload?.pagination ? payload.pagination : { page: ticketPage, perPage: ticketPageSize, total: ticketData.length, totalPages: 1 };
      setTicketPagination(pagination);
      if (ticketPage > pagination.totalPages) setTicketPage(Math.max(1, pagination.totalPages));
      setSectionErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.tickets;
        return nextErrors;
      });
    } catch (requestError) {
      setTickets([]);
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        tickets: getErrorMessage(
          requestError,
          "The priority ticket queue could not be loaded."
        ),
      }));
    } finally {
      setTicketLoading(false);
    }
  }, [debouncedQuery, searchScope, assignmentScope, ticketPage, ticketPageSize, workspaceFilter, requesterFilter, departmentFilter, priorityFilter]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      fetchDashboardData(),
      fetchTicketQueue(),
    ]);
  }, [fetchDashboardData, fetchTicketQueue]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetchTicketQueue();
  }, [fetchTicketQueue]);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => {
      return !notification.is_read;
    }).length;
  }, [notifications]);

  const filteredTickets = tickets;

  const volumeData = useMemo(() => {
    return Array.isArray(volumeStats)
      ? volumeStats.map((row) => ({
          day: row.label || row.day,
          date: row.date,
          incidents: Number(row.incidents) || 0,
          requests: Number(row.requests) || 0,
          changes: Number(row.changes) || 0,
        }))
      : [];
  }, [volumeStats]);

  const serviceMixData = useMemo(() => {
    const colors = [
      "#2563eb",
      "#7c3aed",
      "#16a34a",
      "#f97316",
      "#0891b2",
    ];

    return Array.isArray(serviceMixStats)
      ? serviceMixStats.map((item, index) => ({
          name: item.name,
          value: Number(item.value) || 0,
          color: item.color || colors[index % colors.length],
        }))
      : [];
  }, [serviceMixStats]);

  const workspaces = canSelectTicketWorkspace
    ? WORKSPACE_OPTIONS
    : WORKSPACE_OPTIONS.filter((workspace) => workspace.code === userWorkspaceCode);

  useEffect(() => { sessionStorage.setItem("atd-helpdesk-dashboard-search", query); }, [query]);
  useEffect(() => { localStorage.setItem(DASHBOARD_SEARCH_SCOPE_KEY, searchScope); }, [searchScope]);
  useEffect(() => { localStorage.setItem(DASHBOARD_ASSIGNMENT_SCOPE_KEY, assignmentScope); }, [assignmentScope]);
  useEffect(() => {
    setWorkspaceFilter((current) => {
      if (canSelectTicketWorkspace) {
        return WORKSPACE_OPTIONS.some((workspace) => workspace.code === current) ? current : "IT";
      }
      return userWorkspaceCode;
    });
  }, [canSelectTicketWorkspace, userWorkspaceCode]);
  useEffect(() => { setTicketPage(1); }, [debouncedQuery, searchScope, assignmentScope, workspaceFilter, requesterFilter, departmentFilter, priorityFilter]);

  const selectedGroup = useMemo(() => {
    return groups.find((group) => {
      return String(group.id) === String(selectedTicket?.assigned_group_id);
    }) || null;
  }, [groups, selectedTicket?.assigned_group_id]);

  const assignableUsers = useMemo(() => {
    return Array.isArray(selectedGroup?.members)
      ? selectedGroup.members
      : [];
  }, [selectedGroup]);

  useEffect(() => {
    setSelectedTicket((currentTicket) => {
      if (filteredTickets.length === 0) {
        return null;
      }

      return filteredTickets.find((ticketItem) => {
        return ticketItem.id === currentTicket?.id;
      }) || filteredTickets[0];
    });
  }, [filteredTickets]);

  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setActionLoading(false);
      setShowLogoutConfirmation(false);
    }
  };

  const handleOpenNotifications = () => {
    setShowAccountMenu(false);
    setShowNotifications((current) => !current);
  };

  const handleNotificationReadState = async (notification, nextReadState) => {
    setActionLoading(true);
    setError("");
    try {
      const response = nextReadState
        ? await notificationApi.markRead(notification.id)
        : await notificationApi.markUnread(notification.id);
      setNotifications((current) => current.map((item) =>
        item.id === notification.id
          ? { ...item, ...(response.data || {}), is_read: nextReadState }
          : item
      ));
    } catch (requestError) {
      const message = getErrorMessage(requestError, "Notification read state could not be updated.");
      setError(message);
      toast.error(message, { title: "Notification not updated" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setActionLoading(true);
    setError("");
    try {
      await Promise.all(NOTIFICATION_MODULES.map((module) => notificationApi.markAllRead(module)));
      setNotifications((current) => current.map((item) => {
        const payload = item?.action_payload || {};
        const requiresAction = Boolean(payload.requiresAction || payload.requires_action);
        return requiresAction
          ? item
          : { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() };
      }));
    } catch (requestError) {
      const message = getErrorMessage(requestError, "Notifications could not be marked as read.");
      setError(message);
      toast.error(message, { title: "Notification update failed" });
    } finally {
      setActionLoading(false);
    }
  };
  const handleNotificationAction = async (notification, action) => {
    const payload = notification?.action_payload || {};
    const requestId = Number(payload.requestId || payload.request_id);
    const targetUrl = String(notification?.target_url || payload.targetUrl || payload.target_url || "");
    const targetUrlTicketId = Number(targetUrl.match(/\/tickets\/(\d+)(?:[/?#]|$)/)?.[1]);
    const targetTicketId =
      notification?.target_type === "ticket" ? Number(notification?.target_id) : Number.NaN;
    const ticketIdCandidates = [
      payload.ticketId,
      payload.ticket_id,
      targetTicketId,
      targetUrlTicketId,
    ].map(Number);
    const directTicketId = ticketIdCandidates.find(
      (value) => Number.isInteger(value) && value > 0
    );
    const isAccessRequest =
      notification?.target_type === "access_request" ||
      notification?.type === "access_request_approval" ||
      (Number.isInteger(requestId) && requestId > 0);

    setActionLoading(true);
    setError("");

    try {
      if (isAccessRequest) {
        if (!Number.isInteger(requestId) || requestId < 1) {
          throw new Error("This notification does not contain a valid access request.");
        }

        if (action === "view") {
          await notificationApi.markRead(notification.id);
          setShowNotifications(false);
          navigate("/access-requests");
          return;
        }

        const decisionReason = window.prompt(
          action === "reject"
            ? "Enter the rejection reason:"
            : "Enter an optional approval note:",
          ""
        );

        if (decisionReason === null) return;

        if (action === "reject" && decisionReason.trim().length < 5) {
          throw new Error("Provide a rejection reason of at least 5 characters.");
        }

        const result = await accessRequestsApi.decide(requestId, {
          decision: action === "approve" ? "approved" : "rejected",
          decisionReason: decisionReason.trim(),
        });

        await notificationApi.markRead(notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, is_read: true, read_at: new Date().toISOString() }
              : item
          )
        );
        setShowNotifications(false);
        toast.success(result.data?.message || `Access request ${action}d.`, {
          title: "Access request updated",
          duration: 5000,
        });
        navigate("/access-requests");
        return;
      }

      const ticketId = await resolveNotificationTicketId(
        notification,
        payload,
        targetUrl,
        directTicketId
      );
      if (!Number.isInteger(ticketId) || ticketId < 1) {
        throw new Error("The ticket linked to this notification could not be resolved safely.");
      }

      if (action === "accept") {
        await assignmentAcceptanceApi.accept(ticketId, {});
      } else if (action === "return_to_queue") {
        await assignmentAcceptanceApi.returnToQueue(ticketId, {});
      } else {
        await notificationApi.markRead(notification.id);
        setShowNotifications(false);
        navigate(`/tickets/${ticketId}`);
        return;
      }

      await notificationApi.markRead(notification.id);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item
        )
      );
      setShowNotifications(false);
      toast.success(
        action === "accept" ? "Assignment accepted." : "Ticket returned to the group queue.",
        { title: "Ticket activity recorded", duration: 5000 }
      );
      navigate(`/tickets/${ticketId}`);
    } catch (requestError) {
      const message = getErrorMessage(
        requestError,
        requestError?.message || "The notification action could not be completed."
      );
      setError(message);
      toast.error(message, {
        title: "Action not completed",
        eventKey: `notification-action-${notification?.id || "unknown"}-${action}-${message}`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearNotifications = async () => {
    const protectedActions = notifications.filter((item) => {
      const payload = item?.action_payload || {};
      return Boolean(payload.requiresAction || payload.requires_action);
    });
    if (protectedActions.length > 0) {
      setError(
        `${protectedActions.length} action-required notification(s) must be completed or opened before alerts can be cleared.`
      );
      return;
    }
    const confirmed = window.confirm(
      "Clear all completed Helpdesk and administration alerts?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(
        NOTIFICATION_MODULES.map((module) => notificationApi.clearAll(module))
      );
      setNotifications([]);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Failed to clear notifications.")
      );
    }
  };

  const openTicketCreation = (ticketType) => {
    setShowCreateMenu(false);
    const module = Object.values(REQUEST_MODULES).find(
      (item) => item.ticketType === ticketType
    );
    navigate(module?.path || formPathForType(ticketType), {
      state: {
        createMode: ticketType,
      },
    });
  };

  const openAssignmentModal = () => {
    if (!selectedTicket) {
      return;
    }

    setPendingAssigneeId(
      selectedTicket.assigned_to_user_id
        ? String(selectedTicket.assigned_to_user_id)
        : ""
    );

    setShowAssignmentModal(true);
  };

  const confirmAssignment = async () => {
    if (!selectedTicket) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      await ticketsApi.assign(
        selectedTicket.id,
        pendingAssigneeId ? Number(pendingAssigneeId) : null,
        selectedTicket.assigned_group_id || null
      );

      setShowAssignmentModal(false);
      await refreshDashboard();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Ticket assignment failed.")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const confirmEscalation = async () => {
    if (!selectedTicket) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      await ticketsApi.updateStatus(selectedTicket.id, "Escalated");
      setShowEscalationModal(false);
      await refreshDashboard();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Ticket escalation failed.")
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        navigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebarCollapsed}
      />

      <main
        className={classNames(
          "transition-[padding] duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
          <div className="dashboard-operations-header flex flex-col gap-4 px-5 py-4 pr-24 sm:pr-28 xl:flex-row xl:items-center xl:justify-between xl:px-8 xl:pr-28">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Factory className="h-4 w-4" />
                <span>ATD IT Department / Infrastructure + ERP Support</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {kpiStats?.scopeLabel || "All Helpdesk tickets"}
                </span>
              </div>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                Helpdesk Operations Dashboard
              </h1>
            </div>

            <div className="dashboard-header-actions flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:justify-end">
              <div className="dashboard-universal-search flex min-w-0 flex-[1_1_32rem] items-stretch gap-2">
                <select value={searchScope} onChange={(event) => setSearchScope(event.target.value)} aria-label="Search within" className="rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                  <option value="everything">Everything</option><option value="reference">Reference</option><option value="subject">Subject</option><option value="description">Description</option><option value="requester">Requester</option><option value="department">Department</option><option value="assignee">Assignee</option><option value="support-group">Support group</option><option value="category">Category</option><option value="status">Status</option><option value="priority">Priority</option><option value="conversation">Conversation</option>
                </select>
                <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by word, sentence or ticket reference..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />{ticketLoading && <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}</div>
              </div>

              <NotificationMenu
                menuRef={notificationMenuRef}
                notifications={notifications}
                unreadCount={unreadCount}
                open={showNotifications}
                onToggle={handleOpenNotifications}
                onClear={handleClearNotifications}
                onAction={handleNotificationAction}
                onReadState={handleNotificationReadState}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onSettings={() => {
                  setShowNotifications(false);
                  navigate("/account?section=notifications");
                }}
                actionLoading={actionLoading}
              />
              <button
                type="button"
                onClick={refreshDashboard}
                disabled={loading || ticketLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  className={classNames(
                    "h-4 w-4",
                    (loading || ticketLoading) && "animate-spin"
                  )}
                />
                Refresh
              </button>

              <Link
                to="/ticket-monitor"
                className="dashboard-header-action inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                <Monitor className="h-4 w-4" />
                Ticket Monitor
              </Link>
              <SharedAccountMenu
                compact
                dashboardView={dashboardView}
                onDashboardViewChange={setDashboardView}
              />

              {adminUser && (
                <Link
                  to="/admin/users"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50"
                >
                  Manage Users
                </Link>
              )}

              {adminUser && (
                <Link
                  to="/company-communications"
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-100"
                >
                  <Send className="h-4 w-4" />
                  Send Communication
                </Link>
              )}

              <Link
                to="/production"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                <Factory className="h-4 w-4" />
                Production
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu((currentValue) => !currentValue);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  New Request
                  <ChevronDown className="h-4 w-4" />
                </button>

              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4 px-4 py-4 xl:px-6">
          {error && (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
              role="alert"
            >
              {error}
            </div>
          )}

          {(sectionErrors.notifications || sectionErrors.groups) && (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
              role="alert"
            >
              {[sectionErrors.notifications, sectionErrors.groups]
                .filter(Boolean)
                .join(" ")}
            </div>
          )}

          <CompanyAnnouncements />

          {sectionErrors.pendingAcceptances ? <SectionError message={sectionErrors.pendingAcceptances} /> : null}
          <PendingAcceptanceCards items={pendingAcceptances} busy={actionLoading} onAccept={async(item)=>{setActionLoading(true);try{await assignmentAcceptanceApi.accept(item.ticket_id,{});toast.success("Assignment accepted.",{title:"Ticket activity recorded",duration:5000});await refreshDashboard();navigate(`/tickets/${item.ticket_id}`);}catch(requestError){toast.error(getErrorMessage(requestError,"Assignment could not be accepted."),{title:"Action not completed"});}finally{setActionLoading(false);}}} onReturn={async(item)=>{setActionLoading(true);try{await assignmentAcceptanceApi.returnToQueue(item.ticket_id,{});toast.success("Ticket returned to the group queue.",{title:"Ticket activity recorded",duration:5000});await refreshDashboard();}catch(requestError){toast.error(getErrorMessage(requestError,"Assignment could not be returned."),{title:"Action not completed"});}finally{setActionLoading(false);}}} onReadMore={(item)=>navigate(`/tickets/${item.ticket_id}`)} />          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sectionErrors.kpis && kpiStats && (
              <SectionError
                message={`${sectionErrors.kpis} Showing the last loaded totals.`}
                className="md:col-span-2 xl:col-span-4"
              />
            )}

            {loading && !kpiStats ? (
              Array.from({ length: 4 }, (_, index) => (
                <StatCardSkeleton key={index} />
              ))
            ) : sectionErrors.kpis && !kpiStats ? (
              <SectionError
                message={sectionErrors.kpis}
                className="md:col-span-2 xl:col-span-4"
              />
            ) : (
              <>
                <StatCard
                  title="All Tickets"
                  value={formatCount(kpiStats?.total)}
                  supportingText={`${formatCount(kpiStats?.open)} unresolved tickets`}
                  onClick={() => navigate("/tickets")}
                  definition={kpiStats?.definitions?.open}
                  icon={Ticket}
                  accent="bg-blue-100 text-[var(--portal-primary)]"
                />

                <StatCard
                  title="Overdue Tickets"
                  value={formatCount(kpiStats?.overdueTickets)}
                  supportingText="Unresolved tickets whose governed resolution due time is exhausted"
                  definition={kpiStats?.definitions?.overdueTickets}
                  onClick={() => navigate("/tickets?statuses=Open,Assigned,Pending,Investigating,Waiting%20Approval,Escalated&overdue=true")}
                  icon={AlertTriangle}
                  accent="bg-red-100 text-red-700"
                />

                <StatCard
                  title="Critical Tickets"
                  value={formatCount(kpiStats?.criticalTickets ?? kpiStats?.critical)}
                  supportingText="Open tickets with Critical priority"
                  onClick={() => navigate("/tickets?priority=Critical&status=Unresolved")}
                  definition={kpiStats?.definitions?.critical}
                  icon={AlertTriangle}
                  accent="bg-red-100 text-red-700"
                />

                <StatCard
                  title="Average Resolution"
                  value={kpiStats?.averageResolution || "N/A"}
                  supportingText="Creation to resolution or closure"
                  definition={kpiStats?.definitions?.averageResolution}
                  icon={Clock}
                  accent="bg-purple-100 text-purple-700"
                />
              </>
            )}
          </div>

          {dashboardView === "explorative" ? (
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartPanel
              title="Ticket Volume"
              description="Incidents, service requests and changes by created date."
              className="xl:col-span-2"
              loading={loading && volumeStats === null}
              error={sectionErrors.volume}
              hasData={volumeStats !== null}
              toolbar={
                <RangeSelector
                  rangeDays={rangeDays}
                  open={showRangeMenu}
                  onToggle={() => {
                    setShowRangeMenu((currentValue) => !currentValue);
                  }}
                  onSelect={(days) => {
                    setRangeDays(days);
                    setShowRangeMenu(false);
                  }}
                />
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    interval={rangeDays <= 7 ? 0 : rangeDays <= 14 ? 1 : 4}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    height={34}
                  />
                  <Bar
                    dataKey="incidents"
                    name="Incidents"
                    fill="#2563eb"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="requests"
                    name="Requests"
                    fill="#7c3aed"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="changes"
                    name="Changes"
                    fill="#f97316"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ServiceMixPanel
              data={serviceMixData}
              loading={loading && serviceMixStats === null}
              error={sectionErrors.serviceMix}
              hasData={serviceMixStats !== null}
            />
          </div>
          ) : null}

          <div className="grid items-stretch gap-4 xl:grid-cols-3">
            <div className="flex flex-col gap-4 xl:col-span-2">
              <TicketQueue
                tickets={filteredTickets}
                selectedTicketId={selectedTicket?.id}
                workspaceFilter={workspaceFilter}
                workspaces={workspaces}
                onSelectTicket={setSelectedTicket}
                onWorkspaceChange={setWorkspaceFilter}
                onOpenWorkspace={() => {
                  const workspaceRoutes = {
                    FIN: "/finance-workspace",
                    HR: "/hr-workspace",
                    PDM: "/process-engineering-workspace",
                  };
                  navigate(workspaceRoutes[workspaceFilter] || `/tickets?status=Unresolved&workspace=${encodeURIComponent(workspaceFilter)}`);
                }}
                loading={ticketLoading}
                error={sectionErrors.tickets}
                selectedTicketIds={new Set(ticketSelection.ids)}
                onToggleTicket={(id) => { const ticket = filteredTickets.find((item) => String(item.id) === String(id)); if (ticket) ticketSelection.toggle(ticket); }}
                onSelectVisible={() => ticketSelection.selectPage(filteredTickets)}
                onClearVisible={() => ticketSelection.clearPage(filteredTickets)}
                pagination={ticketPagination}
                pageSize={ticketPageSize}
                onPageChange={setTicketPage}
                onPageSizeChange={(value) => { localStorage.setItem(DASHBOARD_PAGE_SIZE_KEY, String(value)); setTicketPageSize(value); setTicketPage(1); }}
                requesterFilter={requesterFilter}
                departmentFilter={departmentFilter}
                priorityFilter={priorityFilter}
                assignmentScope={assignmentScope}
                onAssignmentScopeChange={setAssignmentScope}
                resultCount={ticketPagination.total}
                onRequesterChange={setRequesterFilter}
                onDepartmentChange={setDepartmentFilter}
                onPriorityChange={setPriorityFilter}
              />

              <KnowledgePanel
                articles={knowledgeArticles}
                loading={loading && knowledgeArticles === null}
                error={sectionErrors.knowledge}
              />
            </div>

            <div className="flex flex-col gap-4">
              <TicketPreview
                ticket={selectedTicket}
                onViewTicket={() => {
                  if (selectedTicket) {
                    navigate(`/tickets/${selectedTicket.id}`);
                  }
                }}
                onAssign={openAssignmentModal}
                onEscalate={() => setShowEscalationModal(true)}
              />

              <QuickActions onCreateTicket={openTicketCreation} />

              <AssetSummary
                assetStats={assetStats}
                onOpenAssets={() => navigate("/assets")}
                loading={loading && assetStats === null}
                error={sectionErrors.assets}
                fill
              />
            </div>
          </div>
        </section>
      </main>

      <BulkTicketActions ticketIds={ticketSelection.ids} tickets={ticketSelection.tickets} groups={groups} busy={actionLoading} onBusyChange={setActionLoading} source="Dashboard Priority Queue" canDelete={canDeleteTickets} onClear={ticketSelection.clear} onComplete={async (result) => { toast.success(result.message, { title: "Bulk ticket operation" }); ticketSelection.clear(); await refreshDashboard(); }} />

      <RequestEntryMenu
        open={showCreateMenu}
        onClose={() => setShowCreateMenu(false)}
        onSelect={(entry) => {
          setShowCreateMenu(false);
          navigate(entry.path);
        }}
      />
      {showLogoutConfirmation && (
        <ConfirmationModal
          title="Sign out of ATD Helpdesk?"
          description="Any unsaved form changes may be lost."
          confirmLabel="Sign out"
          confirming={actionLoading}
          danger
          onCancel={() => setShowLogoutConfirmation(false)}
          onConfirm={handleLogout}
        />
      )}

      {showAssignmentModal && selectedTicket && (
        <ConfirmationModal
          title="Assign Ticket"
          description={`Choose an agent for ${
            selectedTicket.ticket_ref || `TICKET-${selectedTicket.id}`
          }. Only active members of its support group are listed.`}
          confirmLabel="Confirm Assignment"
          confirming={actionLoading}
          confirmDisabled={!selectedGroup || Boolean(sectionErrors.groups)}
          onCancel={() => setShowAssignmentModal(false)}
          onConfirm={confirmAssignment}
        >
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
            <span className="font-semibold text-slate-700">Support group: </span>
            <span className="text-slate-600">
              {selectedGroup?.name ||
                selectedTicket.assigned_group_name ||
                "No support group"}
            </span>
          </div>

          {!selectedGroup && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Assign a support group on the full ticket page before choosing an agent.
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              Assigned Agent
            </span>

            <select
              value={pendingAssigneeId}
              disabled={!selectedGroup || Boolean(sectionErrors.groups)}
              onChange={(event) => {
                setPendingAssigneeId(event.target.value);
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Unassigned</option>

              {assignableUsers.map((userItem) => (
                <option key={userItem.id} value={userItem.id}>
                  {userItem.name} · {userItem.role}
                </option>
              ))}
            </select>
          </label>
        </ConfirmationModal>
      )}

      {showEscalationModal && selectedTicket && (
        <ConfirmationModal
          title="Escalate Ticket"
          description={`Escalate ${
            selectedTicket.ticket_ref || `TICKET-${selectedTicket.id}`
          }? This will change the ticket status to Escalated.`}
          confirmLabel="Confirm Escalation"
          confirming={actionLoading}
          danger
          onCancel={() => setShowEscalationModal(false)}
          onConfirm={confirmEscalation}
        />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  supportingText,
  definition,
  icon: Icon,
  accent,
  onClick,
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={classNames(
        "w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm",
        onClick && "transition hover:-translate-y-0.5 hover:border-[var(--portal-primary)] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            {definition && (
              <span title={definition} aria-label={definition}>
                <Info className="h-3.5 w-3.5 text-slate-400" />
              </span>
            )}
          </div>
          <p className="mt-1.5 text-3xl font-bold leading-none text-slate-950">
            {value}
          </p>
        </div>

        <div className={classNames("rounded-lg p-2", accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-2 text-sm leading-5 text-slate-500">{supportingText}</p>
    </Component>
  );
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
        </div>
        <div className="h-10 w-10 rounded-lg bg-slate-200" />
      </div>
      <div className="mt-4 h-4 w-4/5 rounded bg-slate-100" />
    </div>
  );
}

function PanelSkeleton({ className }) {
  return (
    <div
      className={classNames(
        "animate-pulse rounded-lg bg-slate-50 p-4",
        className
      )}
    >
      <div className="h-full min-h-32 rounded bg-slate-100" />
    </div>
  );
}

function SectionError({ message, className }) {
  return (
    <div
      className={classNames(
        "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800",
        className
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function NotificationMenu({
  menuRef,
  notifications,
  unreadCount,
  open,
  onToggle,
  onClear,
  onAction,
  onReadState,
  onMarkAllRead,
  onSettings,
  actionLoading,
}) {
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        Alerts
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2">
          <NotificationCenter
            notifications={notifications}
            actionLoading={actionLoading}
            onAction={onAction}
            onReadState={onReadState}
            onClear={onClear}
            onMarkAllRead={onMarkAllRead}
            onSettings={onSettings}
          />
        </div>
      ) : null}
    </div>
  );
}
function RangeSelector({
  rangeDays,
  open,
  onToggle,
  onSelect,
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
      >
        Last {rangeDays} days
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onSelect(days)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              Last {days} days
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartPanel({
  title,
  description,
  children,
  toolbar,
  className,
  loading,
  error,
  hasData,
}) {
  return (
    <div
      className={classNames(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        {toolbar}
      </div>

      {error && hasData && (
        <SectionError
          message={`${error} Showing the last loaded data.`}
          className="mb-3"
        />
      )}

      {loading && !hasData ? (
        <PanelSkeleton className="h-56" />
      ) : error && !hasData ? (
        <SectionError message={error} className="min-h-56" />
      ) : (
        <div className="h-56">{children}</div>
      )}
    </div>
  );
}

function ServiceMixPanel({ data, loading, error, hasData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Service Mix</h2>
      <p className="text-sm text-slate-500">
        Workload by support group or workspace.
      </p>

      {error && hasData && (
        <SectionError
          message={`${error} Showing the last loaded data.`}
          className="mt-3"
        />
      )}

      {loading && !hasData ? (
        <PanelSkeleton className="mt-3 h-56" />
      ) : error && !hasData ? (
        <SectionError message={error} className="mt-3 min-h-56" />
      ) : data.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
          No open ticket data is available.
        </p>
      ) : (
        <>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {data.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600">{item.name}</span>
                </div>

                <span className="font-semibold text-slate-950">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TicketQueue({
  tickets,
  selectedTicketId,
  workspaceFilter,
  workspaces,
  onSelectTicket,
  onWorkspaceChange,
  onOpenWorkspace,
  loading,
  error,
  selectedTicketIds,
  onToggleTicket,
  onSelectVisible,
  onClearVisible,
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
  requesterFilter,
  departmentFilter,
  priorityFilter,
  assignmentScope,
  onAssignmentScopeChange,
  resultCount,
  onRequesterChange,
  onDepartmentChange,
  onPriorityChange,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Priority Ticket Queue
            </h2>
            <p className="text-sm text-slate-500">Search covers the full authorised queue. {Number(resultCount || 0).toLocaleString("en-ZA")} matching ticket{Number(resultCount || 0) === 1 ? "" : "s"}. Select a ticket to review it.{loading && tickets.length > 0 && " Updating results…"}</p>
          </div>

          <div className="dashboard-priority-controls flex flex-wrap items-center gap-2"><select value={assignmentScope} onChange={(event)=>onAssignmentScopeChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold" aria-label="Assignment scope"><option value="mine">Assigned to me</option><option value="my-groups">My support groups</option><option value="mine-or-groups">Me or my groups</option><option value="unassigned">Unassigned</option><option value="all">All authorised</option></select><input value={requesterFilter} onChange={(event)=>onRequesterChange(event.target.value)} placeholder="Requester" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"/><input value={departmentFilter} onChange={(event)=>onDepartmentChange(event.target.value)} placeholder="Department" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"/><select value={priorityFilter} onChange={(event)=>onPriorityChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold"><option value="">All priorities</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select><button type="button" onClick={onSelectVisible} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">Select current page</button><button type="button" onClick={onClearVisible} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">Clear current page</button><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold">{DASHBOARD_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}</select><select
            value={workspaceFilter}
            onChange={(event) => onWorkspaceChange(event.target.value)}
            disabled={workspaces.length === 1}
            aria-label="Ticket workspace"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.code} value={workspace.code}>{workspace.label}</option>
            ))}
          </select></div>
        </div>
      </div>

      <div className="max-h-[40rem] divide-y divide-slate-100 overflow-y-auto">
        {loading && tickets.length === 0 ? (
          Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid animate-pulse gap-3 px-4 py-2.5 lg:grid-cols-[1fr_150px_100px]"
            >
              <div>
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-3/4 rounded bg-slate-100" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-slate-100" />
              </div>
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-3 w-full rounded bg-slate-100" />
            </div>
          ))
        ) : error ? (
          <SectionError message={error} className="m-3" />
        ) : tickets.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No tickets found.
          </div>
        ) : (
          tickets.map((ticketItem) => {
            const slaPercent = getSlaPercent(ticketItem);

            return (
              <div key={ticketItem.id} className="flex items-stretch"><label className="flex w-11 shrink-0 items-center justify-center border-r border-slate-100"><input type="checkbox" checked={selectedTicketIds.has(String(ticketItem.id))} onChange={() => onToggleTicket(ticketItem.id)} aria-label={`Select ${ticketItem.ticket_ref || ticketItem.id}`}/></label><button
                type="button"
                onClick={() => onSelectTicket(ticketItem)}
                className={classNames(
                  "grid w-full gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_150px_100px] lg:items-center",
                  selectedTicketId === ticketItem.id && "bg-[var(--portal-selected-bg)]"
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--portal-primary)]">
                      {ticketItem.ticket_ref || `TICKET-${ticketItem.id}`}
                      {/* ATD-SCRIPT-828-FIX-NEW-TAG */}
                      {ticketItem.is_new ? (
                        <span
                          className="inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
                          title={ticketItem.new_expires_at ? `New until ${new Date(ticketItem.new_expires_at).toLocaleString("en-ZA")}` : "Created within the last 24 hours"}
                        >
                          New
                        </span>
                      ) : null}
                    </span>

                    <span
                      className={classNames(
                        "rounded-full border px-2 py-0.5 text-xs font-bold",
                        getPriorityClassName(ticketItem.priority)
                      )}
                    >
                      {ticketItem.priority || "Medium"}
                    </span>

                    <span
                      className={classNames(
                        "rounded-full px-2 py-0.5 text-xs font-bold",
                        getStatusClassName(ticketItem.status)
                      )}
                    >
                      {ticketItem.status || "Open"}
                    </span>
                  </div>

                  <p className="mt-1 font-semibold text-slate-950">
                    {ticketItem.title}
                  </p>

                  <p className="mt-0.5 text-sm text-slate-500">
                    {ticketItem.requester_name || "Unknown requester"} ·{" "}
                    {ticketItem.assigned_group_name ||
                      ticketItem.workspace ||
                      "No group"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {ticketItem.assigned_to_name || "Unassigned"}
                  </p>
                  <p className="text-xs text-slate-500">Assigned agent</p>
                </div>

                <div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={classNames(
                        "h-2 rounded-full",
                        slaPercent <= 25
                          ? "portal-sla-breached"
                          : slaPercent <= 50
                          ? "portal-sla-risk"
                          : "portal-sla-normal"
                      )}
                      style={{ width: `${slaPercent}%` }}
                    />
                  </div>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    SLA {slaPercent}% · {getTicketAge(ticketItem)}
                  </p>
                </div>
              </button></div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" disabled={loading || pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
          <span className="text-xs font-bold text-slate-500">Page {pagination.page} of {pagination.totalPages} | {pagination.total} tickets</span>
          <button type="button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-40">Next</button>
        </div>
        <button type="button" onClick={onOpenWorkspace} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-[var(--portal-primary)] hover:bg-[var(--portal-selected-bg)]">View all in Ticket Workspace</button>
      </div>
    </div>
  );
}

function TicketPreview({
  ticket,
  onViewTicket,
  onAssign,
  onEscalate,
}) {
  if (!ticket) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Select a ticket to view details.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">Ticket Preview</h2>

        <span
          className={classNames(
            "rounded-full border px-2 py-0.5 text-xs font-bold",
            getPriorityClassName(ticket.priority)
          )}
        >
          {ticket.priority || "Medium"}
        </span>
      </div>

      <p className="mt-2 text-sm font-bold text-[var(--portal-primary)]">
        {ticket.ticket_ref || `TICKET-${ticket.id}`}
        {/* ATD-SCRIPT-828-FIX-NEW-TAG */}
        {ticket.is_new ? (
          <span
            className="inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
            title={ticket.new_expires_at ? `New until ${new Date(ticket.new_expires_at).toLocaleString("en-ZA")}` : "Created within the last 24 hours"}
          >
            New
          </span>
        ) : null}
      </p>

      <p className="mt-1 text-base font-semibold text-slate-950">
        {ticket.title}
      </p>

      <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-slate-500">
        {ticket.description || "No description provided."}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <InfoBox label="Workspace" value={ticket.workspace} />
        <InfoBox label="Status" value={ticket.status} />
        <InfoBox
          label="Group"
          value={ticket.assigned_group_name || "No group"}
        />
        <InfoBox
          label="Agent"
          value={ticket.assigned_to_name || "Unassigned"}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onViewTicket}
          className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          View Ticket
        </button>

        <button
          type="button"
          onClick={onAssign}
          className="rounded-xl border border-[var(--portal-selected-border)] px-3 py-2 text-sm font-semibold text-[var(--portal-primary)] hover:bg-[var(--portal-selected-bg)]"
        >
          Assign
        </button>

        <button
          type="button"
          onClick={onEscalate}
          className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Escalate
        </button>
      </div>
    </div>
  );
}

function QuickActions({ onCreateTicket }) {
  const actions = [
    {
      label: "Report Incident",
      icon: LifeBuoy,
      onClick: () => onCreateTicket("incident"),
    },
    {
      label: "Service Catalog",
      icon: ShoppingCart,
      onClick: () => onCreateTicket("service_request"),
    },
    {
      label: "Request Asset",
      icon: PackagePlus,
      onClick: () => onCreateTicket("asset_request"),
    },
    {
      label: "Request Change",
      icon: BriefcaseBusiness,
      onClick: () => onCreateTicket("change"),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Quick Actions</h2>
      <p className="text-sm text-slate-500">
        Fast workflows for the support team.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="rounded-lg border border-slate-200 p-2.5 text-left transition hover:border-[var(--portal-primary)] hover:bg-[var(--portal-selected-bg)]"
            >
              <Icon className="h-4 w-4 text-[var(--portal-primary)]" />
              <p className="mt-2 text-sm font-bold text-slate-950">
                {action.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AssetSummary({ assetStats, onOpenAssets, loading, error, fill = false }) {
  return (
    <div
      className={classNames(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        fill && "flex flex-1 flex-col"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Asset Inventory</h2>
          <p className="text-sm text-slate-500">
            Live from the Asset Management System.
          </p>
        </div>

        {assetStats && (
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="text-2xl font-bold leading-none text-slate-950">
              {formatCount(assetStats.total || 0)}
            </p>
          </div>
        )}
      </div>

      <div className={classNames("mt-3", fill && "flex flex-1 flex-col")}>
        {loading && !assetStats ? (
          <PanelSkeleton className="h-40" />
        ) : error && !assetStats ? (
          <SectionError message={error} />
        ) : !assetStats ? (
          <p className="text-sm text-slate-500">Asset data unavailable.</p>
        ) : (
          <>
            {error && (
              <SectionError
                message={`${error} Showing the last loaded data.`}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                ["In Use", "assigned", "bg-emerald-500"],
                ["In Storage", "storage", "bg-slate-400"],
                ["Damaged", "damaged", "bg-red-500"],
                ["Untraced", "untraced", "bg-amber-500"],
              ].map(([label, key, barClass]) => {
                const count = assetStats.by_status?.[key] || 0;
                const percentage = assetStats.total
                  ? Math.round((count / assetStats.total) * 100)
                  : 0;

                return (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-100 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950">
                        {label}
                      </p>
                      <span className="text-sm font-bold text-slate-950">
                        {count}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                      <div
                        className={classNames("h-1.5 rounded-full", barClass)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onOpenAssets}
              className={classNames(
                "w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-[var(--portal-primary)] hover:bg-[var(--portal-selected-bg)]",
                fill ? "mt-auto pt-3" : "mt-3"
              )}
            >
              View all assets →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function KnowledgePanel({ articles, loading, error }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">
        Knowledge Suggestions
      </h2>
      <p className="text-sm text-slate-500">
        Available reference titles from the knowledge base.
      </p>

      {error && articles !== null && (
        <SectionError
          message={`${error} Showing the last loaded titles.`}
          className="mt-3"
        />
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {loading && !articles ? (
          <>
            <PanelSkeleton className="h-20" />
            <PanelSkeleton className="h-20" />
            <PanelSkeleton className="h-20" />
          </>
        ) : error && !articles ? (
          <SectionError message={error} className="md:col-span-3" />
        ) : articles?.length === 0 ? (
          <p className="text-sm text-slate-500">
            No knowledge suggestions found.
          </p>
        ) : (
          articles?.map((article, index) => (
            <div
              key={article.id || article.title}
              className="flex w-full items-start gap-2.5 rounded-lg border border-slate-100 p-3 text-left"
            >
              <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-[var(--portal-primary)]">
                {index + 1}
              </div>

              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{article.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Reference title available to the support team.
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ConfirmationModal({
  title,
  description,
  confirmLabel,
  confirming,
  confirmDisabled = false,
  danger = false,
  onCancel,
  onConfirm,
  children,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="confirmation-title"
              className="text-xl font-bold text-slate-950"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children && <div className="mt-5">{children}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming || confirmDisabled}
            className={classNames(
              "rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60",
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "portal-accent-fill bg-[var(--portal-primary)] hover:opacity-90"
            )}
          >
            {confirming ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 font-semibold text-slate-950">{value || "N/A"}</p>
    </div>
  );
}
