import {
  AlertTriangle,
  Archive,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Factory,
  HardDrive,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Ticket,
  User,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const ADMIN_ROLES = new Set([
  "manager",
  "admin",
  "superadmin",
]);

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function normalizePath(path) {
  return String(path || "").split("?")[0];
}

export default function Sidebar({
  navigate,
  collapsed,
  onToggle,
}) {
  const location = useLocation();
  const {
    user,
    employeeView,
    enterEmployeeView,
    exitEmployeeView,
  } = useAuth();

  const employeeAccount = user?.role === "user";
  const admin = ADMIN_ROLES.has(user?.role);
  const employeeExperience = employeeAccount || employeeView;

  const employeeItems = [
    {
      icon: Home,
      label: "Employee Home",
      path: employeeAccount ? "/" : "/employee",
    },
    {
      icon: Ticket,
      label: "My Tickets",
      path: "/tickets?view=mine",
    },
    {
      icon: HardDrive,
      label: "My Assets",
      path: "/assets",
    },
    {
      icon: User,
      label: "My Profile",
      disabled: true,
    },
  ];

  const operationsItems = [
    {
      icon: LayoutDashboard,
      label: "Operations Dashboard",
      path: "/",
    },
    {
      icon: Ticket,
      label: "Ticket Workspace",
      path: "/tickets",
    },
    {
      icon: BriefcaseBusiness,
      label: "Workspaces",
      path: "/workspaces",
    },
    {
      icon: HardDrive,
      label: "Assets / CMDB",
      path: "/assets",
    },
    {
      icon: Factory,
      label: "Plant Operations",
      external: "/production",
    },
    {
      icon: AlertTriangle,
      label: "AMS Alerts",
      external: "/ams/alerts.php",
    },
  ];

  if (admin) {
    operationsItems.push(
      {
        icon: Users,
        label: "User Administration",
        path: "/admin/users?view=active",
      },
      {
        icon: UsersRound,
        label: "Groups and Agents",
        path: "/admin/groups",
      },
      {
        icon: ShieldCheck,
        label: "Employee Access Preview",
        path: "/admin/employee-access",
      },
      {
        icon: Archive,
        label: "Freshservice Import",
        path: "/archive",
      },
      {
        icon: Settings,
        label: "Admin Settings",
        path: "/admin",
      }
    );
  }

  if (!employeeAccount) {
    operationsItems.push({
      icon: User,
      label: "Switch to Employee View",
      path: "/employee",
      action: "enter-employee-view",
    });
  }

  const items = employeeExperience
    ? [
        ...(!employeeAccount
          ? [{
              icon: LayoutDashboard,
              label: "Return to Operations View",
              path: "/",
              action: "exit-employee-view",
            }]
          : []),
        ...employeeItems,
      ]
    : operationsItems;

  const isActive = (path) => {
    if (!path) {
      return false;
    }

    const cleanPath = normalizePath(path);

    if (cleanPath === "/") {
      return (
        location.pathname === "/" ||
        location.pathname === "/dashboard"
      );
    }

    return location.pathname.startsWith(cleanPath);
  };

  const handleItemClick = (item) => {
    if (item.disabled) {
      return;
    }

    if (item.external) {
      window.location.assign(item.external);
      return;
    }

    if (item.action === "enter-employee-view") {
      enterEmployeeView();
    }

    if (item.action === "exit-employee-view") {
      exitEmployeeView();
    }

    navigate(item.path);
  };

  return (
    <aside
      className={classNames(
        "fixed inset-y-0 left-0 z-30 hidden border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 lg:block",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className={classNames(
            "flex items-center border-b border-white/10 py-6",
            collapsed ? "justify-center px-3" : "gap-3 px-6"
          )}
        >
          <img
            src="/helpdesk/atd-helpdesk-ticket.svg?v=2"
            alt="ATD Helpdesk"
            className="h-11 w-11 rounded-xl bg-white object-contain"
          />

          {!collapsed && (
            <div>
              <p className="font-bold">ATD Helpdesk</p>
              <p className="mt-1 text-xs text-slate-400">
                {employeeExperience
                  ? "Employee Self-Service"
                  : "Helpdesk Command Centre"}
              </p>
            </div>
          )}
        </div>

        <div className="px-3 pt-4">
          <button
            type="button"
            onClick={onToggle}
            className={classNames(
              "flex w-full items-center rounded-xl border border-white/10 bg-white/5 py-2 text-slate-300",
              collapsed
                ? "justify-center"
                : "justify-between px-3"
            )}
            aria-label={collapsed
              ? "Expand navigation"
              : "Collapse navigation"}
          >
            {!collapsed && (
              <span className="text-sm font-semibold">
                Collapse menu
              </span>
            )}

            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                title={collapsed ? item.label : undefined}
                className={classNames(
                  "group flex w-full items-center rounded-2xl py-3 text-sm font-medium transition",
                  collapsed
                    ? "justify-center px-3"
                    : "gap-3 px-4",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                  item.disabled &&
                    "cursor-not-allowed opacity-50"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />

                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">
                      {item.label}
                    </span>

                    {item.external && (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className="m-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3">
          {collapsed ? (
            <Zap className="mx-auto h-5 w-5 text-blue-200" />
          ) : (
            <>
              <p className="font-semibold text-blue-200">
                {employeeExperience
                  ? "Need IT help?"
                  : "Smart Triage"}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {employeeExperience
                  ? "Report an issue or request an IT service."
                  : "Prioritise work using severity, SLA and assignment data."}
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
