import React from "react";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  Factory,
  HardDrive,
  Headphones,
  LayoutDashboard,
  Server,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  Zap,
} from "lucide-react";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

export default function Sidebar({ navigate, collapsed, onToggle }) {
  const location = useLocation();

  const openExternal = (url) => {
    window.location.href = url;
  };

  const isActivePath = (path) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/" || location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/",
      action: () => navigate("/"),
    },
    {
      icon: Ticket,
      label: "Ticket Workspace",
      path: "/tickets",
      action: () => navigate("/tickets"),
    },
    {
      icon: Factory,
      label: "Plant Operations",
      external: true,
      action: () => openExternal("/production"),
    },
    {
      icon: Server,
      label: "Infrastructure",
      path: "/tickets",
      action: () => navigate("/tickets"),
    },
    {
      icon: Code2,
      label: "Applications",
      path: "/tickets",
      action: () => navigate("/tickets"),
    },
    {
      icon: ShieldCheck,
      label: "Access & Security",
      path: "/tickets",
      action: () => navigate("/tickets"),
    },
    {
      icon: HardDrive,
      label: "Assets / CMDB",
      external: true,
      action: () => openExternal("/ams/assets.php"),
    },
    {
      icon: AlertTriangle,
      label: "AMS Alerts",
      external: true,
      action: () => openExternal("/ams/alerts.php"),
    },
    {
      icon: Users,
      label: "Teams & Workload",
      path: "/admin/users",
      action: () => navigate("/admin/users"),
    },
    {
      icon: Settings,
      label: "Admin Settings",
      path: "/admin/users",
      action: () => navigate("/admin/users"),
    },
  ];

  return (
    <aside
      className={classNames(
        "fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-slate-950 text-white transition-all duration-300 lg:block",
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
              <p className="text-lg font-bold leading-tight">ATD Alliance Helpdesk</p>
              <p className="text-xs text-slate-400">Helpdesk Command Centre</p>
            </div>
          )}
        </div>

        <div className={classNames("px-4 pt-4", collapsed && "px-3")}>
          <button
            type="button"
            onClick={onToggle}
            className={classNames(
              "flex w-full items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white",
              collapsed ? "justify-center" : "justify-between"
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {!collapsed && <span>Collapse menu</span>}
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className={classNames("flex-1 space-y-2 py-6", collapsed ? "px-3" : "px-4")}>
          {menuItems.map(({ icon: Icon, label, path, external, action }) => {
            const active = !external && isActivePath(path);

            return (
              <button
                key={label}
                type="button"
                onClick={action}
                title={collapsed ? label : undefined}
                className={classNames(
                  "group flex w-full items-center rounded-2xl text-sm font-medium transition",
                  collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3",
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />

                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 text-left">{label}</span>
                    {external && <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className={classNames("m-4 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4", collapsed && "mx-3 px-3")}>
          <div className={classNames("flex items-center text-blue-200", collapsed ? "justify-center" : "gap-2")}>
            <Zap className="h-5 w-5" />
            {!collapsed && <p className="font-semibold">Smart Triage</p>}
          </div>

          {!collapsed && (
            <p className="mt-2 text-sm text-slate-300">
              Prioritise tickets using priority, SLA due date, group and status.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
