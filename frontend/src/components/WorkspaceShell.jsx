import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import AccountMenu from "./account/AccountMenu";
import useAppearance from "../hooks/useAppearance";
import { useAuth } from "../hooks/useAuth";
import CompanyAnnouncements from "./dashboard/CompanyAnnouncements";

export default function WorkspaceShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { appearance, toggleMode } = useAppearance();
  const [collapsed, setCollapsed] = useState(false);
  const showAnnouncements = location.pathname === "/process-engineering-workspace"
    || /^\/workspaces\/[^/]+$/.test(location.pathname);

  return (
    <div className="portal-page h-screen overflow-hidden">
      <Sidebar navigate={navigate} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className={collapsed ? "flex h-full min-w-0 flex-col transition-all lg:ml-20" : "flex h-full min-w-0 flex-col transition-all lg:ml-72"}>
        <header className="z-20 flex h-[76px] shrink-0 items-center justify-between border-b border-[var(--portal-border)] bg-[var(--portal-surface)]/95 px-5 backdrop-blur-xl xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setCollapsed((value) => !value)} className="rounded-xl border border-[var(--portal-border)] p-2 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            <div className="relative hidden w-[min(420px,38vw)] md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
              <input className="input py-2.5 pl-10" placeholder="Search tickets, users, assets and workspaces" aria-label="Global search" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-xl border border-[var(--portal-border)] p-2.5 text-[var(--portal-text-soft)]" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
            <button type="button" onClick={toggleMode} className="portal-control inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" aria-label="Toggle light and dark mode">{appearance.resolvedMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span className="hidden sm:inline">{appearance.resolvedMode === "dark" ? "Light" : "Dark"}</span></button>
            <AccountMenu />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showAnnouncements && (
            <div className="max-h-[36vh] shrink-0 overflow-y-auto px-4 pt-3 sm:px-5 xl:px-8">
              <CompanyAnnouncements />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
