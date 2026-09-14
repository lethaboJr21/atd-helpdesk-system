import { useMemo, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

const ROLE_LABELS = {
  user: "Employee",
  agent: "Agent",
  operator: "Operator",
  manager: "Manager",
  admin: "Administrator",
  superadmin: "Superadministrator",
};

const ROLE_DESCRIPTIONS = {
  user: "Employee self-service access.",
  agent: "Ticket handling and assigned support work.",
  operator: "Explicit operational workflows without full administration.",
  manager: "Department and support oversight within governed scope.",
  admin: "User, group and system administration without automatic confidential ticket access.",
  superadmin: "Protected global platform governance and emergency authority.",
};

export default function BulkUserRoleDialog({ open, count, allowedRoles, busy, onClose, onConfirm }) {
  const [role, setRole] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const validation = useMemo(() => {
    if (!role) return "Select a role.";
    if (reason.trim().length < 5) return "Provide a change reason of at least 5 characters.";
    if (!acknowledged) return "Confirm that the access impact was reviewed.";
    return "";
  }, [role, reason, acknowledged]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bulk-role-title">
      <section className="portal-surface-raised w-full max-w-xl rounded-2xl border p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[var(--portal-primary)]">Governed account change</p>
            <h2 id="bulk-role-title" className="portal-title mt-1 text-xl font-black">Change role for {count} account{count === 1 ? "" : "s"}</h2>
            <p className="portal-muted mt-1 text-sm">Only authorised roles are available. Protected accounts and self-access remain enforced by the server.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="portal-control rounded-xl border p-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <label className="mt-5 block text-sm font-bold">New portal role
          <select className="input mt-2" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Select a role</option>
            {allowedRoles.map((item) => <option key={item} value={item}>{ROLE_LABELS[item] || item}</option>)}
          </select>
        </label>
        {role ? <div className="mt-3 rounded-xl border border-[var(--portal-selected-border)] bg-[var(--portal-selected-bg)] p-4 text-sm">
          <p className="font-bold">{ROLE_LABELS[role]}</p><p className="portal-copy mt-1">{ROLE_DESCRIPTIONS[role]}</p>
          {role === "superadmin" ? <p className="mt-2 font-bold text-red-700">Protected full-platform authority. Only a Superadministrator may assign this role.</p> : null}
        </div> : null}
        <label className="mt-4 block text-sm font-bold">Change reason
          <textarea className="input mt-2" rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for the administration audit trail" />
        </label>
        <label className="mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" />
          <span><strong>Access impact reviewed.</strong><span className="portal-muted mt-1 block">Role defaults may change dashboards, navigation and available administrative functions.</span></span>
        </label>
        {validation ? <p className="mt-3 text-sm font-semibold text-amber-700">{validation}</p> : null}
        <footer className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="portal-control rounded-xl border px-4 py-2 font-bold">Cancel</button>
          <button type="button" disabled={busy || Boolean(validation)} onClick={() => onConfirm(role, reason.trim())} className="portal-accent-fill rounded-xl bg-[var(--portal-primary)] px-4 py-2 font-bold text-white disabled:opacity-40"><ShieldCheck className="mr-2 inline h-4 w-4" />{busy ? "Applying..." : "Confirm role change"}</button>
        </footer>
      </section>
    </div>
  );
}
