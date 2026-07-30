import { Activity, Cloud, HeartPulse, Mail, ShieldCheck, Users, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ITEMS = [
  { icon: Users, title: "User Administration", description: "Manage pending signups, active, deactivated and archived accounts.", path: "/admin/users?view=active", available: true },
  { icon: ShieldCheck, title: "Employee Access Preview", description: "Review employee-visible tickets, assets and permissions without impersonation.", path: "/admin/employee-access", available: true },
  { icon: Cloud, title: "Microsoft Directory", description: "Synchronize Microsoft 365 identities while preserving portal roles and archive state.", path: "/admin/users?view=active", available: true },
  { icon: UsersRound, title: "Roles & Support Groups", description: "Configure agent membership, group managers and escalation personnel.", path: null, available: false },
  { icon: Mail, title: "Company Email", description: "Microsoft Graph company email is active. Delivery health and templates will be managed here.", path: null, available: false },
  { icon: Activity, title: "Audit Activity", description: "Review administrative and security-relevant actions.", path: null, available: false },
  { icon: HeartPulse, title: "System Health", description: "Monitor APIs, database connectivity, Graph email and scheduled jobs.", path: null, available: false },
];

export default function AdminSettings() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-100 p-5 xl:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-blue-700">Administration</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Admin Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage access, directory integration, notification delivery and platform governance.</p>
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.title} type="button" onClick={() => item.available && item.path && navigate(item.path)} disabled={!item.available} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">
                <div className="inline-flex rounded-xl bg-blue-100 p-3 text-blue-700"><Icon className="h-6 w-6" /></div>
                <h2 className="mt-4 font-bold text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                {!item.available && <span className="mt-4 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Coming soon</span>}
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
