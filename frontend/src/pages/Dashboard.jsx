import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Factory,
  Gauge,
  HardDrive,
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Ticket,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import api, {
  assetsApi,
  knowledgeApi,
  notificationApi,
  ticketsApi,
} from "../services/api";

const DASHBOARD_TICKET_LIMIT = 100;
const NOTIFICATION_MODULE = "admin";

const CREATE_TICKET_OPTIONS = [
  {
    type: "incident",
    title: "Report an Issue",
    description:
      "Report something that is broken, unavailable or working incorrectly.",
    icon: LifeBuoy,
    colorClass: "border-red-200 bg-red-50 text-red-700",
  },
  {
    type: "service_request",
    title: "Request a Service",
    description:
      "Request software, access, equipment or another standard IT service.",
    icon: Wrench,
    colorClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    type: "change",
    title: "Change Management Request",
    description:
      "Request a planned change that requires assessment, approval and scheduling.",
    icon: Settings,
    colorClass: "border-purple-200 bg-purple-50 text-purple-700",
  },
];

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
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

function getTicketAge(ticketItem) {
  if (!ticketItem.created_at) {
    return "—";
  }

  return formatDuration(
    Date.now() - new Date(ticketItem.created_at).getTime()
  );
}

function getTicketType(ticketItem) {
  const reference = String(ticketItem.ticket_ref || "").toUpperCase();

  if (reference.startsWith("REQ")) {
    return "requests";
  }

  if (reference.startsWith("CHG")) {
    return "changes";
  }

  return "incidents";
}

function getSlaPercent(ticketItem) {
  if (!ticketItem.due_at || !ticketItem.created_at) {
    return 100;
  }

  const createdAt = new Date(ticketItem.created_at).getTime();
  const dueAt = new Date(ticketItem.due_at).getTime();
  const comparisonTime = ticketItem.closed_at
    ? new Date(ticketItem.closed_at).getTime()
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

  return classes[priority] || classes.Medium;
}

