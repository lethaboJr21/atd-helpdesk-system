import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ClipboardCheck,
  FolderKanban,
  HardDrive,
  Headphones,
  Laptop,
  PackagePlus,
  RefreshCw,
  Ticket,
  UserPlus,
  Wrench,
} from "lucide-react";

import OperationsShell from "../components/OperationsShell";
import { useAuth } from "../hooks/useAuth";
import {
  assetsApi,
  knowledgeApi,
  notificationApi,
  ticketsApi,
} from "../services/api";

const CLOSED_STATUSES = new Set(["closed", "resolved"]);
const ACTION_STATUSES = new Set(["waiting approval", "pending"]);

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function extractArray(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

function extractAssets(response) {
  return Array.isArray(response?.data?.assets) ? response.data.assets : [];
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const {
    user,
    logout,
    employeeView,
    exitEmployeeView,
  } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  const operationsPreview = user?.role !== "user" && employeeView;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setSectionErrors([]);

    const requests = [
      {
        key: "tickets",
        label: "Tickets",
        execute: () => ticketsApi.getEmployeeView(),
        apply: (response) => setTickets(extractArray(response)),
      },
      {
        key: "assets",
        label: "Assets",
        execute: () => assetsApi.getMine(),
        apply: (response) => setAssets(extractAssets(response)),
      },
      {
        key: "knowledge",
        label: "Knowledge",
        execute: () => knowledgeApi.getAll(),
        apply: (response) => setKnowledge(extractArray(response)),
      },
      {
        key: "notifications",
        label: "Notifications",
        execute: () => notificationApi.getAll({ module: "helpdesk" }),
        apply: (response) => setNotifications(extractArray(response)),
      },
    ];

    const results = await Promise.allSettled(
      requests.map((request) => request.execute())
    );

    const errors = [];

    results.forEach((result, index) => {
      const request = requests[index];

      if (result.status === "fulfilled") {
        request.apply(result.value);
        return;
      }

      errors.push({
        key: request.key,
        label: request.label,
        message: getErrorMessage(
          result.reason,
          `${request.label} could not be loaded.`
        ),
      });
    });

    setSectionErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const openTickets = useMemo(
    () => tickets.filter((item) => !CLOSED_STATUSES.has(normalizeStatus(item.status))),
    [tickets]
  );

  const waitingForMe = useMemo(
    () => tickets.filter((item) => ACTION_STATUSES.has(normalizeStatus(item.status))),
    [tickets]
  );

  const createRequest = (type, catalogueItem, asset = null) => {
    const parameters = new URLSearchParams({ type });

    if (catalogueItem) {
      parameters.set("catalogue", catalogueItem);
    }

    navigate(`/tickets/new?${parameters.toString()}`, {
      state: {
        createMode: type,
        catalogueItem,
        asset,
      },
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const returnToOperations = () => {
    exitEmployeeView();
    navigate("/", { replace: true });
  };

  return (
    <OperationsShell
      breadcrumb="Employee Self-Service"
      title={`Welcome, ${user?.name || user?.email || "there"}`}
      subtitle="Report issues, request services and track support from one place."
      actions={
        <>
          {operationsPreview && (
            <button
              type="button"
              onClick={returnToOperations}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 xl:px-4 xl:py-2.5"
            >
              Return to Operations View
            </button>
          )}
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold shadow-sm disabled:opacity-60 xl:px-4 xl:py-2.5"
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
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold shadow-sm xl:px-4 xl:py-2.5"
          >
            Logout
          </button>
        </>
      }
    >
        <section className="space-y-4 lg:space-y-6">
          {sectionErrors.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">
                Some dashboard information could not be loaded.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {sectionErrors.map((item) => (
                  <li key={item.key}>
                    <strong>{item.label}:</strong> {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">
            <ActionCard
              icon={AlertCircle}
              title="Report an Incident"
              description="Something is broken, unavailable or behaving unexpectedly."
              onClick={() => createRequest("incident")}
              primary
            />
            <ActionCard
              icon={Wrench}
              title="Request a Service"
              description="Request access, software or another standard IT service."
              onClick={() => createRequest("service_request")}
            />
            <ActionCard
              icon={PackagePlus}
              title="Request an Asset"
              description="Request equipment, accessories, replacement or a temporary loan."
              onClick={() => createRequest("service_request", "asset_request")}
            />
            <ActionCard
              icon={Laptop}
              title="Laptop Checkup"
              description="Ask IT to investigate performance, battery, heat or stability issues."
              onClick={() => createRequest("service_request", "laptop_checkup")}
            />
            <ActionCard
              icon={ClipboardCheck}
              title="Register Current Device"
              description="Submit a device for IT review and possible AMS registration."
              onClick={() => createRequest("service_request", "device_registration")}
            />
            <ActionCard
              icon={BriefcaseBusiness}
              title="Request a Change"
              description="Request a planned change requiring assessment and scheduling."
              onClick={() => createRequest("change")}
            />
            <ActionCard
              icon={UserPlus}
              title="Create for Someone Else"
              description="Available only where your operational permissions allow it."
              onClick={() => createRequest("service_request", "create_for_other")}
              disabled={user?.role === "user"}
            />
            <ActionCard
              icon={FolderKanban}
              title="Create Project"
              description="Project creation and lifecycle tracking is coming soon."
              disabled
              badge="Coming Soon"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Ticket} label="My Open Tickets" value={openTickets.length} onClick={() => navigate("/tickets?view=mine")} />
            <SummaryCard icon={Headphones} label="All My Tickets" value={tickets.length} onClick={() => navigate("/tickets?view=mine")} />
            <SummaryCard icon={Bell} label="Waiting for Me" value={waitingForMe.length} onClick={() => navigate("/tickets?view=mine&status=Waiting%20Approval")} />
            <SummaryCard icon={HardDrive} label="My Assets" value={assets.length} onClick={() => navigate("/assets")} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <DashboardPanel title="Recent Tickets" className="xl:col-span-2">
              {tickets.length > 0 ? (
                tickets.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/tickets/${item.id}`)}
                    className="flex w-full items-center justify-between gap-4 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-blue-700">
                        {item.ticket_ref || `TICKET-${item.id}`}
                      </p>
                      <p className="truncate font-semibold text-slate-950">
                        {item.title}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {item.status || "Open"}
                    </span>
                  </button>
                ))
              ) : (
                <EmptyState message="No tickets have been created for this account." />
              )}
            </DashboardPanel>

            <DashboardPanel title="Your Assets" icon={HardDrive}>
              {assets.length > 0 ? (
                assets.slice(0, 5).map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => navigate("/assets")}
                    className="block w-full border-b border-slate-100 p-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <p className="font-bold text-blue-700">
                      {asset.asset_tag || `ASSET-${asset.id}`}
                    </p>
                    <p className="font-semibold text-slate-950">
                      {asset.name || "Assigned asset"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {asset.serial_number || "No serial number"}
                    </p>
                  </button>
                ))
              ) : (
                <EmptyState message="No assigned assets were found." />
              )}
            </DashboardPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardPanel title="Knowledge Suggestions" icon={BookOpen}>
              {knowledge.length > 0 ? knowledge.slice(0, 6).map((article) => (
                <div key={article.id || article.title} className="border-b border-slate-100 p-3 last:border-0">
                  <p className="font-semibold text-slate-950">{article.title}</p>
                </div>
              )) : <EmptyState message="No knowledge suggestions are available." />}
            </DashboardPanel>

            <DashboardPanel title="My Notifications" icon={Bell}>
              {notifications.length > 0 ? notifications.slice(0, 6).map((notification) => (
                <div key={notification.id} className="border-b border-slate-100 p-3 last:border-0">
                  <p className="font-semibold text-slate-950">{notification.message}</p>
                </div>
              )) : <EmptyState message="No notifications." />}
            </DashboardPanel>
          </div>
        </section>
    </OperationsShell>
  );
}

function ActionCard({ icon: Icon, title, description, onClick, primary, disabled, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "relative rounded-2xl border p-5 text-left shadow-sm transition",
        primary
          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          : "border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {badge && <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{badge}</span>}
      <Icon className="h-7 w-7" />
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className={classNames("mt-2 text-sm", primary ? "text-blue-100" : "text-slate-500")}>{description}</p>
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-blue-300">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>
        <div className="rounded-2xl bg-blue-100 p-3 text-blue-700"><Icon className="h-6 w-6" /></div>
      </div>
    </button>
  );
}

function DashboardPanel({ title, children, icon: Icon, className }) {
  return <div className={classNames("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}><h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950">{Icon && <Icon className="h-5 w-5 text-blue-700" />}{title}</h2>{children}</div>;
}

function EmptyState({ message }) {
  return <p className="p-4 text-sm text-slate-500">{message}</p>;
}
