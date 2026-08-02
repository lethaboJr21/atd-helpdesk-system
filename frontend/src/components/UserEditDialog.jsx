import { useMemo, useState } from "react";
import { ShieldCheck, UserCog, X } from "lucide-react";
import { userApi } from "../services/api";

const ROLE_DESCRIPTIONS = {
  user: "Employee self-service access.",
  agent: "Ticket handling and assigned support work.",
  operator: "Operational ticket and production workflows.",
  manager: "Operational oversight and approved administrative views.",
  admin: "User, role, group and system administration.",
  superadmin: "Protected full platform administration.",
};

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.message || "The account could not be updated.";
}

export default function UserEditDialog({ account, roles, departments, onClose, onSaved }) {
  const initialSection = account.initialSection || "profile";
  const [section, setSection] = useState(initialSection === "approve" ? "role" : initialSection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: account.name || "",
    email: account.email || "",
    firstName: account.first_name || "",
    lastName: account.last_name || "",
    employeeNumber: account.employee_number || "",
    jobTitle: account.job_title || "",
    department: account.department || "",
    managerName: account.manager_name || "",
    officeLocation: account.office_location || "",
    site: account.site || "",
    mobilePhone: account.mobile_phone || "",
    businessPhone: account.business_phone || "",
    alternativeEmail: account.alternative_email || "",
    employmentStatus: account.employment_status || "active",
    startDate: account.start_date ? String(account.start_date).slice(0, 10) : "",
    terminationDate: account.termination_date ? String(account.termination_date).slice(0, 10) : "",
    accountType: account.account_type || "person",
    role: account.role === "pending" ? "user" : account.role,
  });

  const approving = !account.approved || account.role === "pending" || account.initialSection === "approve";
  const roleDescription = useMemo(() => ROLE_DESCRIPTIONS[form.role] || "", [form.role]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveProfile = async () => {
    await userApi.updateProfile(account.id, form);
    onSaved("User profile updated successfully.");
  };

  const saveRole = async () => {
    if (!roles.includes(form.role)) throw new Error("The selected role is not authorised for this administrator.");
    if (approving) await userApi.approveUser(account.id, form.role);
    else await userApi.updateUserRole(account.id, form.role);
    onSaved(approving ? "Account approved with the selected role." : "User role updated successfully.");
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (section === "profile") await saveProfile();
      else await saveRole();
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
          <div><p className="text-sm font-bold text-blue-700">User Administration</p><h2 className="mt-1 text-2xl font-bold">{account.name || account.email}</h2><p className="mt-1 text-sm text-slate-500">Edit identity information or assign a portal role.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border p-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex gap-2 border-b p-4">
          <button type="button" onClick={() => setSection("profile")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${section === "profile" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}><UserCog className="h-4 w-4" />Profile</button>
          <button type="button" onClick={() => setSection("role")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${section === "role" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}><ShieldCheck className="h-4 w-4" />Role</button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

          {section === "profile" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Display name"><input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
              <Field label="Email"><input type="email" className="input" value={form.email} onChange={(e) => update("email", e.target.value)} required /></Field>
              <Field label="First name"><input className="input" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></Field>
              <Field label="Last name"><input className="input" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></Field>
              <Field label="Employee number"><input className="input" value={form.employeeNumber} onChange={(e) => update("employeeNumber", e.target.value)} /></Field>
              <Field label="Job title"><input className="input" value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} /></Field>
              <Field label="Department"><input list="department-options" className="input" value={form.department} onChange={(e) => update("department", e.target.value)} /><datalist id="department-options">{departments.map((value) => <option key={value} value={value} />)}</datalist></Field>
              <Field label="Manager"><input className="input" value={form.managerName} onChange={(e) => update("managerName", e.target.value)} /></Field>
              <Field label="Office location"><input className="input" value={form.officeLocation} onChange={(e) => update("officeLocation", e.target.value)} /></Field>
              <Field label="Site"><input className="input" value={form.site} onChange={(e) => update("site", e.target.value)} /></Field>
              <Field label="Employment status"><select className="input" value={form.employmentStatus} onChange={(e) => update("employmentStatus", e.target.value)}><option value="active">Active</option><option value="contractor">Contractor</option><option value="transferred">Transferred</option><option value="suspended">Suspended</option><option value="resigned">Resigned</option></select></Field>
              <Field label="Account type"><select className="input" value={form.accountType} onChange={(e) => update("accountType", e.target.value)}><option value="person">Person</option><option value="shared">Shared</option><option value="service">Service</option><option value="department">Department</option><option value="automation">Automation</option><option value="generic">Generic</option></select></Field>
            </div>
          ) : (
            <div className="mx-auto max-w-xl">
              <Field label={approving ? "Approval role" : "Portal role"}>
                <select className="input" value={form.role} onChange={(e) => update("role", e.target.value)} disabled={!roles.length}>
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </Field>
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{roleDescription}</div>
              {form.role === "superadmin" && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Superadministrator is a protected role with full platform authority.</div>}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t pt-5">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border px-5 py-3 text-sm font-bold">Cancel</button>
            <button type="submit" disabled={busy || (section === "role" && !roles.length)} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving..." : approving && section === "role" ? "Approve Account" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><div className="mt-2">{children}</div></label>;
}
