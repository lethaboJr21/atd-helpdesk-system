import React, { useMemo, useState,useEffect } from "react";
import { motion } from "framer-motion";
import { replace, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notificationApi } from "../services/api";
import { io } from "socket.io-client";
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
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tickets = [
  {
    id: "INC-24081",
    title: "MES terminal cannot sync production orders",
    requester: "Body Shop - Line 2",
    category: "Application Development",
    service: "MES / Production Apps",
    priority: "Critical",
    status: "In Progress",
    owner: "AppDev Team",
    site: "Plant A",
    sla: 18,
    age: "42m",
  },
  {
    id: "INC-24077",
    title: "Wi-Fi dropouts affecting handheld scanners",
    requester: "Warehouse Operations",
    category: "Infrastructure",
    service: "Network",
    priority: "High",
    status: "Assigned",
    owner: "Infrastructure Team",
    site: "Parts Warehouse",
    sla: 39,
    age: "1h 15m",
  },
  {
    id: "REQ-11892",
    title: "Create new VPN profile for engineering supplier",
    requester: "Engineering Systems",
    category: "Infrastructure",
    service: "Access / Security",
    priority: "Medium",
    status: "Waiting Approval",
    owner: "Security Admin",
    site: "HQ",
    sla: 71,
    age: "3h 20m",
  },
  {
    id: "INC-24069",
    title: "Warranty claims API returning timeout errors",
    requester: "Dealer Support",
    category: "Application Development",
    service: "Integration/API",
    priority: "High",
    status: "Investigating",
    owner: "Integration Squad",
    site: "Cloud",
    sla: 26,
    age: "2h 05m",
  },
  {
    id: "REQ-11888",
    title: "Install CAD workstation software bundle",
    requester: "Product Design",
    category: "Infrastructure",
    service: "End-user Computing",
    priority: "Low",
    status: "Scheduled",
    owner: "Desktop Support",
    site: "R&D Centre",
    sla: 92,
    age: "1d 4h",
  },
  {
    id: "CHG-09031",
    title: "Deploy supplier portal patch to staging",
    requester: "Application Owner",
    category: "Application Development",
    service: "Change Management",
    priority: "Medium",
    status: "Change Window",
    owner: "DevOps",
    site: "Azure",
    sla: 64,
    age: "5h 45m",
  },
];

const volumeData = [
  { day: "Mon", incidents: 42, requests: 28, changes: 7 },
  { day: "Tue", incidents: 51, requests: 32, changes: 9 },
  { day: "Wed", incidents: 47, requests: 35, changes: 6 },
  { day: "Thu", incidents: 62, requests: 29, changes: 11 },
  { day: "Fri", incidents: 55, requests: 38, changes: 8 },
  { day: "Sat", incidents: 24, requests: 12, changes: 4 },
  { day: "Sun", incidents: 19, requests: 8, changes: 2 },
];

const slaTrend = [
  { hour: "06:00", score: 88 },
  { hour: "08:00", score: 84 },
  { hour: "10:00", score: 81 },
  { hour: "12:00", score: 79 },
  { hour: "14:00", score: 86 },
  { hour: "16:00", score: 91 },
];

const categoryData = [
  { name: "Infrastructure", value: 48, color: "#2563eb" },
  { name: "Applications", value: 34, color: "#7c3aed" },
  { name: "Access", value: 12, color: "#16a34a" },
  { name: "Change", value: 6, color: "#f97316" },
];

const assets = [
  { name: "Core Network", status: "Healthy", score: 98, icon: Network },
  { name: "Production Servers", status: "Warning", score: 82, icon: Server },
  { name: "MES Applications", status: "Degraded", score: 76, icon: Factory },
  { name: "SQL Cluster", status: "Healthy", score: 94, icon: Database },
];

const knowledge = [
  "MES scanner login troubleshooting checklist",
  "Standard VPN onboarding workflow",
  "Dealer portal API incident runbook",
  "Factory-floor Wi-Fi escalation matrix",
];

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function priorityClass(priority) {
  return {
    Critical: "bg-red-100 text-red-700 border-red-200",
    High: "bg-orange-100 text-orange-700 border-orange-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  }[priority];
}

function statusClass(status) {
  if (["In Progress", "Investigating"].includes(status)) {
    return "bg-blue-100 text-blue-700";
  }
  if (["Assigned", "Scheduled"].includes(status)) {
    return "bg-slate-100 text-slate-700";
  }
  if (["Waiting Approval", "Change Window"].includes(status)) {
    return "bg-purple-100 text-purple-700";
  }
  return "bg-slate-100 text-slate-700";
}

function StatCard({ title, value, delta, icon: Icon, accent, subtext }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
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
    </motion.div>
  );
}

