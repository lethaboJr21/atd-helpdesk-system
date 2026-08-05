import { useNavigate } from "react-router-dom";

import Sidebar from "./Sidebar";
import useSidebarCollapsed from "../hooks/useSidebarCollapsed";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

/**
 * Shared Helpdesk command-centre chrome: fixed sidebar, sticky top bar,
 * viewport-locked frame. Content either scrolls (default) or stays locked
 * for pages with their own internal scroll regions (Ticket Workspace).
 */
export default function OperationsShell({
  title,
  subtitle,
  breadcrumb,
  actions,
  children,
  contentClassName,
  /** "auto" = main body scrolls under sticky header; "hidden" = children manage scroll */
  contentOverflow = "auto",
}) {
  const navigate = useNavigate();
  const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapsed();

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#e8eef5] text-slate-900 font-sans">
      <Sidebar
        navigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebarCollapsed}
      />

      <main
        className={classNames(
          // Must match the sidebar's width transition exactly (220ms, same
          // easing) or the content lags visibly behind the rail.
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden [transition:padding-left_220ms_cubic-bezier(0.4,0,0.2,1)]",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        <header className="z-20 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="flex flex-col gap-3 px-4 py-3 lg:px-5 xl:flex-row xl:items-center xl:justify-between xl:gap-4 xl:px-6 xl:py-3.5">
            <div className="min-w-0">
              {breadcrumb ? (
                <p className="truncate text-xs font-medium text-slate-500 xl:text-sm">
                  {breadcrumb}
                </p>
              ) : null}
              <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-950 lg:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-0.5 hidden max-w-2xl text-sm text-slate-500 xl:block">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {actions ? (
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                {actions}
              </div>
            ) : null}
          </div>
        </header>

        <div
          className={classNames(
            "min-h-0 flex-1",
            contentOverflow === "hidden" ? "overflow-hidden" : "overflow-y-auto",
            contentClassName || "px-4 py-3 lg:px-5 lg:py-4 xl:px-6"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