function getStatusClassName(status) {
  const classes = {
    Open: "bg-blue-100 text-blue-700",
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [assetStats, setAssetStats] = useState(null);
  const [knowledgeArticles, setKnowledgeArticles] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [query, setQuery] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("All");
  const [rangeDays, setRangeDays] = useState(7);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showEscalationModal, setShowEscalationModal] = useState(false);

  const [pendingAssigneeId, setPendingAssigneeId] = useState("");

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      ticketsApi.getAll({ limit: DASHBOARD_TICKET_LIMIT }),
      notificationApi.getAll({ module: NOTIFICATION_MODULE }),
      assetsApi.getStats(),
      knowledgeApi.getAll(),
      api.get("/auth/users"),
    ]);

    const [
      ticketResult,
      notificationResult,
      assetResult,
      knowledgeResult,
      userResult,
    ] = results;

    if (ticketResult.status === "fulfilled") {
      const payload = ticketResult.value.data;
      const ticketData = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.tickets)
          ? payload.tickets
          : [];

      setTickets(ticketData);

      setSelectedTicket((currentTicket) => {
        if (!currentTicket) {
          return ticketData[0] || null;
        }

        return (
          ticketData.find((ticketItem) => {
            return ticketItem.id === currentTicket.id;
          }) ||
          ticketData[0] ||
          null
        );
      });
    }

    if (notificationResult.status === "fulfilled") {
      setNotifications(
        Array.isArray(notificationResult.value.data)
          ? notificationResult.value.data
          : []
      );
    }

    if (assetResult.status === "fulfilled") {
      setAssetStats(assetResult.value.data || null);
    }

    if (knowledgeResult.status === "fulfilled") {
      setKnowledgeArticles(
        Array.isArray(knowledgeResult.value.data)
          ? knowledgeResult.value.data
          : []
      );
    }

    if (userResult.status === "fulfilled") {
      const userData = Array.isArray(userResult.value.data)
        ? userResult.value.data
        : [];

      setAssignableUsers(
        userData.filter((userItem) => {
          return [
            "agent",
            "operator",
            "manager",
            "admin",
            "superadmin",
          ].includes(userItem.role);
        })
      );
    }

    const rejectedCount = results.filter((result) => {
      return result.status === "rejected";
    }).length;

    if (rejectedCount > 0) {
      setError(
        `${rejectedCount} dashboard section${
          rejectedCount === 1 ? "" : "s"
        } could not be loaded.`
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => {
      return !notification.is_read;
    }).length;
  }, [notifications]);

  const filteredTickets = useMemo(() => {
    const normalizedQuery = normalize(query);

    return tickets.filter((ticketItem) => {
      const searchableText = [
        ticketItem.ticket_ref,
        ticketItem.title,
        ticketItem.description,
        ticketItem.requester_name,
        ticketItem.assigned_to_name,
        ticketItem.assigned_group_name,
        ticketItem.workspace,
        ticketItem.priority,
        ticketItem.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedQuery || searchableText.includes(normalizedQuery);

      const matchesWorkspace =
        workspaceFilter === "All" ||
        ticketItem.workspace === workspaceFilter;

      return matchesSearch && matchesWorkspace;
    });
  }, [query, tickets, workspaceFilter]);

  const statistics = useMemo(() => {
    const openTickets = tickets.filter((ticketItem) => {
      return !["closed", "resolved"].includes(
        normalize(ticketItem.status)
      );
    });

    const criticalTickets = tickets.filter((ticketItem) => {
      return (
        normalize(ticketItem.priority) === "critical" ||
        getSlaPercent(ticketItem) < 30
      );
    });

    const ticketsWithDueDates = tickets.filter((ticketItem) => {
      return Boolean(ticketItem.due_at);
    });

    const ticketsWithinSla = ticketsWithDueDates.filter((ticketItem) => {
      const dueAt = new Date(ticketItem.due_at).getTime();
      const endTime = ticketItem.closed_at
        ? new Date(ticketItem.closed_at).getTime()
        : Date.now();

      return endTime <= dueAt;
    });

    const slaCompliance = ticketsWithDueDates.length
      ? `${Math.round(
          (ticketsWithinSla.length / ticketsWithDueDates.length) * 100
        )}%`
      : "N/A";

    const resolutionDurations = tickets
      .filter((ticketItem) => {
        return ticketItem.closed_at && ticketItem.created_at;
      })
      .map((ticketItem) => {
        return (
          new Date(ticketItem.closed_at).getTime() -
          new Date(ticketItem.created_at).getTime()
        );
      });

    const averageResolution = resolutionDurations.length
      ? formatDuration(
          resolutionDurations.reduce((total, duration) => {
            return total + duration;
          }, 0) / resolutionDurations.length
        )
      : "N/A";

    return {
      open: openTickets.length,
      total: tickets.length,
      critical: criticalTickets.length,
      slaCompliance,
      averageResolution,
    };
  }, [tickets]);

  const volumeData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    const dailyMap = {};

    cutoff.setDate(cutoff.getDate() - (rangeDays - 1));
    cutoff.setHours(0, 0, 0, 0);

    for (let dayOffset = rangeDays - 1; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - dayOffset);

      const key = date.toLocaleDateString("en-US", {
        weekday: "short",
      });

      dailyMap[key] = {
        day: key,
        incidents: 0,
        requests: 0,
        changes: 0,
      };
    }

    for (const ticketItem of tickets) {
      if (!ticketItem.created_at) {
        continue;
      }

      const createdAt = new Date(ticketItem.created_at);

      if (createdAt < cutoff) {
        continue;
      }

      const key = createdAt.toLocaleDateString("en-US", {
        weekday: "short",
      });

      const type = getTicketType(ticketItem);

      if (!dailyMap[key]) {
        dailyMap[key] = {
          day: key,
          incidents: 0,
          requests: 0,
          changes: 0,
        };
      }

      dailyMap[key][type] += 1;
    }

    return Object.values(dailyMap);
  }, [rangeDays, tickets]);

  const serviceMixData = useMemo(() => {
    const colors = [
      "#2563eb",
      "#7c3aed",
      "#16a34a",
      "#f97316",
      "#0891b2",
    ];

    const groupedTickets = tickets.reduce((groups, ticketItem) => {
      const groupName =
        ticketItem.assigned_group_name ||
        ticketItem.workspace ||
        "Unassigned / Other";

      groups[groupName] = (groups[groupName] || 0) + 1;
      return groups;
    }, {});

    return Object.entries(groupedTickets).map(
      ([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      })
    );
  }, [tickets]);

  const workspaces = useMemo(() => {
    const uniqueWorkspaces = new Set(
      tickets
        .map((ticketItem) => ticketItem.workspace)
        .filter(Boolean)
    );

    return ["All", ...Array.from(uniqueWorkspaces)];
  }, [tickets]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleOpenNotifications = async () => {
    const shouldOpen = !showNotifications;
    setShowNotifications(shouldOpen);

    if (!shouldOpen || unreadCount === 0) {
      return;
    }

    try {
      await notificationApi.markAllRead(NOTIFICATION_MODULE);

      setNotifications((currentNotifications) => {
        return currentNotifications.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at || new Date().toISOString(),
        }));
      });
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Failed to mark notifications as read."
        )
      );
    }
  };

  const handleClearNotifications = async () => {
    const confirmed = window.confirm(
      "Clear all Helpdesk administration notifications?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await notificationApi.clearAll(NOTIFICATION_MODULE);
      setNotifications([]);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Failed to clear notifications.")
      );
    }
  };

  const openTicketCreation = (ticketType) => {
    setShowCreateMenu(false);

    navigate(`/tickets/new?type=${ticketType}`, {
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

    const confirmed = window.confirm(
      pendingAssigneeId
        ? "Confirm assignment of this ticket to the selected agent?"
        : "Confirm removal of the current direct agent assignment?"
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);

    try {
      await ticketsApi.assign(
        selectedTicket.id,
        pendingAssigneeId ? Number(pendingAssigneeId) : null,
        selectedTicket.assigned_group_id || null
      );

      setShowAssignmentModal(false);
      await fetchDashboardData();
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

    const confirmed = window.confirm(
      `Escalate ${
        selectedTicket.ticket_ref || `TICKET-${selectedTicket.id}`
      }?`
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);

    try {
      await ticketsApi.updateStatus(selectedTicket.id, "Escalated");
      setShowEscalationModal(false);
      await fetchDashboardData();
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
        onToggle={() => {
          setSidebarCollapsed((currentValue) => !currentValue);
        }}
      />

      <main
        className={classNames(
          "transition-[padding] duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between xl:px-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Factory className="h-4 w-4" />
                ATD IT Department / Infrastructure + ERP Support
              </div>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                Helpdesk Operations Dashboard
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-64 flex-1 xl:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticket, requester or group..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <NotificationMenu
                notifications={notifications}
                unreadCount={unreadCount}
                open={showNotifications}
                onToggle={handleOpenNotifications}
                onClear={handleClearNotifications}
                onOpenNotification={(notification) => {
                  if (notification.target_url) {
                    navigate(notification.target_url);
                  }
                }}
              />

              <button
                type="button"
                onClick={fetchDashboardData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  className={classNames(
                    "h-4 w-4",
                    loading && "animate-spin"
                  )}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                Logout
              </button>

              <Link
                to="/admin/users"
                className="rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-700"
              >
                Manage Users
              </Link>

              <Link
                to="/production"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  New Ticket
                  <ChevronDown className="h-4 w-4" />
                </button>

                {showCreateMenu && (
                  <CreateTicketMenu
                    onSelect={openTicketCreation}
                    onClose={() => setShowCreateMenu(false)}
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-6 px-5 py-6 xl:px-8">
          {error && (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Open Tickets"
              value={statistics.open}
              supportingValue={`${statistics.total} total`}
              supportingText="tickets in system"
              icon={Ticket}
              accent="bg-blue-100 text-blue-700"
            />

            <StatCard
              title="SLA Compliance"
              value={statistics.slaCompliance}
              supportingValue="Live"
              supportingText="based on due dates"
              icon={Gauge}
              accent="bg-emerald-100 text-emerald-700"
            />

            <StatCard
              title="Critical / At Risk"
              value={statistics.critical}
              supportingValue="Review"
              supportingText="tickets needing attention"
              icon={AlertTriangle}
              accent="bg-red-100 text-red-700"
            />

            <StatCard
              title="Average Resolution"
              value={statistics.averageResolution}
              supportingValue="Closed"
              supportingText="average duration"
              icon={Clock}
              accent="bg-purple-100 text-purple-700"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ChartPanel
              title="Ticket Volume"
              description="Incidents, service requests and changes by created date."
              className="xl:col-span-2"
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
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="incidents"
                    fill="#2563eb"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="requests"
                    fill="#7c3aed"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="changes"
                    fill="#f97316"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ServiceMixPanel data={serviceMixData} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <TicketQueue
              tickets={filteredTickets.slice(0, 10)}
              selectedTicketId={selectedTicket?.id}
              workspaceFilter={workspaceFilter}
              workspaces={workspaces}
              onSelectTicket={setSelectedTicket}
              onWorkspaceChange={setWorkspaceFilter}
            />

            <div className="space-y-6">
              <TicketPreview
                ticket={selectedTicket}
                onOpenCase={() => {
                  if (selectedTicket) {
                    navigate(`/tickets/${selectedTicket.id}`);
                  }
                }}
                onAssign={openAssignmentModal}
                onEscalate={() => setShowEscalationModal(true)}
              />

              <QuickActions
                onCreateTicket={openTicketCreation}
                onOpenAssets={() => navigate("/assets")}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AssetSummary
              assetStats={assetStats}
              onOpenAssets={() => navigate("/assets")}
            />

            <KnowledgePanel
              articles={knowledgeArticles}
              onOpenArticle={() => navigate("/tickets/new?type=incident")}
            />
          </div>
        </section>
      </main>

      {showAssignmentModal && selectedTicket && (
        <ConfirmationModal
          title="Assign Ticket"
          description={`Choose an agent for ${
            selectedTicket.ticket_ref || `TICKET-${selectedTicket.id}`
          }. The change will only be saved after confirmation.`}
          confirmLabel="Confirm Assignment"
          confirming={actionLoading}
          onCancel={() => setShowAssignmentModal(false)}
          onConfirm={confirmAssignment}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              Assigned Agent
            </span>

            <select
              value={pendingAssigneeId}
              onChange={(event) => {
                setPendingAssigneeId(event.target.value);
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
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
  supportingValue,
  supportingText,
  icon: Icon,
  accent,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>

        <div className={classNames("rounded-2xl p-3", accent)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <TrendingUp className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-emerald-600">
          {supportingValue}
        </span>
        <span className="text-slate-500">{supportingText}</span>
      </div>
    </div>
  );
}

function NotificationMenu({
  notifications,
  unreadCount,
  open,
  onToggle,
  onClear,
  onOpenNotification,
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="relative inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        Alerts

        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,26rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-950">Notifications</h3>

            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">
                No notifications
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => onOpenNotification(notification)}
                  className={classNames(
                    "block w-full rounded-xl border p-3 text-left text-sm transition hover:brightness-95",
                    notification.is_read
                      ? "border-slate-200 bg-slate-50"
                      : notification.type === "critical"
                      ? "border-red-300 bg-red-50"
                      : notification.type === "warning"
                      ? "border-amber-300 bg-amber-50"
                      : "border-blue-200 bg-blue-50"
                  )}
                >
                  <p className="font-semibold text-slate-800">
                    {notification.message}
                  </p>

                  {notification.created_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTicketMenu({ onSelect, onClose }) {
  return (
    <div className="absolute right-0 z-50 mt-2 w-[min(92vw,28rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
      <div className="flex items-center justify-between px-2 pb-2">
        <div>
          <p className="font-bold text-slate-950">Create New Ticket</p>
          <p className="text-xs text-slate-500">
            Choose the workflow that best matches the request.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 hover:bg-slate-100"
          aria-label="Close ticket creation menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {CREATE_TICKET_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onSelect(option.type)}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-slate-50"
            >
              <div
                className={classNames(
                  "rounded-xl border p-2.5",
                  option.colorClass
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div>
                <p className="font-bold text-slate-950">{option.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
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
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        {toolbar}
      </div>

      <div className="h-72">{children}</div>
    </div>
  );
}

function ServiceMixPanel({ data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Service Mix</h2>
      <p className="text-sm text-slate-500">
        Workload by support group or workspace.
      </p>

      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={4}
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
        {data.length === 0 ? (
          <p className="text-sm text-slate-500">No ticket data yet</p>
        ) : (
          data.map((item) => (
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
          ))
        )}
      </div>
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
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Priority Ticket Queue
            </h2>
            <p className="text-sm text-slate-500">
              Select a ticket to review it. Editing is available only in the
              ticket preview or full ticket page.
            </p>
          </div>

          <select
            value={workspaceFilter}
            onChange={(event) => onWorkspaceChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {workspaces.map((workspace) => (
              <option key={workspace}>{workspace}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No tickets found.
          </div>
        ) : (
          tickets.map((ticketItem) => {
            const slaPercent = getSlaPercent(ticketItem);

            return (
              <button
                key={ticketItem.id}
                type="button"
                onClick={() => onSelectTicket(ticketItem)}
                className={classNames(
                  "grid w-full gap-4 p-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_160px_110px] lg:items-center",
                  selectedTicketId === ticketItem.id && "bg-blue-50/70"
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-blue-700">
                      {ticketItem.ticket_ref || `TICKET-${ticketItem.id}`}
                    </span>

                    <span
                      className={classNames(
                        "rounded-full border px-2.5 py-1 text-xs font-bold",
                        getPriorityClassName(ticketItem.priority)
                      )}
                    >
                      {ticketItem.priority || "Medium"}
                    </span>

                    <span
                      className={classNames(
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        getStatusClassName(ticketItem.status)
                      )}
                    >
                      {ticketItem.status || "Open"}
                    </span>
                  </div>

                  <p className="mt-2 font-semibold text-slate-950">
                    {ticketItem.title}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
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
                        slaPercent < 30
                          ? "bg-red-500"
                          : slaPercent < 60
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{ width: `${slaPercent}%` }}
                    />
                  </div>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    SLA {slaPercent}% · {getTicketAge(ticketItem)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function TicketPreview({
  ticket,
  onOpenCase,
  onAssign,
  onEscalate,
}) {
  if (!ticket) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Select a ticket to view details.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">Ticket Preview</h2>

        <span
          className={classNames(
            "rounded-full border px-2.5 py-1 text-xs font-bold",
            getPriorityClassName(ticket.priority)
          )}
        >
          {ticket.priority || "Medium"}
        </span>
      </div>

      <p className="mt-3 text-sm font-bold text-blue-700">
        {ticket.ticket_ref || `TICKET-${ticket.id}`}
      </p>

      <p className="mt-1 text-base font-semibold text-slate-950">
        {ticket.title}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {ticket.description || "No description provided."}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
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

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenCase}
          className="rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Open Case
        </button>

        <button
          type="button"
          onClick={onAssign}
          className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Assign
        </button>

        <button
          type="button"
          onClick={onEscalate}
          className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Escalate
        </button>
      </div>
    </div>
  );
}

function QuickActions({ onCreateTicket, onOpenAssets }) {
  const actions = [
    {
      label: "Log Incident",
      icon: LifeBuoy,
      onClick: () => onCreateTicket("incident"),
    },
    {
      label: "Request Service",
      icon: Wrench,
      onClick: () => onCreateTicket("service_request"),
    },
    {
      label: "Raise Change",
      icon: Settings,
      onClick: () => onCreateTicket("change"),
    },
    {
      label: "Review Assets",
      icon: HardDrive,
      onClick: onOpenAssets,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Quick Actions</h2>
      <p className="text-sm text-slate-500">
        Fast workflows for the support team.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <Icon className="h-5 w-5 text-blue-700" />
              <p className="mt-3 text-sm font-bold text-slate-950">
                {action.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AssetSummary({ assetStats, onOpenAssets }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Asset Inventory</h2>
      <p className="text-sm text-slate-500">
        Live from the Asset Management System.
      </p>

      <div className="mt-4 space-y-3">
        {!assetStats ? (
          <p className="text-sm text-slate-500">Asset data unavailable.</p>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-sm text-slate-500">Total Assets</p>
              <p className="mt-1 text-3xl font-bold text-slate-950">
                {assetStats.total || 0}
              </p>
            </div>

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
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-950">{label}</p>
                    <span className="font-bold text-slate-950">{count}</span>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className={classNames("h-2 rounded-full", barClass)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={onOpenAssets}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50"
            >
              View all assets →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function KnowledgePanel({ articles, onOpenArticle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
      <h2 className="text-lg font-bold text-slate-950">
        Knowledge Suggestions
      </h2>
      <p className="text-sm text-slate-500">
        Articles from the knowledge API.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {articles.length === 0 ? (
          <p className="text-sm text-slate-500">
            No knowledge suggestions found.
          </p>
        ) : (
          articles.map((article, index) => (
            <button
              key={article.id || article.title}
              type="button"
              onClick={() => onOpenArticle(article)}
              className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 p-4 text-left hover:bg-slate-50"
            >
              <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                {index + 1}
              </div>

              <div>
                <p className="font-semibold text-slate-950">
                  {article.title}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Review before creating or updating a ticket.
                </p>
              </div>
            </button>
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
  danger = false,
  onCancel,
  onConfirm,
  children,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
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
            disabled={confirming}
            className={classNames(
              "rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60",
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
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
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-950">{value || "N/A"}</p>
    </div>
  );
}
