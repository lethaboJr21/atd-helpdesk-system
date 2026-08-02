import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Mail, X } from "lucide-react";
import { adminControlsApi } from "../services/api";

const FEATURE_SECTIONS = [
  { title: "Employee experience", keys: ["employee_dashboard", "my_tickets", "my_assets", "report_incident", "request_service", "request_asset", "request_change", "knowledge", "notifications"] },
  { title: "Operations experience", keys: ["operations_dashboard", "ticket_workspace", "asset_register", "production_operations"] },
  { title: "Administration", keys: ["user_management", "group_management", "admin_settings"] },
];

const FEATURE_LABELS = {
  employee_dashboard: "Employee Dashboard", my_tickets: "My Tickets", my_assets: "My Assets",
  report_incident: "Report an Incident", request_service: "Request a Service", request_asset: "Request an Asset",
  request_change: "Change Management", knowledge: "Knowledge Base", notifications: "Notifications",
  operations_dashboard: "Operations Dashboard", ticket_workspace: "Ticket Workspace", asset_register: "Asset Register",
  production_operations: "Production Operations", user_management: "User Administration",
  group_management: "Groups and Agents", admin_settings: "Admin Settings",
};

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.message || "Settings could not be saved.";
}

export default function UserAccessDialog({ account, initialTab = "features", onClose, onSaved }) {
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [features, setFeatures] = useState({});
  const [baseline, setBaseline] = useState({});
  const [email, setEmail] = useState({
    enabled: true,
    assignment: true,
    ticket_update: true,
    reminder: true,
    escalation: true,
    administrative: true,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminControlsApi.getUserControls(account.id)
      .then((response) => {
        if (cancelled) return;
        const data = response.data || {};
        setFeatures(data.features?.overrides || data.featureOverrides || {});
        setBaseline(data.features?.baseline || data.featureBaseline || {});
        setEmail({
          enabled: data.emailPreferences?.enabled !== false,
          assignment: data.emailPreferences?.assignment !== false,
          ticket_update: data.emailPreferences?.ticket_update !== false,
          reminder: data.emailPreferences?.reminder !== false,
          escalation: data.emailPreferences?.escalation !== false,
          administrative: data.emailPreferences?.administrative !== false,
        });
      })
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account.id]);

  const effectiveFeatures = useMemo(() => ({ ...baseline, ...features }), [baseline, features]);

  const setFeature = (key, value) => {
    setFeatures((current) => ({ ...current, [key]: value }));
  };

  const clearOverride = (key) => {
    setFeatures((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (tab === "features") {
        await adminControlsApi.updateUserFeatures(account.id, { features });
        onSaved("User access and layout preferences updated.");
      } else {
        await adminControlsApi.updateUserEmailPreferences(account.id, email);
        onSaved("User email preferences updated.");
      }
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b p-6">
          <div><p className="text-sm font-bold text-blue-700">User Controls</p><h2 className="mt-1 text-2xl font-bold">{account.name || account.email}</h2><p className="mt-1 text-sm text-slate-500">Control visible functions and personal email preferences.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border p-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex gap-2 border-b p-4">
          <button type="button" onClick={() => setTab("features")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${tab === "features" ? "bg-blue-600 text-white" : "bg-slate-100"}`}><LayoutGrid className="h-4 w-4" />Access and Layout</button>
          <button type="button" onClick={() => setTab("email")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${tab === "email" ? "bg-blue-600 text-white" : "bg-slate-100"}`}><Mail className="h-4 w-4" />Email Preferences</button>
        </div>

        <div className="p-6">
          {loading ? <p className="text-slate-500">Loading user controls...</p> : (
            <>
              {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
              {tab === "features" ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Role permissions remain authoritative. These settings customise access and layout without bypassing protected backend roles.</div>
                  {FEATURE_SECTIONS.map((section) => (
                    <section key={section.title}>
                      <h3 className="font-bold text-slate-950">{section.title}</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {section.keys.map((key) => {
                          const hasOverride = Object.prototype.hasOwnProperty.call(features, key);
                          return (
                            <div key={key} className="rounded-xl border p-4">
                              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{FEATURE_LABELS[key]}</p><p className="mt-1 text-xs text-slate-500">{hasOverride ? "Custom override" : "Inherited from role"}</p></div><input type="checkbox" checked={Boolean(effectiveFeatures[key])} onChange={(event) => setFeature(key, event.target.checked)} /></div>
                              {hasOverride && <button type="button" onClick={() => clearOverride(key)} className="mt-3 text-xs font-bold text-blue-700">Reset to role default</button>}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <Preference label="Email notifications enabled" description="Master preference for this user." checked={email.enabled} onChange={(value) => setEmail((current) => ({ ...current, enabled: value }))} />
                  <Preference label="Ticket assignment emails" checked={email.assignment} disabled={!email.enabled} onChange={(value) => setEmail((current) => ({ ...current, assignment: value }))} />
                  <Preference label="Ticket update emails" checked={email.ticket_update} disabled={!email.enabled} onChange={(value) => setEmail((current) => ({ ...current, ticket_update: value }))} />
                  <Preference label="Reminder emails" checked={email.reminder} disabled={!email.enabled} onChange={(value) => setEmail((current) => ({ ...current, reminder: value }))} />
                  <Preference label="Escalation emails" checked={email.escalation} disabled={!email.enabled} onChange={(value) => setEmail((current) => ({ ...current, escalation: value }))} />
                  <Preference label="Administrative emails" checked={email.administrative} disabled={!email.enabled} onChange={(value) => setEmail((current) => ({ ...current, administrative: value }))} />
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t pt-5">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border px-5 py-3 text-sm font-bold">Cancel</button>
            <button type="button" onClick={save} disabled={busy || loading} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving..." : "Save Controls"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Preference({ label, description, checked, disabled, onChange }) {
  return <label className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${disabled ? "opacity-50" : ""}`}><span><span className="block font-semibold">{label}</span>{description && <span className="mt-1 block text-xs text-slate-500">{description}</span>}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>;
}
