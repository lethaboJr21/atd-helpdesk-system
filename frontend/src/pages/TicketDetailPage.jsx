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


const STATUS_OPTIONS = [
  "Open",
  "Assigned",
  "Pending",
  "Investigating",
  "Waiting Approval",
  "Resolved",
  "Closed",
  "Escalated",
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];

const WORKSPACE_OPTIONS = [
  "IT",
  "ERP / Syspro",
  "Infrastructure",
  "Applications",
  "Access & Security",
];

function priorityClass(priority) {
  return {
    Critical: "bg-red-100 text-red-700 border-red-200",
    High: "bg-orange-100 text-orange-700 border-orange-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  }[priority || "Medium"];
}


function statusClass(status) {
  return {
    Open: "bg-blue-100 text-blue-700",
    Assigned: "bg-slate-100 text-slate-700",
    Pending: "bg-purple-100 text-purple-700",
    Investigating: "bg-indigo-100 text-indigo-700",
    "Waiting Approval": "bg-purple-100 text-purple-700",
    Resolved: "bg-emerald-100 text-emerald-700",
    Closed: "bg-slate-200 text-slate-700",
    Escalated: "bg-red-100 text-red-700",
  }[status || "Open"];
}

function formatDateTime(value) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [groups, setGroups] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  
  const [quickAssignUserId, setQuickAssignUserId] = useState("");
  const [quickAssignGroupId, setQuickAssignGroupId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editTicket, setEditTicket] = useState({
    title: "",
    description: "",
    priority: "Medium",
    status: "Open",
    workspace: "IT",
    assignedGroupId: "",
    assignedToUserId: "",
    dueAt: "",
  });

  const selectedEditGroup = groups.find(
    (group) => String(group.id) === String(editTicket.assignedGroupId)
  );

  const editGroupMembers = selectedEditGroup?.members || [];

  const ticketGroupId =
  ticket?.assigned_group_id ||
  ticket?.assignedGroupId ||
  "";

const activeQuickGroupId = quickAssignGroupId || ticketGroupId;

const quickAssignGroup = groups.find(
  (group) => String(group.id) === String(activeQuickGroupId)
);

const quickAssignMembers = quickAssignGroup?.members || [];


  const fetchTicket = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await ticketsApi.getById(id);
      setTicket(res.data);
    } catch (err) {
      console.error("Failed to fetch ticket:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch ticket."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await groupsApi.getAll();
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  };

  useEffect(() => {
    fetchTicket();
    fetchGroups();
  }, [id]);

  const startEdit = () => {
    if (!ticket) return;

    setError("");
    setSuccess("");

    setEditTicket({
      title: ticket.title || "",
      description: ticket.description || "",
      priority: ticket.priority || "Medium",
      status: ticket.status || "Open",
      workspace: ticket.workspace || "IT",
      assignedGroupId: ticket.assigned_group_id || "",
      assignedToUserId: ticket.assigned_to_user_id || "",
      dueAt: ticket.due_at ? String(ticket.due_at).slice(0, 16) : "",
    });

    setEditMode(true);
  };

  const handleSave = async () => {
    if (!ticket?.id) return;

    if (!editTicket.title.trim()) {
      setError("Ticket title is required.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await ticketsApi.update(ticket.id, {
        title: editTicket.title.trim(),
        description: editTicket.description.trim(),
        priority: editTicket.priority,
        status: editTicket.status,
        workspace: editTicket.workspace,
        assignedGroupId: editTicket.assignedGroupId || null,
        assignedToUserId: editTicket.assignedToUserId || null,
        dueAt: editTicket.dueAt || null,
      });

      setSuccess("Ticket updated successfully.");
      setEditMode(false);
      await fetchTicket();
    
    } catch (err) {
      console.error("Failed to update ticket:", err);
    
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update ticket. Please check if the backend is running."
      );
    } finally {
      setActionLoading(false);
    }
    
  };

  const handleQuickAssign = async () => {
  if (!ticket?.id) return;

  if (!activeQuickGroupId && !quickAssignUserId) {
    setError("Please select a group or assignee first.");
    return;
  }

  setActionLoading(true);
  setError("");
  setSuccess("");

  try {
    await ticketsApi.assign(ticket.id, quickAssignUserId || null, activeQuickGroupId || null);

    setSuccess("Ticket assignment updated.");
    setQuickAssignUserId("");
    await fetchTicket();
  } catch (err) {
    console.error("Quick assign failed:", err);
    setError(
      err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to assign ticket."
    );
  } finally {
    setActionLoading(false);
  }
};

  const handleAssignToMe = async () => {
    if (!ticket?.id) return;

    const userId = user?.id || user?.user_id;

    if (!userId) {
      setError("Current user ID not found. Cannot assign ticket.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await ticketsApi.assign(ticket.id, userId);
      setSuccess("Ticket assigned to you.");
      await fetchTicket();
    } catch (err) {
      console.error("Assign to me failed:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to assign ticket."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!ticket?.id) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await ticketsApi.resolve(ticket.id);
      setSuccess("Ticket resolved.");
      await fetchTicket();
    } catch (err) {
      console.error("Resolve failed:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to resolve ticket."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!ticket?.id) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await ticketsApi.close(ticket.id);
      setSuccess("Ticket closed.");
      await fetchTicket();
    } catch (err) {
      console.error("Close failed:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to close ticket."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const assignmentText = useMemo(() => {
    if (!ticket) return "N/A";

    return (
      ticket.assigned_to_name ||
      (ticket.assigned_to_user_id
        ? `User #${ticket.assigned_to_user_id}`
        : "Unassigned")
    );
  }, [ticket]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <p className="text-sm text-slate-500">Loading ticket...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <button
          onClick={() => navigate("/tickets")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </button>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          Ticket not found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            onClick={() => navigate("/tickets")}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </button>

          <p className="text-sm font-bold text-blue-700">
            {ticket.ticket_ref || `TICKET-${ticket.id}`}
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {ticket.title}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Created {formatDateTime(ticket.created_at)} â€¢ Updated{" "}
            {formatDateTime(ticket.updated_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <span
            className={`rounded-full border px-3 py-2 text-xs font-bold ${priorityClass(
              ticket.priority
            )}`}
          >
            {ticket.priority || "Medium"}
          </span>

          <span
            className={`rounded-full px-3 py-2 text-xs font-bold ${statusClass(
              ticket.status
            )}`}
          >
            {ticket.status || "Open"}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Ticket Details
                </h2>
                <p className="text-sm text-slate-500">
                  View and manage the full ticket record.
                </p>
              </div>

              {!editMode ? (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Ticket
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {actionLoading ? "Saving..." : "Save"}
                  </button>

                  <button
                    onClick={() => setEditMode(false)}
                    disabled={actionLoading}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {!editMode ? (
              <div className="mt-5 space-y-4">
                <InfoBlock label="Description">
                  {ticket.description || "No description provided."}
                </InfoBlock>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoBox label="Workspace" value={ticket.workspace} />
                  <InfoBox label="Status" value={ticket.status} />
                  <InfoBox
                    label="Support Group"
                    value={ticket.assigned_group_name || "No group"}
                  />
                  <InfoBox label="Assigned To" value={assignmentText} />
                  <InfoBox
                    label="Requester"
                    value={
                      ticket.requester_name ||
                      ticket.requester_email ||
                      `Requester #${ticket.requester_id || "N/A"}`
                    }
                  />
                  <InfoBox
                    label="Due Date"
                    value={formatDateTime(ticket.due_at)}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input
                    value={editTicket.title}
                    onChange={(event) =>
                      setEditTicket((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </Field>

                <Field label="Priority">
                  <select
                    value={editTicket.priority}
                    onChange={(event) =>
                      setEditTicket((prev) => ({
                        ...prev,
                        priority: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={editTicket.status}
                    onChange={(event) =>
                      setEditTicket((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Workspace">
                  <select
                    value={editTicket.workspace}
                    onChange={(event) =>
                      setEditTicket((prev) => ({
                        ...prev,
                        workspace: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {WORKSPACE_OPTIONS.map((workspace) => (
                      <option key={workspace}>{workspace}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Support Group">
                  <select
                    value={editTicket.assignedGroupId}
                    onChange={(event) =>
                      setEditTicket((prev) => ({
                        ...prev,
                        assignedGroupId: event.target.value,
                        assignedToUserId: "",
                      }))
                    }
                    className="input"
                  >
                    <option value="">No group</option>

                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Assignee">
                  <select
                    value={editTicket.assignedToUserId}
                    disabled={!editTicket.assignedGroupId}
                    onChange={(event) =>
                      setEditTicket((prev) => ({
                        ...prev,
                        assignedToUserId: event.target.value,
                      }))
                    }
                    className="input disabled:bg-slate-100"
                  >
                    <option value="">Unassigned</option>

                    {editGroupMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name || member.email} â€” {member.email}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Due Date / Deadline">
                  <input
                    type="datetime-local"
                    value={editTicket.dueAt}
                    onChange={(event) =>
                      setEditTicket((prev) => ({
                        ...prev,
                        dueAt: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Description">
                    <textarea
                      rows="5"
                      value={editTicket.description}
                      onChange={(event) =>
                        setEditTicket((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      className="input"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Comments, audit history, attachments, approvals and SLA events
              will appear here once we connect ticket history/comments to this
              page.
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              Next upgrade: add ticket comments, history timeline and file
              attachments.
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Actions</h2>
            
            
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assign Group
              </label>

              <select
                value={activeQuickGroupId}
                onChange={(event) => {
                  setQuickAssignGroupId(event.target.value);
                  setQuickAssignUserId("");
                }}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select group</option>
            
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assign Agent
              </label>
            
              <select
                value={quickAssignUserId}
                disabled={!activeQuickGroupId}
                onChange={(event) => setQuickAssignUserId(event.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">Select agent</option>
            
                {quickAssignMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email} â€” {member.email}
                  </option>
                ))}
              </select>
            
              <button
                onClick={handleQuickAssign}
                disabled={actionLoading || (!activeQuickGroupId && !quickAssignUserId)}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Assign Selected
              </button>
            </div>
            
            <div className="mt-4 grid gap-3">
              <button
                onClick={handleAssignToMe}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                Assign to Me
              </button>

              <button
                onClick={handleResolve}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Resolve
              </button>

              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Close
              </button>
            </div>
          </div>

          {ticket.priority === "Critical" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Critical ticket. Prioritize investigation and escalation.
              </div>
            </div>
          )}

          {!ticket.assigned_to_name && !ticket.assigned_to_user_id && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
              <div className="flex gap-2">
                <Clock className="h-4 w-4 flex-shrink-0" />
                This ticket is currently unassigned.
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">SLA</h2>

            <div className="mt-4 space-y-3 text-sm">
              <InfoBox
                label="Created"
                value={formatDateTime(ticket.created_at)}
              />

              <InfoBox
                label="Updated"
                value={formatDateTime(ticket.updated_at)}
              />

              <InfoBox
                label="Deadline"
                value={formatDateTime(ticket.due_at)}
              />

              <InfoBox label="Age" value={ticket.age || "N/A"} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">People</h2>

            <div className="mt-4 space-y-3 text-sm">
              <InfoBox
                label="Requester"
                value={
                  ticket.requester_name ||
                  ticket.requester_email ||
                  `Requester #${ticket.requester_id || "N/A"}`
                }
              />

              <InfoBox label="Assigned To" value={assignmentText} />

              <InfoBox
                label="Group"
                value={ticket.assigned_group_name || "No group"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-900">{value || "N/A"}</p>
    </div>
  );
}

function InfoBlock({ label, children }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
        {children}
      </p>
    </div>
  );
}

