import { AlertTriangle } from "lucide-react";
import CompanyAnnouncements from "../components/dashboard/CompanyAnnouncements";
import LineAssistancePanel from "../components/pdm/LineAssistancePanel";
import WorkspaceShell from "../components/WorkspaceShell";
import { useAuth } from "../hooks/useAuth";

export default function LineAssistancePage() {
  const { user } = useAuth();
  const department = String(user?.department || "").trim().toLowerCase();
  const canUseAssistance = department.includes("production") || department.includes("pdm");

  return (
    <WorkspaceShell>
      <main className="h-full overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-5 xl:p-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">Production and PDM</p>
            <h1 className="mt-2 text-3xl font-black">Line Assistance</h1>
            <p className="mt-2 max-w-3xl text-sm text-cyan-50">
              Alert a Production supervisor or open a ticket using the correct IT or PDM catalogue.
            </p>
          </header>
          <CompanyAnnouncements />
          {canUseAssistance ? (
            <LineAssistancePanel />
          ) : (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Line assistance is available to Production and PDM employees.
            </div>
          )}
        </div>
      </main>
    </WorkspaceShell>
  );
}
