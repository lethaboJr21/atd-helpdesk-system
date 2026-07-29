import React from "react";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Factory,
  HardDrive,
  Headphones,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Ticket,
  User,
  Users,
  Zap,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";

const EMPLOYEE_ROLE = "user";

const ADMIN_ROLES = [
  "manager",
  "admin",
  "superadmin",
];

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function createEmployeeMenuItems(navigate) {
  return [
    {
      icon: Home,
      label: "Home",
      path: "/",
      onClick: () => navigate("/"),
    },
    {
      icon: Ticket,
      label: "My Tickets",
      path: "/tickets",
      onClick: () => navigate("/tickets"),
    },
    {
      icon: HardDrive,
      label: "My Assets",
      path: "/assets",
      onClick: () => navigate("/assets"),
    },
    {
      icon: User,
      label: "My Profile",
      path: "/profile",
      disabled: true,
    },
  ];
}

function createOperationsMenuItems(navigate, canAccessAdmin) {
  const menuItems = [
    {
      icon: LayoutDashboard,
      label: "Operations Dashboard",
      path: "/",
      onClick: () => navigate("/"),
    },
    {
      icon: Ticket,
      label: "Ticket Workspace",
      path: "/tickets",
      onClick: () => navigate("/tickets"),
    },
    {
      icon: HardDrive,
      label: "Assets / CMDB",
      path: "/assets",
      onClick: () => navigate("/assets"),
    },
    {
      icon: Factory,
      label: "Plant Operations",
      external: true,
      onClick: () => window.location.assign("/production"),
    },
    {
      icon: AlertTriangle,
      label: "AMS Alerts",
      external: true,
      onClick: () => window.location.assign("/ams/alerts.php"),
    },
  ];

  if (canAccessAdmin) {
    menuItems.push(
      {
        icon: Users,
        label: "User Management",
        path: "/admin/users",
        onClick: () => navigate("/admin/users"),
      },
      {
        icon: ShieldCheck,
        label: "Employee Access",
        path: "/admin/employee-access",
        onClick: () => navigate("/admin/employee-access"),
      },
      {
        icon: Settings,
        label: "Admin Settings",
        path: "/admin",
        onClick: () => navigate("/admin"),
      }
    );
  }

  return menuItems;
}

export default function Sidebar({
  navigate,
  collapsed,
  onToggle,
}) {
  const location = useLocation();
  const { user } = useAuth();

  const isEmployee = user?.role === EMPLOYEE_ROLE;
  const canAccessAdmin = ADMIN_ROLES.includes(user?.role);

  const menuItems = isEmployee
    ? createEmployeeMenuItems(navigate)
    : createOperationsMenuItems(navigate, canAccessAdmin);

  const isActivePath = (path) => {
    if (!path) {
      return false;
    }

    if (path === "/") {
      return [
        "/",
        "/dashboard",
        "/employee",
      ].includes(location.pathname);
    }

    return location.pathname.startsWith(path);
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
          <div className="rounded-2xl bg-blue-500 p-3 shadow-lg shadow-blue-500/30">
            <Headphones className="h-7 w-7" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold leading-tight">
                ATD Alliance Helpdesk
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {isEmployee
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
              "flex w-full items-center rounded-xl border border-white/10 bg-white/5 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white",
              collapsed ? "justify-center" : "justify-between px-3"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {!collapsed && (
              <span className="text-sm font-semibold">
                Collapse menu
              </span>
            )}

            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav
          className="flex-1 space-y-2 overflow-y-auto px-3 py-6"
          aria-label="Primary navigation"
        >
          {menuItems.map((menuItem) => {
            const Icon = menuItem.icon;
            const active =
              !menuItem.external && isActivePath(menuItem.path);

            return (
              <button
                key={menuItem.label}
                type="button"
                onClick={menuItem.onClick}
                disabled={menuItem.disabled}
                title={collapsed ? menuItem.label : undefined}
                className={classNames(
                  "group flex w-full items-center rounded-2xl py-3 text-sm font-medium transition",
                  collapsed ? "justify-center px-3" : "gap-3 px-4",
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                  menuItem.disabled &&
                    "cursor-not-allowed opacity-50 hover:bg-transparent"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />

                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 text-left">
                      {menuItem.label}
                    </span>

                    {menuItem.external && (
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    )}

                    {menuItem.disabled && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Soon
                      </span>
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
                {isEmployee ? "Need IT help?" : "Smart Triage"}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-300">
                {isEmployee
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

