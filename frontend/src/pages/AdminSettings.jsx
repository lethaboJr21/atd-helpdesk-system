import {
  Activity,
  ArrowLeft,
  Cloud,
  HeartPulse,
  Archive,
  Mail,
  ShieldCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import SystemEmailControls from "../components/SystemEmailControls";
import CompanyCommunicationsPanel from "../components/CompanyCommunicationsPanel";
import AdminUniversalHeader from "../components/admin/AdminUniversalHeader";
import ArchiveRulesPanel from "../components/admin/ArchiveRulesPanel";
import { useAuth } from "../hooks/useAuth";

const ITEMS = [
  {
    icon: Users,
    title: "User Administration",
    description:
      "Manage pending signups, active, deactivated and archived accounts.",
    path: "/admin/users",
    available: true,
  },
  {
    icon: ShieldCheck,
    title: "Employee Access Preview",
    description:
      "Review employee-visible tickets, assets and permissions without impersonation.",
    path: "/admin/employee-access",
    available: true,
  },
  {
    icon: Cloud,
    title: "Microsoft Directory",
    description:
      "Browse Microsoft 365 identities and sync them into the helpdesk.",
    path: "/admin/microsoft",
    available: true,
  },
  {
    icon: UsersRound,
    title: "Roles and Support Groups",
    description:
      "Configure agent membership, group managers and escalation personnel.",
    path: "/admin/groups",
    available: true,
  },
  {
    icon: Mail,
    title: "Company Email",
    description:
      "Control live, testing and disabled email delivery modes and categories.",
    action: "email",
    available: true,
  },
  {
    icon: Mail,
    title: "Company Communications",
    description: "Draft, preview, test, schedule and audit transition communications.",
    action: "communications",
    available: true,
  },
  { icon: Archive, title: "Ticket Archive Rules", description: "Configure disabled-by-default requester non-response governance.", action: "archive-rules", available: true },
  {
    icon: Activity,
    title: "Audit Activity",
    description:
      "Review administrative and security-relevant actions.",
    path: "/admin/audit",
    available: true,
  },
  {
    icon: HeartPulse,
    title: "System Health",
    description:
      "Monitor APIs, database connectivity, Graph email and scheduled jobs.",
    path: "/admin/health",
    available: true,
  },
  {
    icon: Activity,
    title: "Workflow Observatory",
    description:
      "Trace request stages, inject tagged test failures, and review observed service downtime.",
    path: "/admin/workflow-observability",
    available: true,
    roles: ["admin", "superadmin"],
  },
];

export default function AdminSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [panel, setPanel] = useState(null);

  const activateItem = (item) => {
    if (!item.available) return;
    if (["email","communications","archive-rules"].includes(item.action)) {
      setPanel(item.action);
      return;
    }
    if (item.path) navigate(item.path);
  };

  return (
    <div className="portal-shell min-h-screen p-3 sm:p-4 xl:p-5"><AdminUniversalHeader title="Administration" />
      <div className="mx-auto w-full max-w-[1700px]">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border portal-surface-raised px-4 py-2 text-sm font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <p className="text-sm font-semibold text-[var(--portal-primary)]">
          Administration
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Admin Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 portal-muted">
          Manage access, directory integration, notification delivery
          and platform governance.
        </p>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => activateItem(item)}
                disabled={!item.available}
                className="rounded-2xl border portal-border portal-surface-raised p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-[var(--portal-selected-bg)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="inline-flex rounded-xl bg-[var(--portal-selected-bg)] p-3 text-[var(--portal-primary)]">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-bold text-slate-950">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 portal-muted">
                  {item.description}
                </p>
                {!item.available && (
                  <span className="mt-4 inline-flex rounded-full portal-surface-muted px-2.5 py-1 text-xs font-bold portal-muted">
                    Coming soon
                  </span>
                )}
              </button>
            );
          })}
        </section>
      </div>

      {["email","communications","archive-rules"].includes(panel) && (
        <div
          className="fixed inset-0 z-[900] flex items-stretch justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-3 lg:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="portal-admin-workspace flex h-full min-h-0 w-full max-w-[1720px] flex-col overflow-hidden rounded-2xl border portal-surface-raised shadow-2xl">
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b bg-[var(--portal-surface-raised)] px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-bold text-[var(--portal-primary)]">
                  Admin Settings
                </p>
                <h2 className="text-xl font-bold">
                  {panel === "email" ? "Company Email Governance" : panel === "communications" ? "Company Communications" : "Ticket Archive Rules"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-xl border p-2"
                aria-label="Close email settings"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
              {panel === "email" ? <SystemEmailControls embedded /> : panel === "communications" ? <CompanyCommunicationsPanel /> : <ArchiveRulesPanel />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
