import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "./Sidebar";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar
        navigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={() =>
          setSidebarCollapsed((currentValue) => !currentValue)
        }
      />

      <main
        className={classNames(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-300",
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
          className={
            contentClassName ||
            classNames(
              "min-h-0 flex-1 px-4 py-3 lg:px-5 lg:py-4 xl:px-6",
              contentOverflow === "hidden"
                ? "overflow-hidden"
                : "overflow-y-auto"
            )
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
