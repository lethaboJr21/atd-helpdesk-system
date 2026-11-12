import { Monitor, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AccountMenu from "./account/AccountMenu";
import Sidebar from "./Sidebar";
import useSidebarCollapsed from "../hooks/useSidebarCollapsed";
import { useAuth } from "../hooks/useAuth";
import useAppearance from "../hooks/useAppearance";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

export default function OperationsShell({
  title,
  subtitle,
  breadcrumb,
  actions,
  children,
  contentClassName,
  contentOverflow = "auto",
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { appearance, toggleMode } = useAppearance();
  const operationsUser = new Set(["agent", "operator", "manager", "admin", "superadmin"]).has(user?.role);
  const [sidebarCollapsed, toggleSidebarCollapsed] =
    useSidebarCollapsed();

  return (
    <div className="portal-shell fixed inset-0 flex overflow-hidden font-sans">
      <Sidebar
        navigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebarCollapsed}
      />

      <main
        className={classNames(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden [transition:padding-left_220ms_cubic-bezier(0.4,0,0.2,1)]",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        <header className="portal-header relative z-[100] shrink-0 overflow-visible border-b backdrop-blur-xl">
          <div className="flex flex-col gap-3 overflow-visible px-4 py-3 lg:px-5 xl:flex-row xl:items-center xl:justify-between xl:gap-4 xl:px-6 xl:py-3.5">
            <div className="min-w-0">
              {breadcrumb ? (
                <p className="truncate text-xs font-medium portal-muted xl:text-sm">
                  {breadcrumb}
                </p>
              ) : null}

              <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight portal-title lg:text-2xl">
                {title}
              </h1>

              {subtitle ? (
                <p className="mt-0.5 hidden max-w-2xl text-sm portal-copy xl:block">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="operations-header-actions relative flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 overflow-visible">
              {actions}
              {operationsUser ? (
                <button type="button" onClick={() => navigate("/ticket-monitor")} className="portal-control inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold">
                  <Monitor className="h-4 w-4" /> Ticket Monitor
                </button>
              ) : null}
              <button type="button" onClick={toggleMode} className="portal-control inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" aria-label="Toggle light and dark mode">
                {appearance.resolvedMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="hidden sm:inline">{appearance.resolvedMode === "dark" ? "Light" : "Dark"}</span>
              </button>
              <AccountMenu />
            </div>
          </div>
        </header>

        <div
          className={classNames(
            "relative z-0 min-h-0 flex-1",
            contentOverflow === "hidden"
              ? "overflow-hidden"
              : "overflow-y-auto",
            contentClassName || "px-4 py-3 lg:px-5 lg:py-4 xl:px-6"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
