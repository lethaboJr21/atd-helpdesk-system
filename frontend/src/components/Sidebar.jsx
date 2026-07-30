import React from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Factory, HardDrive, Headphones, Home, LayoutDashboard, Settings, ShieldCheck, Ticket, User, Users, Zap } from "lucide-react";

import { useAuth } from "../hooks/useAuth";

const ADMIN_ROLES = ["manager", "admin", "superadmin"];
function classes(...items) { return items.filter(Boolean).join(" "); }

export default function Sidebar({ navigate, collapsed, onToggle }) {
  const location = useLocation();
  const { user } = useAuth();
  const employee = user?.role === "user";
  const admin = ADMIN_ROLES.includes(user?.role);
  const employeePreviewMode = !employee && location.pathname.startsWith("/employee");

  const employeeItems = [
    { icon: Home, label: "Home", path: employee ? "/" : "/employee" },
    { icon: Ticket, label: "My Tickets", path: "/tickets" },
    { icon: HardDrive, label: "My Assets", path: "/assets" },
    { icon: User, label: "My Profile", disabled: true },
  ];

  const operationsItems = [
    { icon: LayoutDashboard, label: "Operations Dashboard", path: "/" },
    { icon: Ticket, label: "Ticket Workspace", path: "/tickets" },
    { icon: HardDrive, label: "Assets / CMDB", path: "/assets" },
    { icon: Factory, label: "Plant Operations", external: "/production" },
    { icon: AlertTriangle, label: "AMS Alerts", external: "/ams/alerts.php" },
    { icon: User, label: "Switch to Employee View", path: "/employee" },
  ];

  if (admin) {
    operationsItems.push(
      { icon: Users, label: "User Administration", path: "/admin/users?view=active" },
      { icon: ShieldCheck, label: "Employee Access Preview", path: "/admin/employee-access" },
      { icon: Settings, label: "Admin Settings", path: "/admin" }
    );
  }

  const items = employee ? employeeItems : employeePreviewMode
    ? [{ icon: LayoutDashboard, label: "Return to Operations View", path: "/" }, ...employeeItems]
    : operationsItems;

  const active = (path) => {
    if (!path) return false;
    const clean = path.split("?")[0];
    return clean === "/" ? location.pathname === "/" || location.pathname === "/dashboard" : location.pathname.startsWith(clean);
  };

  return (
    <aside className={classes("fixed inset-y-0 left-0 z-30 hidden border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 lg:block", collapsed ? "w-20" : "w-72")}>
      <div className="flex h-full flex-col">
        <div className={classes("flex items-center border-b border-white/10 py-6", collapsed ? "justify-center px-3" : "gap-3 px-6")}>
          <div className="rounded-2xl bg-blue-500 p-3"><Headphones className="h-7 w-7" /></div>
          {!collapsed && <div><p className="font-bold">ATD Alliance Helpdesk</p><p className="mt-1 text-xs text-slate-400">{employee || employeePreviewMode ? "Employee Self-Service" : "Helpdesk Command Centre"}</p></div>}
        </div>
        <div className="px-3 pt-4"><button onClick={onToggle} className={classes("flex w-full items-center rounded-xl border border-white/10 bg-white/5 py-2 text-slate-300", collapsed ? "justify-center" : "justify-between px-3")}>{!collapsed && <span className="text-sm font-semibold">Collapse menu</span>}{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button></div>
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6">
          {items.map((item) => {
            const Icon = item.icon;
            return <button key={item.label} disabled={item.disabled} onClick={() => item.external ? window.location.assign(item.external) : navigate(item.path)} className={classes("group flex w-full items-center rounded-2xl py-3 text-sm font-medium", collapsed ? "justify-center px-3" : "gap-3 px-4", active(item.path) ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white", item.disabled && "cursor-not-allowed opacity-50")}><Icon className="h-5 w-5" />{!collapsed && <><span className="flex-1 text-left">{item.label}</span>{item.external && <ExternalLink className="h-3.5 w-3.5" />}</>}</button>;
          })}
        </nav>
        <div className="m-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3">{collapsed ? <Zap className="mx-auto h-5 w-5 text-blue-200" /> : <><p className="font-semibold text-blue-200">{employee || employeePreviewMode ? "Need IT help?" : "Smart Triage"}</p><p className="mt-1 text-xs text-slate-300">{employee || employeePreviewMode ? "Report an issue or request an IT service." : "Prioritise work using severity, SLA and assignment data."}</p></>}</div>
      </div>
    </aside>
  );
}
