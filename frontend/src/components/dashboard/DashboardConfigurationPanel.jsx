import { Copy, LayoutTemplate, Pencil, RotateCcw, Save, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DASHBOARD_WIDGETS, availableDashboardTemplates } from "./dashboardTemplates";
import EmployeeDashboardSnapshot from "./EmployeeDashboardSnapshot";
import { readAppearance } from "../../services/appearance";

function SnapshotCard({ template, visibleWidgets, appearance, selected, label, onSelect }) {
  return (
    <article className={`rounded-2xl border p-3 transition ${selected ? "border-[var(--portal-primary)] ring-2 ring-[var(--portal-focus)]" : "border-[var(--portal-border)]"}`}>
      <EmployeeDashboardSnapshot
        templateId={template?.id || template?.baseTemplateId || "employee"}
        visibleWidgets={visibleWidgets || template?.widgets || []}
        appearance={appearance}
        selected={selected}
        label={`${label || template?.label || "Employee"} dashboard snapshot`}
        height={220}
      />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="portal-title font-bold">{label || template?.label}</p>
          {template?.description ? <p className="portal-muted mt-1 text-xs leading-5">{template.description}</p> : null}
        </div>
        {onSelect ? <button type="button" onClick={onSelect} className="portal-control shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold">{selected ? "Selected" : "Select"}</button> : null}
      </div>
    </article>
  );
}

export default function DashboardConfigurationPanel({
  open,
  onClose,
  role,
  experience = "employee",
  templateId,
  visibleWidgets,
  customLayouts = [],
  activeCustomLayoutId,
  onTemplateChange,
  onApplyCustom,
  onToggleWidget,
  onSaveCustom,
  onUpdateCustom,
  onRenameCustom,
  onDuplicateCustom,
  onDeleteCustom,
  onReset,
}) {
  const panelRef = useRef(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [renameId, setRenameId] = useState(null);
  const templates = useMemo(
    () => availableDashboardTemplates(role, experience).filter((template) => template.widgets.length),
    [role, experience]
  );
  const visible = new Set(visibleWidgets);
  const currentAppearance = readAppearance();

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const run = (action) => {
    try {
      setError("");
      action();
      setName("");
      setRenameId(null);
    } catch (requestError) {
      setError(requestError.message || "The layout could not be saved.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[190] flex justify-end bg-[var(--portal-overlay)] backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" className="portal-surface-raised flex h-full w-full max-w-5xl flex-col border-l shadow-2xl outline-none">
        <header className="flex items-start justify-between border-b border-[var(--portal-border)] p-5">
          <div>
            <div className="portal-accent-soft mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"><Settings2 className="h-3.5 w-3.5" />Dashboard studio</div>
            <h2 className="portal-title text-xl font-bold">Choose and preview a layout</h2>
            <p className="portal-muted mt-1 text-sm">Every preview below is a scaled snapshot of the actual Employee Dashboard.</p>
          </div>
          <button type="button" onClick={onClose} className="portal-control rounded-xl border p-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

          <section>
            <h3 className="portal-title flex items-center gap-2 text-sm font-bold"><LayoutTemplate className="h-4 w-4" />Built-in layouts</h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {templates.map((template) => (
                <SnapshotCard
                  key={template.id}
                  template={template}
                  visibleWidgets={template.widgets}
                  appearance={currentAppearance}
                  selected={templateId === template.id && !activeCustomLayoutId}
                  onSelect={() => onTemplateChange(template.id)}
                />
              ))}
            </div>
          </section>

          <section className="mt-7 border-t border-[var(--portal-border)] pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-52 flex-1">
                <label className="portal-title text-sm font-bold">Save current appearance and layout</label>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Layout name" className="portal-control mt-2 w-full rounded-xl border px-3 py-2" />
              </div>
              <button type="button" onClick={() => run(() => onSaveCustom(name))} className="portal-accent-fill inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"><Save className="h-4 w-4" />Save profile</button>
            </div>

            <h3 className="portal-title mt-6 text-sm font-bold">My appearance and layout profiles</h3>
            {customLayouts.length ? (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {customLayouts.map((layout) => (
                  <div key={layout.id} className="rounded-2xl border border-[var(--portal-border)] p-3">
                    <EmployeeDashboardSnapshot templateId={layout.baseTemplateId} visibleWidgets={layout.visibleWidgets} appearance={layout.appearance} selected={activeCustomLayoutId === layout.id} label={`${layout.name} saved dashboard snapshot`} height={220} />
                    {renameId === layout.id ? (
                      <input autoFocus defaultValue={layout.name} onBlur={(event) => run(() => onRenameCustom(layout.id, event.target.value))} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} className="portal-control mt-3 w-full rounded-lg border px-2 py-1" />
                    ) : <p className="portal-title mt-3 font-bold">{layout.name}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => onApplyCustom(layout.id)} className="portal-control rounded-lg border px-2.5 py-1.5 text-xs font-bold">Apply</button>
                      <button type="button" onClick={() => onUpdateCustom(layout.id)} className="portal-control rounded-lg border px-2.5 py-1.5 text-xs font-bold">Update</button>
                      <button type="button" onClick={() => setRenameId(layout.id)} className="portal-control rounded-lg border p-1.5" aria-label="Rename"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => onDuplicateCustom(layout.id)} className="portal-control rounded-lg border p-1.5" aria-label="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => window.confirm(`Delete ${layout.name}?`) && onDeleteCustom(layout.id)} className="rounded-lg border border-red-300 p-1.5 text-red-600" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="portal-muted mt-3 rounded-xl border border-dashed border-[var(--portal-border)] p-5 text-sm">No saved profiles yet. Adjust the layout and appearance, then save the current setup.</p>}
          </section>

          <section className="mt-7 border-t border-[var(--portal-border)] pt-6">
            <h3 className="portal-title text-sm font-bold">Current dashboard snapshot</h3>
            <p className="portal-muted mt-1 text-xs">Preview only. The frame does not save or complete onboarding.</p>
            <div className="mt-3">
              <EmployeeDashboardSnapshot templateId={templateId} visibleWidgets={visibleWidgets} appearance={currentAppearance} selected label="Current Employee Dashboard snapshot" height={360} />
            </div>
          </section>

          <section className="mt-7 border-t border-[var(--portal-border)] pt-6">
            <h3 className="portal-title text-sm font-bold">Visible widgets</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.values(DASHBOARD_WIDGETS).map((widget) => {
                const checked = visible.has(widget.id);
                return <label key={widget.id} className="portal-control flex cursor-pointer items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={checked} disabled={checked && visible.size === 1} onChange={() => onToggleWidget(widget.id)} className="mt-1" /><span><span className="portal-title block text-sm font-bold">{widget.label}</span><span className="portal-muted block text-xs">{widget.description}</span></span></label>;
              })}
            </div>
          </section>
        </div>

        <footer className="border-t border-[var(--portal-border)] p-5">
          <button type="button" onClick={onReset} className="portal-control inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold"><RotateCcw className="h-4 w-4" />Restore default layout</button>
        </footer>
      </aside>
    </div>
  );
}