import {
  Activity,
  ArrowLeft,
  Cloud,
  HeartPulse,
  Mail,
  ShieldCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import SystemEmailControls from "../components/SystemEmailControls";

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
      "Open Active Users and sync Microsoft 365 identities (use Sync Microsoft 365).",
    path: "/admin/users?view=active",
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
];

export default function AdminSettings() {
  const navigate = useNavigate();
  const [panel, setPanel] = useState(null);

  const activateItem = (item) => {
    if (!item.available) return;
    if (item.action === "email") {
      setPanel("email");
      return;
    }
    if (item.path) navigate(item.path);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-5 xl:p-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <p className="text-sm font-semibold text-blue-700">
          Administration
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Admin Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Manage access, directory integration, notification delivery
          and platform governance.
        </p>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => activateItem(item)}
                disabled={!item.available}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="inline-flex rounded-xl bg-blue-100 p-3 text-blue-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-bold text-slate-950">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
                {!item.available && (
                  <span className="mt-4 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    Coming soon
                  </span>
                )}
              </button>
            );
          })}
        </section>
      </div>

      {panel === "email" && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b p-5">
              <div>
                <p className="text-sm font-bold text-blue-700">
                  Admin Settings
                </p>
                <h2 className="text-xl font-bold">
                  Company Email Governance
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
            <div className="p-6">
              <SystemEmailControls embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