export default function Dashboard() {
  // For navigation
const navigate  = useNavigate();
// For authentication context
const { logout, user } = useAuth();
// For search filter
const [query, setQuery] = useState("");
// For category filter
const [category, setCategory] = useState("All");
// For ticket detail view
const [selectedTicket, setSelectedTicket] = useState(tickets[0]);
// ✅ Track last update time
const [lastUpdated, setLastUpdated] = useState(null);
//1. For notifications panel 2. ✅ Fetch notifications from API
const [showNotifications, setShowNotifications] = useState(false);
const [notifications, setNotifications] = useState([]);

// ✅ Calculate unread notifications count
const unreadCount = notifications.filter((n) => !n.isRead).length;
// ✅ Fetch notifications from API
useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await notificationApi.getAll();
      setNotifications(
res.data.map((n) => ({
    ...n,
    isRead: true,
  }))
      );
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  fetchNotifications();
}, []);

// ✅ Real-time updates with Socket.IO
useEffect(() => {
  const socket = io("http://localhost:3001");

  socket.on("new-log", ({ notification }) => {
    setNotifications((prev) => [
      {
        id: Date.now(),
        ...notification,
        isRead: false,
      },
      ...prev.slice(0, 19),
    ]);
  });

  return () => socket.disconnect(); 
}, []);

  const handleLogout = async () => {
  await logout();
  navigate("/login", { replace: true });
};

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesQuery = [
        ticket.id,
        ticket.title,
        ticket.requester,
        ticket.service,
        ticket.owner,
        ticket.site,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());

      const matchesCategory =
        category === "All" || ticket.category === category;

      return matchesQuery && matchesCategory;
    });
  }, [query, category]);

  const criticalCount = tickets.filter(
    (ticket) => ticket.priority === "Critical" || ticket.sla < 30
  ).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-slate-950 text-white lg:block">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
            <div className="rounded-2xl bg-blue-500 p-3 shadow-lg shadow-blue-500/30">
              <Headphones className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-bold">ATD Alliance Helpdesk</p>
              <p className="text-xs text-slate-400">
                Helpdesk Command Centre
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6">
            {[
              [LayoutDashboard, "Dashboard", true],
              [Ticket, "Ticket Workspace"],
              [Factory, "Plant Operations"],
              [Server, "Infrastructure"],
              [Code2, "Applications"],
              [ShieldCheck, "Access & Security"],
              [HardDrive, "Assets / CMDB"],
              [Users, "Teams & Workload"],
              [Settings, "Admin Settings"],
            ].map(([Icon, label, active]) => (
              <button
                key={label}
                className={classNames(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="m-4 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
            <div className="flex items-center gap-2 text-blue-200">
              <Zap className="h-5 w-5" />
              <p className="font-semibold">AI Triage Engine</p>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Auto-prioritise incidents using SLA, plant impact, service type,
              and repeated failures.
            </p>
          </div>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between xl:px-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Factory className="h-4 w-4" />
                ATD IT Department / Infrastructure + App Development
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
                  placeholder="Search ticket, requester, owner, site..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
              
              <div className="relative">
  <button
    onClick={handleOpenNotifications}
    className="relative inline-flex items-center p-3 bg-white border rounded-2xl shadow-sm"
  >
    <Bell className="h-5 w-5" />

    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 rounded-full">
        {unreadCount}
      </span>
    )}
  </button>

  {showNotifications && (
    <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg p-3 z-50">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold">Notifications</h3>

        <button
          onClick={handleClearNotifications}
          className="text-xs font-semibold text-red-500 hover:text-red-700"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-2 rounded text-sm ${
                n.type === "critical"
                  ? "bg-red-100 border border-red-400"
                  : n.type === "warning"
                  ? "bg-yellow-100 border border-yellow-400"
                  : "bg-green-100 border border-green-400"
              } ${!n.is_read ? "ring-2 ring-blue-400" : ""}`}
            >
              <p>{n.message}</p>

              {n.created_at && (
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )}
</div>

              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50">
                <Bell className="h-4 w-4" />
                Alerts
              </button>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50">
                Logout
              </button>
              
               <Link
                to="/admin/users"
                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-700"
              >
                Manage Users
              </Link>

              <div className="text-sm text-slate-600">
                {user?.name || user?.email}
              </div>
              <Link
                to="/production"
                   className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
                      >
                  <Factory className="h-4 w-4" />
                  Production
              </Link>

              <button className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                New Ticket
              </button>
            </div>

          </div>
        </header>

        <section className="space-y-6 px-5 py-6 xl:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Open Tickets"
              value="248"
              delta="12%"
              subtext="higher than yesterday"
              icon={Ticket}
              accent="bg-blue-100 text-blue-700"
            />
            <StatCard
              title="SLA Compliance"
              value="91.4%"
              delta="4.2%"
              subtext="improvement this week"
              icon={Gauge}
              accent="bg-emerald-100 text-emerald-700"
            />
            <StatCard
              title="Critical / At Risk"
              value={criticalCount}
              delta="3"
              subtext="need immediate action"
              icon={AlertTriangle}
              accent="bg-red-100 text-red-700"
            />
            <StatCard
              title="Avg Resolution"
              value="5h 18m"
              delta="18m"
              subtext="faster than target"
              icon={Clock}
              accent="bg-purple-100 text-purple-700"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Ticket Volume by Day
                  </h2>
                  <p className="text-sm text-slate-500">
                    Incidents, service requests, and changes across the support
                    desk.
                  </p>
                </div>

                <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                  <Filter className="h-4 w-4" />
                  Last 7 days
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="incidents"
                      name="Incidents"
                      fill="#2563eb"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="requests"
                      name="Requests"
                      fill="#7c3aed"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="changes"
                      name="Changes"
                      fill="#f97316"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Service Mix</h2>
              <p className="text-sm text-slate-500">
                Current workload by support domain.
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
                {categoryData.map((item) => (
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
                      {item.value}%
                    </span>
                  </div>
                ))}
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
                      Smart queue for plant-impacting incidents and
                      business-critical requests.
                    </p>
                  </div>

                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    <option>All</option>
                    <option>Infrastructure</option>
                    <option>Application Development</option>
                  </select>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={classNames(
                      "grid w-full gap-4 p-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_150px_130px_90px] lg:items-center",
                      selectedTicket.id === ticket.id && "bg-blue-50/70"
                    )}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-blue-700">
                          {ticket.id}
                        </span>
                        <span
                          className={classNames(
                            "rounded-full border px-2.5 py-1 text-xs font-bold",
                            priorityClass(ticket.priority)
                          )}
                        >
                          {ticket.priority}
                        </span>
                        <span
                          className={classNames(
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            statusClass(ticket.status)
                          )}
                        >
                          {ticket.status}
                        </span>
                      </div>

                      <p className="mt-2 font-semibold text-slate-950">
                        {ticket.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {ticket.requester} • {ticket.service} • {ticket.site}
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-slate-950">
                        {ticket.owner}
                      </p>
                      <p className="text-slate-500">Owner</p>
                    </div>

                    <div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={classNames(
                            "h-2 rounded-full",
                            ticket.sla < 30
                              ? "bg-red-500"
                              : ticket.sla < 60
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          )}
                          style={{ width: `${ticket.sla}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        SLA {ticket.sla}% remaining
                      </p>
                    </div>

                    <div className="text-sm font-semibold text-slate-600">
                      {ticket.age}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
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
                    {selectedTicket.priority}
                  </span>
                </div>

                <p className="mt-3 text-sm font-bold text-blue-700">
                  {selectedTicket.id}
                </p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {selectedTicket.title}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">Category</p>
                    <p className="font-semibold">
                      {selectedTicket.category}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">Site</p>
                    <p className="font-semibold">{selectedTicket.site}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">Assigned To</p>
                    <p className="font-semibold">{selectedTicket.owner}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">Status</p>
                    <p className="font-semibold">{selectedTicket.status}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                    Open Case
                  </button>
                  <button className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
                    Escalate
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  SLA Health Trend
                </h2>
                <p className="text-sm text-slate-500">
                  Operational compliance across the day.
                </p>

                <div className="mt-4 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slaTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hour" />
                      <YAxis domain={[70, 100]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Infrastructure & App Health
              </h2>
              <p className="text-sm text-slate-500">
                CMDB-style service status snapshot.
              </p>

              <div className="mt-4 space-y-3">
                {assets.map((asset) => {
                  const Icon = asset.icon;
                  return (
                    <div
                      key={asset.name}
                      className="rounded-2xl border border-slate-100 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-slate-100 p-2">
                            <Icon className="h-5 w-5 text-slate-700" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-950">
                              {asset.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {asset.status}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-950">
                          {asset.score}%
                        </span>
                      </div>

                      <div className="mt-3 h-2 rounded-full bg-slate-100">
                        <div
                          className={classNames(
                            "h-2 rounded-full",
                            asset.score >= 90
                              ? "bg-emerald-500"
                              : asset.score >= 80
                              ? "bg-amber-500"
                              : "bg-red-500"
                          )}
                          style={{ width: `${asset.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Quick Actions
              </h2>
              <p className="text-sm text-slate-500">
                Fast workflows for your internal support team.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  [LifeBuoy, "Log Incident"],
                  [Settings, "Remote Assist"],
                  [Wrench, "Raise Change"],
                  [Smartphone, "User Access"],
                  [Activity, "Major Incident"],
                  [CheckCircle2, "Close Ticket"],
                ].map(([Icon, label]) => (
                  <button
                    key={label}
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

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Knowledge Suggestions
              </h2>
              <p className="text-sm text-slate-500">
                Suggested articles based on the selected case.
              </p>

              <div className="mt-4 space-y-3">
                {knowledge.map((item, index) => (
                  <button
                    key={item}
                    className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 p-4 text-left hover:bg-slate-50"
                  >
                    <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">{item}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Use as runbook, resolution note, or auto-reply template.
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}