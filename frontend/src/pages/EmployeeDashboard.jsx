import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  BookOpen,
  HardDrive,
  Headphones,
  RefreshCw,
  Ticket,
  Wrench,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import {
  assetsApi,
  knowledgeApi,
  notificationApi,
  ticketsApi,
} from "../services/api";

const CLOSED_TICKET_STATUSES = [
  "closed",
  "resolved",
];

const EMPLOYEE_ACTION_STATUSES = [
  "waiting approval",
  "pending",
];

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function extractArray(response) {
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function extractAssets(response) {
  if (Array.isArray(response?.data?.assets)) {
    return response.data.assets;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function getRejectedRequestCount(results) {
  return results.filter((result) => result.status === "rejected").length;
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [knowledgeArticles, setKnowledgeArticles] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      ticketsApi.getMine(),
      assetsApi.getMine(),
      knowledgeApi.getAll(),
      notificationApi.getAll({ module: "helpdesk" }),
    ]);

    const [
      ticketResult,
      assetResult,
      knowledgeResult,
      notificationResult,
    ] = results;

    if (ticketResult.status === "fulfilled") {
      setTickets(extractArray(ticketResult.value));
    }

    if (assetResult.status === "fulfilled") {
      setAssets(extractAssets(assetResult.value));
    }

    if (knowledgeResult.status === "fulfilled") {
      setKnowledgeArticles(extractArray(knowledgeResult.value));
    }

    if (notificationResult.status === "fulfilled") {
      setNotifications(extractArray(notificationResult.value));
    }

    const rejectedRequestCount = getRejectedRequestCount(results);

    if (rejectedRequestCount > 0) {
      setError(
        `${rejectedRequestCount} dashboard section${
          rejectedRequestCount === 1 ? "" : "s"
        } could not be loaded. You can refresh to try again.`
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const openTickets = useMemo(() => {
    return tickets.filter((ticketItem) => {
      return !CLOSED_TICKET_STATUSES.includes(
        normalizeStatus(ticketItem.status)
      );
    });
  }, [tickets]);

  const ticketsWaitingForEmployee = useMemo(() => {
    return tickets.filter((ticketItem) => {
      return EMPLOYEE_ACTION_STATUSES.includes(
        normalizeStatus(ticketItem.status)
      );
    });
  }, [tickets]);

  const handleCreateTicket = (ticketType, asset = null) => {
    navigate("/tickets", {
      state: {
        createMode: ticketType,
        asset,
      },
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed((currentValue) => !currentValue);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        navigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
      />

      <main
        className={classNames(
          "transition-[padding] duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        <header className="border-b border-slate-200 bg-white px-5 py-5 xl:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700">
                Employee Self-Service
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                Welcome, {user?.name || user?.email}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                How can IT help today?
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadDashboardData}
                disabled={loading}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={classNames(
                    "mr-2 h-4 w-4",
                    loading && "animate-spin"
                  )}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="space-y-6 p-5 xl:p-8">
          {error && (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <ActionCard
              icon={AlertCircle}
              title="Report an Incident"
              description="Something is broken, unavailable or not working correctly."
              onClick={() => handleCreateTicket("incident")}
              primary
            />

            <ActionCard
              icon={Wrench}
              title="Request a Service"
              description="Request access, equipment, software or another standard IT service."
              onClick={() => handleCreateTicket("service_request")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={Ticket}
              label="My Open Tickets"
              value={openTickets.length}
            />

            <SummaryCard
              icon={Headphones}
              label="All My Tickets"
              value={tickets.length}
            />

            <SummaryCard
              icon={Bell}
              label="Waiting for Me"
              value={ticketsWaitingForEmployee.length}
            />

            <SummaryCard
              icon={HardDrive}
              label="My Assets"
              value={assets.length}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <DashboardPanel
              title="Recent Tickets"
              className="xl:col-span-2"
            >
              {tickets.length > 0 ? (
                tickets.slice(0, 8).map((ticketItem) => (
                  <button
                    key={ticketItem.id}
                    type="button"
                    onClick={() => navigate(`/tickets/${ticketItem.id}`)}
                    className="flex w-full items-center justify-between gap-4 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-blue-700">
                        {ticketItem.ticket_ref || `TICKET-${ticketItem.id}`}
                      </p>

                      <p className="truncate font-semibold text-slate-950">
                        {ticketItem.title}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {ticketItem.status || "Open"}
                    </span>
                  </button>
                ))
              ) : (
                <EmptyState message="No tickets yet." />
              )}
            </DashboardPanel>

            <DashboardPanel title="My Assets">
              {assets.length > 0 ? (
                assets.slice(0, 5).map((assetItem) => (
                  <button
                    key={assetItem.id}
                    type="button"
                    onClick={() => navigate("/assets")}
                    className="block w-full border-b border-slate-100 p-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <p className="font-bold text-blue-700">
                      {assetItem.asset_tag || `ASSET-${assetItem.id}`}
                    </p>

                    <p className="font-semibold text-slate-950">
                      {assetItem.name || "Unnamed asset"}
                    </p>

                    <p className="text-xs text-slate-500">
                      {assetItem.serial_number || "No serial number"}
                    </p>
                  </button>
                ))
              ) : (
                <EmptyState message="No assigned assets found." />
              )}
            </DashboardPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardPanel
              title="Knowledge Suggestions"
              icon={BookOpen}
            >
              {knowledgeArticles.length > 0 ? (
                knowledgeArticles.slice(0, 6).map((article) => (
                  <div
                    key={article.id || article.title}
                    className="border-b border-slate-100 p-3 last:border-0"
                  >
                    <p className="font-semibold text-slate-950">
                      {article.title}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState message="No knowledge suggestions available." />
              )}
            </DashboardPanel>

            <DashboardPanel
              title="My Notifications"
              icon={Bell}
            >
              {notifications.length > 0 ? (
                notifications.slice(0, 6).map((notification) => (
                  <div
                    key={notification.id}
                    className="border-b border-slate-100 p-3 last:border-0"
                  >
                    <p className="font-semibold text-slate-950">
                      {notification.message}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState message="No notifications." />
              )}
            </DashboardPanel>
          </div>
        </section>
      </main>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  primary = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-2xl border p-6 text-left shadow-sm transition",
        primary
          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          : "border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50"
      )}
    >
      <Icon className="h-7 w-7" />

      <h2 className="mt-4 text-xl font-bold">
        {title}
      </h2>

      <p
        className={classNames(
          "mt-2 text-sm",
          primary ? "text-blue-100" : "text-slate-500"
        )}
      >
        {description}
      </p>
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-950">
            {value}
          </p>
        </div>

        <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  children,
  icon: Icon,
  className,
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950">
        {Icon && (
          <Icon className="h-5 w-5 text-blue-700" />
        )}
        {title}
      </h2>

      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <p className="p-4 text-sm text-slate-500">
      {message}
    </p>
  );
}

