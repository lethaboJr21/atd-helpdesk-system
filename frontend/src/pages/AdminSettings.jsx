import {
  Activity,
  Cloud,
  HeartPulse,
  Mail,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const SETTINGS_ITEMS = [
  {
    icon: Users,
    title: "User Management",
    description:
      "Manage employee profiles, portal roles, approvals and account lifecycle.",
    path: "/admin/users",
    available: true,
  },
  {
    icon: ShieldCheck,
    title: "Employee Access Preview",
    description:
      "Verify what an employee can see without allowing impersonated write actions.",
    path: "/admin/employee-access",
    available: true,
  },
  {
    icon: Cloud,
    title: "Microsoft Directory",
    description:
      "Review Microsoft 365 synchronisation and directory data quality.",
    path: "/admin/users",
    available: true,
  },
  {
    icon: UsersRound,
    title: "Roles & Support Groups",
    description:
      "Configure portal roles, agent responsibilities and support groups.",
    path: "/admin/users",
    available: true,
  },
  {
    icon: Mail,
    title: "Email Configuration",
    description:
      "Review notification delivery, templates and SMTP health.",
    path: null,
    available: false,
  },
  {
    icon: Activity,
    title: "Audit Activity",
    description:
      "Review administrative actions and security-relevant events.",
    path: null,
    available: false,
  },
  {
    icon: HeartPulse,
    title: "System Health",
    description:
      "Monitor APIs, scheduled jobs, database connectivity and integrations.",
    path: null,
    available: false,
  },
];

export default function AdminSettings() {
  const navigate = useNavigate();

  const handleOpenSetting = (item) => {
    if (!item.available || !item.path) {
      return;
    }

    navigate(item.path);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="text-sm font-semibold text-blue-700">
            Administration
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Admin Settings
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage access, directory integration, notifications and platform
            governance from one central location.
          </p>
        </header>

        <section
          className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Administration settings"
        >
          {SETTINGS_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => handleOpenSetting(item)}
                disabled={!item.available}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-white"
              >
                <div className="inline-flex rounded-xl bg-blue-100 p-3 text-blue-700 transition group-hover:bg-blue-200">
                  <Icon className="h-6 w-6" />
                </div>

                <h2 className="mt-4 text-base font-bold text-slate-950">
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
    </div>
  );
}
