import {
  BriefcaseBusiness, CircleHelp, FolderKanban, KeyRound, Laptop, LifeBuoy,
  Loader2, Mail, Monitor, Network, PackagePlus, Phone, Plus, Printer,
  ShieldAlert, ShoppingCart, TriangleAlert, Wrench, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { catalogApi } from "../../services/api";

const REQUEST_ENTRIES = [
  { key: "incident", title: "Report an Incident", description: "Report a fault, outage, error or service that is not working correctly.", path: "/incidents/catalogue", icon: LifeBuoy, iconClass: "bg-rose-100 text-rose-700" },
  { key: "service", title: "Request a Service", description: "Request access, software, support or another standard company service.", path: "/services", icon: ShoppingCart, iconClass: "bg-blue-100 text-blue-700" },
  { key: "change", title: "Change Management", description: "Plan and submit an application, infrastructure or configuration change.", path: "/changes/new", icon: BriefcaseBusiness, iconClass: "bg-amber-100 text-amber-700" },
  { key: "asset", title: "Request an Asset", description: "Request equipment, devices, accessories, replacements or temporary assets.", path: "/request-asset", icon: PackagePlus, iconClass: "bg-emerald-100 text-emerald-700" },
  { key: "plant", title: "Plant Machine Support", description: "Report machine, station, control, safety, quality or production-impacting issues.", path: "/incidents/catalogue?search=plant", icon: Wrench, iconClass: "bg-cyan-100 text-cyan-700" },
  { key: "project", title: "Create a Project", description: "Initiate a structured project with ownership, objectives and target dates.", path: "/projects/new", icon: FolderKanban, iconClass: "bg-purple-100 text-purple-700" },
];

const FALLBACK_INCIDENTS = [
  { key: "computer", title: "Computer or laptop", icon: Laptop, color: "bg-blue-100 text-blue-700", priority: "Medium" },
  { key: "printer", title: "Printer or scanner", icon: Printer, color: "bg-violet-100 text-violet-700", priority: "Medium" },
  { key: "network", title: "Network or Wi-Fi", icon: Network, color: "bg-cyan-100 text-cyan-700", priority: "High" },
  { key: "email", title: "Email or Microsoft 365", icon: Mail, color: "bg-sky-100 text-sky-700", priority: "Medium" },
  { key: "application", title: "Business application", icon: Monitor, color: "bg-indigo-100 text-indigo-700", priority: "Medium" },
  { key: "erp", title: "Syspro or ERP", icon: Monitor, color: "bg-fuchsia-100 text-fuchsia-700", priority: "High" },
  { key: "access", title: "Account or access problem", icon: KeyRound, color: "bg-amber-100 text-amber-700", priority: "Medium" },
  { key: "telephone", title: "Telephone or communication device", icon: Phone, color: "bg-teal-100 text-teal-700", priority: "Medium" },
  { key: "plant-machine", title: "Machine or plant equipment", icon: Wrench, color: "bg-orange-100 text-orange-700", priority: "High" },
  { key: "safety-technology", title: "Safety-related technology issue", icon: ShieldAlert, color: "bg-red-100 text-red-700", priority: "Critical" },
  { key: "asset-fault", title: "Asset damage or malfunction", icon: TriangleAlert, color: "bg-pink-100 text-pink-700", priority: "High" },
  { key: "other", title: "Other", icon: CircleHelp, color: "bg-slate-100 text-slate-700", priority: null, is_other: true },
];

const ICON_MAP = {
  laptop: Laptop,
  printer: Printer,
  network: Network,
  email: Mail,
  monitor: Monitor,
  wrench: Wrench,
  key: KeyRound,
  phone: Phone,
  shield: ShieldAlert,
  triangle: TriangleAlert,
  help: CircleHelp,
  briefcase: BriefcaseBusiness,
};

const COLOUR_MAP = {
  blue: "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700",
  cyan: "bg-cyan-100 text-cyan-700",
  sky: "bg-sky-100 text-sky-700",
  indigo: "bg-indigo-100 text-indigo-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  amber: "bg-amber-100 text-amber-700",
  teal: "bg-teal-100 text-teal-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700",
  pink: "bg-pink-100 text-pink-700",
  slate: "bg-slate-100 text-slate-700",
  green: "bg-green-100 text-green-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

function mapApiItem(item) {
  return {
    key: String(item.id),
    title: item.item_name,
    priority: item.default_priority || "Medium",
    icon: ICON_MAP[item.icon_key] || CircleHelp,
    color: COLOUR_MAP[item.colour_key] || "bg-slate-100 text-slate-700",
    category: item.category || null,
    sub_category: item.sub_category || null,
    priority_locked: item.priority_locked,
    summary_locked: item.summary_locked,
    default_summary: item.default_summary || null,
    is_other: item.is_other,
  };
}

function groupByCategory(items) {
  const groups = {};
  const order = [];
  for (const item of items) {
    const cat = item.category || "";
    if (!groups[cat]) {
      groups[cat] = [];
      order.push(cat);
    }
    groups[cat].push(item);
  }
  return order.map((cat) => ({ category: cat, items: groups[cat] }));
}

export default function RequestEntryMenu({ open, onClose, onSelect }) {
  const [beneficiary, setBeneficiary] = useState("self");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidents, setIncidents] = useState(FALLBACK_INCIDENTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setIncidentOpen(false);
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    catalogApi.getManagedItIncidents({ activeOnly: true })
      .then((r) => {
        if (cancelled) return;
        const data = r.data;
        if (Array.isArray(data) && data.length > 0) {
          setIncidents(data.map(mapApiItem));
        } else {
          setIncidents(FALLBACK_INCIDENTS);
        }
      })
      .catch(() => {
        if (!cancelled) setIncidents(FALLBACK_INCIDENTS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const choose = (path) => {
    const join = path.includes("?") ? "&" : "?";
    onSelect({ path: `${path}${join}beneficiary=${beneficiary}` });
  };

  const chooseIncident = () => choose("/incidents/catalogue");

  const groups = groupByCategory(incidents);
  const showHeadings = groups.length > 1 || (groups.length === 1 && groups[0].category);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-10 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-entry-title"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-[var(--portal-border)] bg-[var(--portal-surface-raised)] shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[var(--portal-border)] p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
              <Plus className="h-3.5 w-3.5" />New request
            </div>
            <h2 id="request-entry-title" className="text-2xl font-bold text-[var(--portal-text)]">Who is this ticket for?</h2>
            <p className="mt-2 text-sm text-[var(--portal-text-soft)]">Choose the beneficiary before selecting the request type.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--portal-border)] p-2">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {[["self", "Ticket for Myself", "Use my signed-in employee profile."], ["other", "For Someone Else", "Choose the employee before opening the request."]].map(([key, title, copy]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBeneficiary(key)}
                className={`rounded-2xl border p-4 text-left ${beneficiary === key ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-[var(--portal-border)] bg-[var(--portal-surface)]"}`}
              >
                <span className="block font-bold text-[var(--portal-text)]">{title}</span>
                <span className="mt-1 block text-sm text-[var(--portal-text-soft)]">{copy}</span>
              </button>
            ))}
          </div>

          {!incidentOpen ? (
            <>
              <h3 className="mt-6 text-lg font-bold text-[var(--portal-text)]">Choose request type</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {REQUEST_ENTRIES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => choose(item.path)}
                      className="flex items-start gap-4 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-left hover:border-blue-300"
                    >
                      <span className={`rounded-xl p-3 ${item.iconClass}`}><Icon className="h-5 w-5" /></span>
                      <span>
                        <span className="block font-bold text-[var(--portal-text)]">{item.title}</span>
                        <span className="mt-1 block text-sm text-[var(--portal-text-soft)]">{item.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--portal-text)]">Report an Incident catalogue</h3>
                <button type="button" onClick={() => setIncidentOpen(false)} className="text-sm font-bold text-blue-700">
                  Back to request types
                </button>
              </div>
              <p className="mt-1 text-sm text-[var(--portal-text-soft)]">
                Catalogue selections lock the governed short summary and priority. Other opens a blank editable incident.
              </p>

              {loading ? (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[var(--portal-text-soft)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading catalogue…
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  {showHeadings ? (
                    groups.map(({ category, items }) => (
                      <div key={category || "__none__"}>
                        {category && (
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--portal-text-soft)]">{category}</p>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => chooseIncident(item)}
                                className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-left font-bold text-[var(--portal-text)] hover:border-rose-300 hover:shadow-sm"
                              >
                                <span className={`rounded-xl p-2.5 ${item.color}`}><Icon className="h-5 w-5" /></span>
                                <span>{item.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {incidents.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => chooseIncident(item)}
                            className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-left font-bold text-[var(--portal-text)] hover:border-rose-300 hover:shadow-sm"
                          >
                            <span className={`rounded-xl p-2.5 ${item.color}`}><Icon className="h-5 w-5" /></span>
                            <span>{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
