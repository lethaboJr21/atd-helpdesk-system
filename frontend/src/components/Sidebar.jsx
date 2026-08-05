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
  LifeBuoy,
  Lightbulb,
  PackagePlus,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  User,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import { useState } from "react";
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
    { section: "Raise a request" },
    {
      icon: LifeBuoy,
      label: "Report an Incident",
      path: "/incidents/new",
    },
    {
      icon: ShoppingCart,
      label: "Service Catalog",
      path: "/services",
    },
    {
      icon: PackagePlus,
      label: "Request an Asset",
      path: "/request-asset",
    },
    {
      icon: BriefcaseBusiness,
      label: "Request a Change",
      path: "/changes/new",
    },
    { section: "Track and self-help" },
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
      icon: Lightbulb,
      label: "Solutions",
      path: "/knowledge",
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
      { section: "Administration" },
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

  const [tooltip, setTooltip] = useState(null);

  const isActive = (path) => {
    if (!path) {
      return false;
    }

    const cleanPath = normalizePath(path);

    if (cleanPath === "/" || cleanPath === "/employee") {
      return (
        location.pathname === cleanPath ||
        location.pathname === "/dashboard"
      );
    }

    return (
      location.pathname === cleanPath ||
      location.pathname.startsWith(`${cleanPath}/`)
    );
  };

  // Collapsed rail: a single fixed-position tooltip avoids the nav's scroll
  // container clipping per-item popovers (and native title delays).
  const showTooltip = (event, label) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 12 });
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
    <>
    <aside
      className={classNames(
        // Animate width only (not `all`) and hint the compositor — animating
        // every property forced needless style recalcs on each frame.
        "fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-slate-800 bg-slate-950 text-white [transition:width_220ms_cubic-bezier(0.4,0,0.2,1)] [will-change:width] lg:block",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Both marks stay mounted and cross-fade — swapping the img src on
            toggle caused a decode flash mid-animation. */}
        <div
          className={classNames(
            "flex h-[5.5rem] shrink-0 flex-col justify-center border-b border-white/10",
            collapsed ? "items-center px-3" : "px-5"
          )}
        >
          <div className="relative h-11 w-full">
            <img
              src="/helpdesk/atd-wordmark-tile.png?v=1"
              alt=""
              aria-hidden={!collapsed}
              className={classNames(
                "absolute top-1/2 h-11 w-11 -translate-y-1/2 rounded-xl bg-white object-contain p-1.5 transition-opacity duration-150",
                collapsed ? "left-1/2 -translate-x-1/2 opacity-100" : "left-0 opacity-0"
              )}
            />
            <img
              src="/helpdesk/atd-helpdesk-logo.png?v=8"
              alt="ATD Helpdesk"
              className={classNames(
                "absolute left-0 top-1/2 h-11 w-[9.5rem] max-w-none -translate-y-1/2 object-contain object-left transition-opacity duration-150",
                collapsed ? "opacity-0" : "opacity-100"
              )}
            />
          </div>

          <p
            className={classNames(
              "w-full truncate whitespace-nowrap text-[11px] leading-snug text-slate-400 transition-opacity duration-150",
              collapsed ? "h-0 opacity-0" : "mt-1 opacity-100"
            )}
          >
            {employeeExperience
              ? "Employee Self-Service"
              : "Helpdesk Command Centre"}
          </p>
        </div>

        <div className="shrink-0 px-3 pt-4">
          <button
            type="button"
            onClick={onToggle}
            className={classNames(
              "flex w-full items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 py-2 text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white",
              collapsed ? "justify-center px-3" : "justify-between px-3"
            )}
            aria-label={
              collapsed ? "Expand navigation" : "Collapse navigation"
            }
          >
            <span
              className={classNames(
                "whitespace-nowrap text-sm font-semibold transition-opacity duration-150",
                collapsed ? "w-0 opacity-0" : "opacity-100"
              )}
            >
              Collapse menu
            </span>

            <ChevronLeft
              className={classNames(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        <nav
          className="scroll-hidden flex-1 space-y-1 overflow-y-auto px-3 py-5"
          onMouseLeave={() => setTooltip(null)}
        >
          {items.map((item, index) => {
            if (item.section) {
              // Fixed height in both states so rows never jump vertically.
              return (
                <div
                  key={item.section}
                  className="relative flex h-9 items-end px-4 pb-1"
                >
                  <span
                    className={classNames(
                      "whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 transition-opacity duration-150",
                      collapsed ? "opacity-0" : "opacity-100"
                    )}
                  >
                    {item.section}
                  </span>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      "absolute left-1/2 h-px w-8 -translate-x-1/2 bg-white/10 transition-opacity duration-150",
                      collapsed ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>
              );
            }

            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                onMouseEnter={(event) => showTooltip(event, item.label)}
                onMouseLeave={() => setTooltip(null)}
                onFocus={(event) => showTooltip(event, item.label)}
                onBlur={() => setTooltip(null)}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={classNames(
                  "group relative flex w-full items-center overflow-hidden rounded-2xl py-3 text-sm font-medium",
                  "[transition:background-color_150ms_ease,color_150ms_ease]",
                  collapsed ? "justify-center px-3" : "gap-3 px-4",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                  item.disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />

                {/* Labels stay mounted and fade — unmounting them mid-slide
                    made the text reflow and snap. */}
                <span
                  className={classNames(
                    "flex-1 whitespace-nowrap text-left transition-opacity duration-150",
                    collapsed
                      ? "pointer-events-none w-0 flex-none opacity-0"
                      : "opacity-100"
                  )}
                >
                  {item.label}
                </span>

                {item.external ? (
                  <ExternalLink
                    className={classNames(
                      "h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity duration-150",
                      collapsed && "w-0 opacity-0"
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        {(() => {
          const Wrapper = employeeExperience ? "button" : "div";
          const wrapperProps = employeeExperience
            ? {
                type: "button",
                onClick: () => navigate("/incidents/new"),
                onMouseEnter: (event) =>
                  showTooltip(event, "Report an incident"),
                onMouseLeave: () => setTooltip(null),
                "aria-label": collapsed ? "Report an incident" : undefined,
              }
            : {};

          return (
            <Wrapper
              {...wrapperProps}
              className={classNames(
                "m-3 shrink-0 overflow-hidden rounded-2xl border border-blue-400/25 bg-blue-500/10 text-left transition-colors duration-150",
                employeeExperience &&
                  "hover:border-blue-300/40 hover:bg-blue-500/20",
                collapsed ? "flex justify-center p-3" : "p-3.5"
              )}
            >
              {collapsed ? (
                <Zap className="h-5 w-5 shrink-0 text-blue-200" />
              ) : (
                <div className="min-w-[12rem]">
                  <p className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-blue-100">
                    <Zap className="h-4 w-4 shrink-0" />
                    {employeeExperience ? "Something broken?" : "Smart Triage"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    {employeeExperience
                      ? "Report an incident and IT will pick it up."
                      : "Prioritise work using severity, SLA and assignment data."}
                  </p>
                </div>
              )}
            </Wrapper>
          );
        })()}
      </div>
    </aside>

    {/* Rendered outside the rail so its clipping never affects the tooltip. */}
    {collapsed && tooltip ? (
      <div
        role="tooltip"
        style={{ top: tooltip.top, left: tooltip.left }}
        className="pointer-events-none fixed z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-lg ring-1 ring-white/10 lg:block"
      >
        {tooltip.label}
      </div>
    ) : null}
    </>
  );
}
