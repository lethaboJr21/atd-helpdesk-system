import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit3,
  Save,
  UserCheck,
  XCircle,
} from "lucide-react";

import { groupsApi, ticketsApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const OPERATIONS_ROLES = new Set(["agent", "operator", "manager", "admin", "superadmin"]);
const STATUS_OPTIONS = ["Open", "Assigned", "Pending", "Investigating", "Waiting Approval", "Resolved", "Closed", "Escalated"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const WORKSPACE_OPTIONS = ["IT", "IT Service Request", "Change Management", "ERP / Syspro", "Infrastructure", "Applications", "Access & Security"];

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}
function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString("en-ZA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function priorityClass(value) {
  return ({ Critical: "bg-red-100 text-red-700 border-red-200", High: "bg-orange-100 text-orange-700 border-orange-200", Medium: "bg-amber-100 text-amber-700 border-amber-200", Low: "bg-emerald-100 text-emerald-700 border-emerald-200" })[value] || "bg-slate-100 text-slate-700";
}
function statusClass(value) {
  return ({ Open: "bg-blue-100 text-blue-700", Assigned: "bg-slate-100 text-slate-700", Pending: "bg-purple-100 text-purple-700", Investigating: "bg-indigo-100 text-indigo-700", "Waiting Approval": "bg-purple-100 text-purple-700", Resolved: "bg-emerald-100 text-emerald-700", Closed: "bg-slate-200 text-slate-700", Escalated: "bg-red-100 text-red-700" })[value] || "bg-slate-100 text-slate-700";
}

function tryParseJson(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

function formatAssignmentSnapshot(value) {
  const parsed = tryParseJson(value);
  if (!parsed || typeof parsed !== "object") return value || "Unassigned";
  const agent = parsed.assigned_to_user_id ? `User #${parsed.assigned_to_user_id}` : "Unassigned";
  const group = parsed.assigned_group_id ? `Group #${parsed.assigned_group_id}` : "No group";
  return `${agent} · ${group}`;
}

function formatHistoryValue(value, action) {
  if (value == null || value === "") return null;
  if (action === "assigned") return formatAssignmentSnapshot(value);
  const parsed = tryParseJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if ("status" in parsed && Object.keys(parsed).length <= 4) return parsed.status || null;
    return null;
  }
  return String(value);
}

function describeHistoryEntry(entry) {
  const actor = entry.actor_name || entry.actor_email || "System";
  const action = String(entry.action || "").toLowerCase();
  const from = formatHistoryValue(entry.old_value, action);
  const to = formatHistoryValue(entry.new_value, action);

  if (action === "created") {
    return { title: "Ticket created", detail: to ? `Opened as ${to}` : "Ticket was created.", actor };
  }
  if (action === "assigned") {
    if (from && to) return { title: "Reassigned", detail: `${from} → ${to}`, actor };
    if (to) return { title: "Assigned", detail: `Assigned to ${to}`, actor };
    return { title: "Assignment updated", detail: "Assignment changed.", actor };
  }
  if (action === "status_changed" || action === "status") {
    if (from && to) return { title: "Status changed", detail: `${from} → ${to}`, actor };
    return { title: "Status changed", detail: to || "Status updated.", actor };
  }
  if (action === "priority_changed") {
    if (from && to) return { title: "Priority changed", detail: `${from} → ${to}`, actor };
    return { title: "Priority changed", detail: to || "Priority updated.", actor };
  }
  if (action === "resolve" || action === "resolved") {
    return { title: "Resolved", detail: from && to ? `${from} → ${to}` : "Ticket marked resolved.", actor };
  }
  if (action === "closed" || action === "close") {
    return { title: "Closed", detail: from && to ? `${from} → ${to}` : "Ticket closed.", actor };
  }
  if (action === "updated") {
    const fields = entry.new_value && !tryParseJson(entry.new_value) ? entry.new_value : null;
    if (fields) return { title: "Ticket updated", detail: `Updated ${fields}.`, actor };
    const before = tryParseJson(entry.old_value);
    const after = tryParseJson(entry.new_value);
    if (before && after) {
      const changes = ["status", "priority", "workspace", "title", "assigned_to_user_id", "assigned_group_id"]
        .filter((key) => String(before[key] ?? "") !== String(after[key] ?? ""))
        .map((key) => key.replaceAll("_", " "));
      if (changes.length) return { title: "Ticket updated", detail: `Updated ${changes.join(", ")}.`, actor };
    }
    return { title: "Ticket updated", detail: "Ticket details were updated.", actor };
  }
  return {
    title: action.replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase()) || "Activity",
    detail: from && to ? `${from} → ${to}` : (to || from || "Change recorded."),
    actor,
  };
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, employeeView } = useAuth();
  const operationsUser = OPERATIONS_ROLES.has(user?.role) && !employeeView;

  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [edit, setEdit] = useState({ title: "", description: "", priority: "Medium", status: "Open", workspace: "IT", assignedGroupId: "", assignedToUserId: "", dueAt: "" });

  const fetchTicket = async () => {
    setLoading(true); setError("");
    try {
      const [ticketResponse, historyResponse] = await Promise.all([
        ticketsApi.getById(id),
        ticketsApi.getHistory(id).catch(() => ({ data: [] })),
      ]);
      setTicket(ticketResponse.data);
      setHistory(Array.isArray(historyResponse.data) ? historyResponse.data : []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Ticket could not be loaded."));
      setTicket(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTicket(); }, [id]);
  useEffect(() => {
    if (!operationsUser) return;
    groupsApi.getAll().then((response) => setGroups(Array.isArray(response.data) ? response.data : [])).catch(() => setGroups([]));
  }, [operationsUser]);

  const selectedGroup = groups.find((group) => String(group.id) === String(edit.assignedGroupId));
  const assignmentText = useMemo(() => ticket?.assigned_to_name || (ticket?.assigned_to_user_id ? `User #${ticket.assigned_to_user_id}` : "Unassigned"), [ticket]);
  const timeline = useMemo(() => history.map((entry) => ({ ...entry, ...describeHistoryEntry(entry) })), [history]);

  const startEdit = () => {
    setEdit({
      title: ticket.title || "",
      description: ticket.description || "",
      priority: ticket.priority || "Medium",
      status: ticket.status || "Open",
      workspace: ticket.workspace || "IT",
      assignedGroupId: ticket.assigned_group_id || "",
      assignedToUserId: ticket.assigned_to_user_id || "",
      dueAt: ticket.due_at ? String(ticket.due_at).slice(0, 16) : "",
    });
    setEditMode(true); setError(""); setSuccess("");
  };

  const runAction = async (action, message) => {
    setActionLoading(true); setError(""); setSuccess("");
    try { await action(); setSuccess(message); await fetchTicket(); }
    catch (requestError) { setError(getErrorMessage(requestError, "The ticket action failed.")); }
    finally { setActionLoading(false); }
  };

  const save = () => runAction(
    () => ticketsApi.update(ticket.id, {
      title: edit.title.trim(),
      description: edit.description.trim(),
      priority: edit.priority,
      status: edit.status,
      workspace: edit.workspace,
      assignedGroupId: edit.assignedGroupId || null,
      assignedToUserId: edit.assignedToUserId || null,
      dueAt: edit.dueAt || null,
    }),
    "Ticket updated successfully."
  ).then(() => setEditMode(false));

  if (loading) return <div className="min-h-screen bg-slate-100 p-8 text-slate-500">Loading ticket...</div>;

  if (!ticket) return <div className="min-h-screen bg-slate-100 p-8"><button onClick={() => navigate("/tickets")} className="mb-4 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" />Back to Tickets</button><div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error || "Ticket not found."}</div></div>;

  return (
    <div className="min-h-screen bg-slate-100 p-5 text-slate-900 xl:p-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4">
        <div><button onClick={() => navigate("/tickets")} className="mb-3 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" />Back to Tickets</button><p className="text-sm font-bold text-blue-700">{ticket.ticket_ref || `TICKET-${ticket.id}`}</p><h1 className="mt-1 text-3xl font-bold">{ticket.title}</h1><p className="mt-1 text-sm text-slate-500">Created {formatDateTime(ticket.created_at)} · Updated {formatDateTime(ticket.updated_at)}</p></div>
        <div className="flex gap-2"><span className={`rounded-full border px-3 py-2 text-xs font-bold ${priorityClass(ticket.priority)}`}>{ticket.priority}</span><span className={`rounded-full px-3 py-2 text-xs font-bold ${statusClass(ticket.status)}`}>{ticket.status}</span></div>
      </header>

      <main className="mx-auto mt-6 max-w-7xl">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{success}</div>}

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Ticket Details</h2><p className="text-sm text-slate-500">Full request and operational information.</p></div>{operationsUser && !editMode && <button onClick={startEdit} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Edit3 className="h-4 w-4" />Edit Ticket</button>}{operationsUser && editMode && <div className="flex gap-2"><button onClick={save} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Save className="h-4 w-4" />Save</button><button onClick={() => setEditMode(false)} className="rounded-xl border px-4 py-3 text-sm font-bold">Cancel</button></div>}</div>

              {!editMode ? <><div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.description || "No description provided."}</p></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Info label="Workspace" value={ticket.workspace} /><Info label="Status" value={ticket.status} /><Info label="Support Group" value={ticket.assigned_group_name || "Triage"} /><Info label="Assigned To" value={assignmentText} /><Info label="Requester" value={ticket.requester_name || ticket.requester_email} /><Info label="Due Date" value={formatDateTime(ticket.due_at)} /></div></> : <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Title"><input value={edit.title} onChange={(event) => setEdit((current) => ({ ...current, title: event.target.value }))} className="input" /></Field><Field label="Priority"><select value={edit.priority} onChange={(event) => setEdit((current) => ({ ...current, priority: event.target.value }))} className="input">{PRIORITY_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Status"><select value={edit.status} onChange={(event) => setEdit((current) => ({ ...current, status: event.target.value }))} className="input">{STATUS_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Workspace"><select value={edit.workspace} onChange={(event) => setEdit((current) => ({ ...current, workspace: event.target.value }))} className="input">{WORKSPACE_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Support Group"><select value={edit.assignedGroupId} onChange={(event) => setEdit((current) => ({ ...current, assignedGroupId: event.target.value, assignedToUserId: "" }))} className="input"><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field><Field label="Assignee"><select value={edit.assignedToUserId} disabled={!edit.assignedGroupId} onChange={(event) => setEdit((current) => ({ ...current, assignedToUserId: event.target.value }))} className="input disabled:bg-slate-100"><option value="">Unassigned</option>{(selectedGroup?.members || []).map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></Field><Field label="Due Date"><input type="datetime-local" value={edit.dueAt} onChange={(event) => setEdit((current) => ({ ...current, dueAt: event.target.value }))} className="input" /></Field><div className="md:col-span-2"><Field label="Description"><textarea rows="10" value={edit.description} onChange={(event) => setEdit((current) => ({ ...current, description: event.target.value }))} className="input" /></Field></div></div>}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Activity</h2>
              <p className="mt-1 text-sm text-slate-500">Audit trail of assignments, status changes, and updates.</p>
              {timeline.length === 0 ? (
                <div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                  No activity recorded yet. Reassignments and status changes will appear here.
                </div>
              ) : (
                <ol className="mt-4 space-y-0">
                  {timeline.map((entry, index) => (
                    <li key={entry.id || `${entry.created_at}-${index}`} className="relative flex gap-4 pb-5 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-4 ring-blue-50" />
                        {index < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">{entry.title}</p>
                          <p className="text-xs font-semibold text-slate-500">{formatDateTime(entry.created_at)}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{entry.detail}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By {entry.actor}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            {operationsUser && <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Actions</h2><div className="mt-4 grid gap-3"><button onClick={() => runAction(() => ticketsApi.assign(ticket.id, user.id, ticket.assigned_group_id || null), "Ticket assigned to you.")} disabled={actionLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><UserCheck className="h-4 w-4" />Assign to Me</button><button onClick={() => runAction(() => ticketsApi.resolve(ticket.id), "Ticket resolved.")} disabled={actionLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"><CheckCircle2 className="h-4 w-4" />Resolve</button><button onClick={() => runAction(() => ticketsApi.close(ticket.id), "Ticket closed.")} disabled={actionLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><XCircle className="h-4 w-4" />Close</button></div></div>}
            <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">SLA and Timing</h2><div className="mt-4 space-y-3"><Info label="Created" value={formatDateTime(ticket.created_at)} /><Info label="Updated" value={formatDateTime(ticket.updated_at)} /><Info label="Deadline" value={formatDateTime(ticket.due_at)} /><Info label="Age" value={ticket.age} /></div></div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">People</h2><div className="mt-4 space-y-3"><Info label="Requester" value={ticket.requester_name || ticket.requester_email} /><Info label="Created By" value={ticket.created_by_name || ticket.created_by_email} /><Info label="Assigned To" value={assignmentText} /><Info label="Group" value={ticket.assigned_group_name || "Triage"} /></div></div>
            {ticket.priority === "Critical" && <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />Critical ticket requiring priority investigation and escalation.</div>}
            {!ticket.assigned_to_user_id && <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700"><Clock className="h-4 w-4 shrink-0" />No individual agent is assigned yet.</div>}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }) { return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><div className="mt-2">{children}</div></label>; }
function Info({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "N/A"}</p></div>; }
