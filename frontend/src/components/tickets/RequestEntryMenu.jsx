import {
  BriefcaseBusiness,
  FolderKanban,
  LifeBuoy,
  PackagePlus,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";
import { useEffect } from "react";

const REQUEST_ENTRIES = [
  {
    key: "incident",
    title: "Report an Incident",
    description: "Report a fault, outage, error or service that is not working correctly.",
    path: "/incidents/new",
    icon: LifeBuoy,
    iconClass: "bg-rose-100 text-rose-700",
  },
  {
    key: "service",
    title: "Request a Service",
    description: "Request access, software, support or another standard company service.",
    path: "/services",
    icon: ShoppingCart,
    iconClass: "bg-blue-100 text-blue-700",
  },
  {
    key: "change",
    title: "Change Management",
    description: "Plan and submit an application, infrastructure or configuration change.",
    path: "/changes/new",
    icon: BriefcaseBusiness,
    iconClass: "bg-amber-100 text-amber-700",
  },
  {
    key: "asset",
    title: "Request an Asset",
    description: "Request equipment, devices, accessories, replacements or temporary assets.",
    path: "/request-asset",
    icon: PackagePlus,
    iconClass: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "project",
    title: "Create a Project",
    description: "Initiate a structured project with ownership, objectives and target dates.",
    path: "/projects/new",
    icon: FolderKanban,
    iconClass: "bg-purple-100 text-purple-700",
  },
];

export default function RequestEntryMenu({ open, onClose, onSelect }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-10 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-entry-title"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
              <Plus className="h-3.5 w-3.5" /> New request
            </div>
            <h2 id="request-entry-title" className="text-2xl font-bold text-slate-950">
              What would you like to create?
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Select the request type. The Helpdesk opens the correct catalogue or form immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close request type selector"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          {REQUEST_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onSelect(entry)}
                className="group flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
              >
                <span className={`rounded-2xl p-3 ${entry.iconClass}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-base font-bold text-slate-950 group-hover:text-blue-800">
                    {entry.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">
                    {entry.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}