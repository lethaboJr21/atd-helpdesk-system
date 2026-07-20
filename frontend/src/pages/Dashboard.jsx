import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { notificationApi, ticketsApi } from "../services/api";
import Sidebar from "../components/Sidebar";
console.log("✅ NEW BUILD VERSION LOADED");
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Database,
  Factory,
  Filter,
  Gauge,
  HardDrive,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  Network,
  Plus,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Ticket,
  TrendingUp,
  Users,
  Wrench,
  Zap,
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

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function priorityClass(priority) {
  return {
    Critical: "bg-red-100 text-red-700 border-red-200",
    High: "bg-orange-100 text-orange-700 border-orange-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  }[priority || "Medium"];
}

function statusClass(status) {
  return {
    Open: "bg-blue-100 text-blue-700",
    Assigned: "bg-slate-100 text-slate-700",
    Pending: "bg-purple-100 text-purple-700",
    Investigating: "bg-indigo-100 text-indigo-700",
    "Waiting Approval": "bg-purple-100 text-purple-700",
    Resolved: "bg-emerald-100 text-emerald-700",
    Closed: "bg-slate-200 text-slate-700",
    Escalated: "bg-red-100 text-red-700",
  }[status || "Open"];
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "0m";

  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;

  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function getTicketType(ticket) {
  const ref = String(ticket.ticket_ref || "").toUpperCase();

  if (ref.startsWith("REQ")) return "requests";
  if (ref.startsWith("CHG")) return "changes";

  return "incidents";
}


function normalize(value) {
  return (value || "").toString().toLowerCase();
}

function getTicketAge(ticket) {
  if (!ticket.created_at) return "—";
  return formatDuration(Date.now() - new Date(ticket.created_at).getTime());
}

function getSlaPercent(ticket) {
  if (!ticket.due_at || !ticket.created_at) return 100;

  const created = new Date(ticket.created_at).getTime();
  const due = new Date(ticket.due_at).getTime();
  const now = ticket.closed_at
    ? new Date(ticket.closed_at).getTime()
    : Date.now();

  const total = due - created;
  const remaining = due - now;

  if (total <= 0) return 0;

  return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
}

function StatCard({ title, value, delta, icon: Icon, accent, subtext }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div className={classNames("rounded-2xl p-3", accent)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <TrendingUp className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-emerald-600">{delta}</span>
        <span className="text-slate-500">{subtext}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [assetStats, setAssetStats] = useState(null);
  const [knowledge, setKnowledge] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [query, setQuery] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("All");
  const [rangeDays, setRangeDays] = useState(7);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const iconMap = {
    Server,
    Network,
    Factory,
    Database,
    Code2,
    Settings,
    ShieldCheck,
    Smartphone,
    Users,
    Wrench,
    Headphones,
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchDashboardData = async () => {
    setLoading(true);

    try {

        const [
          ticketRes,
          notificationRes,
          assetRes,
          knowledgeRes,
          userRes,
        ] = await Promise.allSettled([
          ticketsApi.getAll(),
          notificationApi.getAll({ module: "admin" }),
          api.get("/assets/stats"),
          api.get("/knowledge"),
          api.get("/auth/users"),
        ]);

        if (ticketRes.status === "fulfilled") {
          const data = ticketRes.value.data || [];
          setTickets(data);
        
          setSelectedTicket((current) => {
            if (!current) return data[0] || null;
            return data.find((t) => t.id === current.id) || data[0] || null;
          });
        }

        if (userRes.status === "fulfilled") {
          setUsers(userRes.value.data || []);
        }

        if (notificationRes.status === "fulfilled") {
          setNotifications(notificationRes.value.data || []);
        }

        if (assetRes.status === "fulfilled") {
          setAssetStats(assetRes.value.data || null);
        }

        if (knowledgeRes.status === "fulfilled") {
          setKnowledge(knowledgeRes.value.data || []);
        }

        } catch (err) {
          console.error("Failed to fetch dashboard data:", err);
        } finally {
          setLoading(false);
        }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleOpenNotifications = async () => {
    setShowNotifications((prev) => !prev);

    if (!showNotifications) {
      try {
        await notificationApi.markAllRead({ module: "admin" });
        setNotifications((prev) =>
          prev.map((notification) => ({
            ...notification,
            is_read: true,
          }))
        );
      } catch (err) {
        console.error("Failed to mark notifications read:", err);
      }
    }
  };

  const handleClearNotifications = async () => {
    try {
      await notificationApi.clearAll();
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

 const filteredTickets = useMemo(() => {
  return tickets.filter((ticket) => {
    const text = [
      ticket.ticket_ref,
      ticket.title,
      ticket.description,
      ticket.requester_name,
      ticket.assigned_to_name,
      ticket.assigned_group_name,
      ticket.workspace,
      ticket.priority,
      ticket.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      text.includes(query.toLowerCase()) &&
      (workspaceFilter === "All" || ticket.workspace === workspaceFilter)
    );
  });
}, [tickets, query, workspaceFilter]);

  
const stats = useMemo(() => {
  const open = tickets.filter(
    (t) => !["closed", "resolved"].includes(normalize(t.status))
  );

  const critical = tickets.filter(
    (t) =>
      normalize(t.priority) === "critical" ||
      getSlaPercent(t) < 30
  );

  const ticketsWithDueDate = tickets.filter((t) => t.due_at);

  const withinSla = ticketsWithDueDate.filter((t) => {
    const due = new Date(t.due_at).getTime();
    const end = t.closed_at
      ? new Date(t.closed_at).getTime()
      : Date.now();

    return end <= due;
  });

  const slaCompliance =
    ticketsWithDueDate.length > 0
      ? `${Math.round(
          (withinSla.length / ticketsWithDueDate.length) * 100
        )}%`
      : "N/A";

  const resolvedDurations = tickets
    .filter((t) => t.closed_at && t.created_at)
    .map(
      (t) =>
        new Date(t.closed_at) -
        new Date(t.created_at)
    );

  const avgResolution =
    resolvedDurations.length > 0
      ? formatDuration(
          resolvedDurations.reduce((a, b) => a + b, 0) /
            resolvedDurations.length
        )
      : "N/A";

  return {
    open: open.length,
    total: tickets.length,
    critical: critical.length,
    slaCompliance,
    avgResolution,
  };
}, [tickets]);


  const assignTicket = async (ticketId, userId) => {
    try {
      await api.patch(`/tickets/${ticketId}`, {
      assigned_to: userId || null,
      });

      fetchDashboardData(); // refresh UI
      } catch (err) {
        console.error("Assignment failed:", err);
      }
    };

  const volumeData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - (rangeDays - 1));
    cutoff.setHours(0, 0, 0, 0);

    const map = {};

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);

      const key = d.toLocaleDateString("en-US", { weekday: "short" });

      map[key] = {
        day: key,
        incidents: 0,
        requests: 0,
        changes: 0,
      };
    }

    tickets.forEach((ticket) => {
      if (!ticket.created_at) return;

      const created = new Date(ticket.created_at);
      if (created < cutoff) return;

      const key = created.toLocaleDateString("en-US", { weekday: "short" });
      const type = getTicketType(ticket);

      if (!map[key]) {
        map[key] = {
          day: key,
          incidents: 0,
          requests: 0,
          changes: 0,
        };
      }

      map[key][type] += 1;
    });

    return Object.values(map);
  }, [tickets, rangeDays]);

  const categoryData = useMemo(() => {
    const colors = ["#2563eb", "#7c3aed", "#16a34a", "#f97316", "#0891b2"];

    const grouped = tickets.reduce((acc, ticket) => {
      const key =
        ticket.assigned_group_name || ticket.workspace || "Unassigned / Other";

      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }));
  }, [tickets]);

  const workspaces = useMemo(() => {
    const unique = new Set(tickets.map((ticket) => ticket.workspace).filter(Boolean));
    return ["All", ...Array.from(unique)];
  }, [tickets]);

  const quickActions = [
    {
      icon: LifeBuoy,
      label: "Log Incident",
      action: () => navigate("/tickets"),
    },
    {
      icon: Settings,
      label: "Remote Assist",
      action: () => navigate("/tickets"),
    },
    {
      icon: Wrench,
      label: "Raise Change",
      action: () => navigate("/tickets"),
    },
    {
      icon: Smartphone,
      label: "User Access",
      action: () => navigate("/tickets"),
    },
    {
      icon: Activity,
      label: "Major Incident",
      action: () => navigate("/tickets"),
    },
    {
      icon: CheckCircle2,
      label: "Close Ticket",
      action: () => navigate("/tickets"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        navigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

      <main className={classNames(sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
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
              <div className="relative min-w-72 flex-1 xl:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticket, requester, group..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="relative">
                <button
                  onClick={handleOpenNotifications}
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

                {showNotifications && (
                  <div className="absolute right-0 z-50 mt-2 w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold text-slate-950">
                        Notifications
                      </h3>

                      <button
                        onClick={handleClearNotifications}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No notifications
                        </p>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={classNames(
                              "rounded-xl border p-3 text-sm",
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
                                {new Date(
                                  notification.created_at
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={fetchDashboardData}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                <RefreshIcon spinning={loading} />
                Refresh
              </button>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                Logout
              </button>

              <Link
                to="/admin/users"
                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-700"
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

              <button
                onClick={() => navigate("/tickets")}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Ticket
              </button>

              <div className="text-sm text-slate-600">
                {user?.name || user?.email}
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-6 px-5 py-6 xl:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Open Tickets"
              value={stats.open}
              delta={`${stats.total} total`}
              subtext="tickets in system"
              icon={Ticket}
              accent="bg-blue-100 text-blue-700"
            />

            <StatCard
              title="SLA Compliance"
              value={stats.slaCompliance}
              delta="live"
              subtext="based on due dates"
              icon={Gauge}
              accent="bg-emerald-100 text-emerald-700"
            />

            <StatCard
              title="Critical / At Risk"
              value={stats.critical}
              delta="review"
              subtext="tickets needing attention"
              icon={AlertTriangle}
              accent="bg-red-100 text-red-700"
            />

            <StatCard
              title="Avg Resolution"
              value={stats.avgResolution}
              delta="closed"
              subtext="average closed duration"
              icon={Clock}
              accent="bg-purple-100 text-purple-700"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Ticket Volume
                  </h2>
                  <p className="text-sm text-slate-500">
                    Incidents, service requests and changes by created date.
                  </p>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowRangeMenu((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    <Filter className="h-4 w-4" />
                    Last {rangeDays} days
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {showRangeMenu && (
                    <div className="absolute right-0 z-40 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      {[7, 14, 30].map((days) => (
                        <button
                          key={days}
                          onClick={() => {
                            setRangeDays(days);
                            setShowRangeMenu(false);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          Last {days} days
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="incidents" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="requests" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="changes" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Service Mix</h2>
              <p className="text-sm text-slate-500">
                Workload by support group or workspace.
              </p>

              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {categoryData.length === 0 ? (
                  <p className="text-sm text-slate-500">No ticket data yet</p>
                ) : (
                  categoryData.map((item) => (
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
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      Priority Ticket Queue
                    </h2>
                    <p className="text-sm text-slate-500">
                      Live queue from the ticket database.
                    </p>
                  </div>

                  <select
                    value={workspaceFilter}
                    onChange={(event) => setWorkspaceFilter(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    {workspaces.map((workspace) => (
                      <option key={workspace}>{workspace}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredTickets.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No tickets found.
                  </div>
                ) : (
                  filteredTickets.slice(0, 8).map((ticket) => {
                    const sla = getSlaPercent(ticket);

                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={classNames(
                          "grid w-full gap-4 p-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_150px_130px_90px] lg:items-center",
                          selectedTicket?.id === ticket.id && "bg-blue-50/70"
                        )}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-blue-700">
                              {ticket.ticket_ref || `TICKET-${ticket.id}`}
                            </span>

                            <span
                              className={classNames(
                                "rounded-full border px-2.5 py-1 text-xs font-bold",
                                priorityClass(ticket.priority)
                              )}
                            >
                              {ticket.priority || "Medium"}
                            </span>

                            <span
                              className={classNames(
                                "rounded-full px-2.5 py-1 text-xs font-bold",
                                statusClass(ticket.status)
                              )}
                            >
                              {ticket.status || "Open"}
                            </span>
                          </div>

                          <p className="mt-2 font-semibold text-slate-950">
                            {ticket.title}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {ticket.requester_name || "Unknown requester"} •{" "}
                            {ticket.assigned_group_name || ticket.workspace || "No group"}
                          </p>
                        </div>

                        <div className="text-sm">
                          <select
                            className="border rounded p-1 text-sm"
                            value={ticket.assigned_to || ""}
                            onChange={(e) => assignTicket(ticket.id, e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                          
                          <p className="text-slate-500 mt-1">Agent</p>
                       </div>


                        <div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div
                              className={classNames(
                                "h-2 rounded-full",
                                sla < 30
                                  ? "bg-red-500"
                                  : sla < 60
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              )}
                              style={{ width: `${sla}%` }}
                            />
                          </div>

                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            SLA {sla}%
                          </p>
                        </div>

                        <div className="text-sm font-semibold text-slate-600">
                          {getTicketAge(ticket)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-6">
              {selectedTicket ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-950">
                      Ticket Detail
                    </h2>

                    <span
                      className={classNames(
                        "rounded-full border px-2.5 py-1 text-xs font-bold",
                        priorityClass(selectedTicket.priority)
                      )}
                    >
                      {selectedTicket.priority || "Medium"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-bold text-blue-700">
                    {selectedTicket.ticket_ref || `TICKET-${selectedTicket.id}`}
                  </p>

                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {selectedTicket.title}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {selectedTicket.description || "No description provided."}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <InfoBox label="Workspace" value={selectedTicket.workspace} />
                    <InfoBox label="Status" value={selectedTicket.status} />
                    <InfoBox
                      label="Group"
                      value={selectedTicket.assigned_group_name || "No group"}
                    />
                    <InfoBox
                      label="Agent"
                      value={selectedTicket.assigned_to_name || "Unassigned"}
                    />
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => navigate("/tickets")}
                      className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Open Case
                    </button>

                    <button
                      onClick={() => navigate("/tickets")}
                      className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold"
                    >
                      Escalate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Select a ticket to view details.
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Quick Actions
                </h2>

                <p className="text-sm text-slate-500">
                  Fast workflows for your internal support team.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {quickActions.map(({ icon: Icon, label, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <Icon className="h-5 w-5 text-blue-700" />
                      <p className="mt-3 text-sm font-bold text-slate-950">
                        {label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Asset Inventory
              </h2>

              <p className="text-sm text-slate-500">
                Live from the Asset Management System.
              </p>

              <div className="mt-4 space-y-3">
                {!assetStats ? (
                  <p className="text-sm text-slate-500">
                    Asset data unavailable.
                  </p>
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
                      const pct = assetStats.total
                        ? Math.round((count / assetStats.total) * 100)
                        : 0;

                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-slate-100 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-950">
                              {label}
                            </p>
                            <span className="font-bold text-slate-950">
                              {count}
                            </span>
                          </div>

                          <div className="mt-3 h-2 rounded-full bg-slate-100">
                            <div
                              className={classNames("h-2 rounded-full", barClass)}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => navigate("/assets")}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      View all assets →
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <h2 className="text-lg font-bold text-slate-950">
                Knowledge Suggestions
              </h2>

              <p className="text-sm text-slate-500">
                Articles from the knowledge API.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {knowledge.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No knowledge suggestions found.
                  </p>
                ) : (
                  knowledge.map((item, index) => (
                    <button
                      key={item.id || item.title}
                      onClick={() => navigate("/tickets")}
                      className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 p-4 text-left hover:bg-slate-50"
                    >
                      <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                        {index + 1}
                      </div>

                      <div>
                        <p className="font-semibold text-slate-950">
                          {item.title}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Use as runbook, resolution note or reply template.
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <Activity className={classNames("h-4 w-4", spinning && "animate-spin")} />
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