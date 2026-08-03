import { Bell, Menu, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../hooks/useAuth";

export default function WorkspaceShell({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar navigate={navigate} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className={collapsed ? "flex h-full min-w-0 flex-col transition-all lg:ml-20" : "flex h-full min-w-0 flex-col transition-all lg:ml-72"}>
        <header className="z-20 flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur-xl xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setCollapsed((value) => !value)} className="rounded-xl border border-slate-200 p-2 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            <div className="relative hidden w-[min(420px,38vw)] md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input py-2.5 pl-10" placeholder="Search tickets, users, assets and workspaces" aria-label="Global search" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-xl border border-slate-200 p-2.5 text-slate-600" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
            <div className="hidden text-right sm:block"><p className="text-sm font-bold text-slate-900">{user?.name || "Portal User"}</p><p className="text-xs capitalize text-slate-500">{user?.role || "employee"}</p></div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">{String(user?.name || user?.email || "U").slice(0,1).toUpperCase()}</div>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}