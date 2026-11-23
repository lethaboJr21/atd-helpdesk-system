import { Activity, ShieldCheck } from "lucide-react";
import ErrorLoggerViewer from "../components/pulse/ErrorLoggerViewer";

export default function ErrorLoggerPage() {
  return (
    <main className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 right-1/4 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[.24em] text-sky-300">ATD Pulse · Reliability</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Error lifecycle</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                Investigate live application errors, follow their resolution, and keep the verified fix available for the next incident.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">Live monitoring</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  Restricted to authorised administrators
                </p>
              </div>
            </div>
          </div>
        </header>
        <ErrorLoggerViewer />
      </div>
    </main>
  );
}
