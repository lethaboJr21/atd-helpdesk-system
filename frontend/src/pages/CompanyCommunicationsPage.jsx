import { Megaphone } from "lucide-react";
import CompanyCommunicationsPanel from "../components/CompanyCommunicationsPanel";

export default function CompanyCommunicationsPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-6 text-white sm:p-8">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-white/10 p-3"><Megaphone className="h-6 w-6" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-200">Manager workspace</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Company Communications</h1>
              <p className="mt-2 max-w-3xl text-sm text-blue-50">
                Prepare a governed message, preview its audience, and confirm before scheduling or sending.
              </p>
            </div>
          </div>
        </header>
        <CompanyCommunicationsPanel />
      </div>
    </main>
  );
}
