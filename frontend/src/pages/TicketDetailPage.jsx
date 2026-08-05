import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileText,
  MessageSquare,
  Paperclip,
  Save,
  Send,
  UploadCloud,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";

import OperationsShell from "../components/OperationsShell";
import { groupsApi, ticketsApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const BRAND = "#172b57";
const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);
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
  "IT Service Request",
  "Change Management",
  "ERP / Syspro",
  "Infrastructure",
  "Applications",
  "Access & Security",
];
const ALLOWED_ATTACH = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "N/A"
    : date.toLocaleString("en-ZA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function priorityClass(value) {
  return (
    {
      Critical: "bg-red-100 text-red-700 border-red-200",
      High: "bg-orange-100 text-orange-700 border-orange-200",
      Medium: "bg-amber-100 text-amber-700 border-amber-200",
      Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    }[value] || "bg-slate-100 text-slate-700 border-slate-200"
  );
}

function statusClass(value) {
  return (
    {
      Open: "bg-sky-100 text-sky-800",
      Assigned: "bg-slate-100 text-slate-700",
      Pending: "bg-amber-100 text-amber-800",
      Investigating: "bg-[#172b57]/10 text-[#172b57]",
      "Waiting Approval": "bg-amber-100 text-amber-900",
      Resolved: "bg-emerald-100 text-emerald-700",
      Closed: "bg-slate-200 text-slate-700",
      Escalated: "bg-red-100 text-red-700",
    }[value] || "bg-slate-100 text-slate-700"
  );
}

function tryParseJson(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function formatAssignmentSnapshot(value) {
  const parsed = tryParseJson(value);
  if (!parsed || typeof parsed !== "object") return value || "Unassigned";
  const agent = parsed.assigned_to_user_id
    ? `User #${parsed.assigned_to_user_id}`
    : "Unassigned";
  const group = parsed.assigned_group_id
    ? `Group #${parsed.assigned_group_id}`
    : "No group";
  return `${agent} · ${group}`;
}

function formatHistoryValue(value, action) {
  if (value == null || value === "") return null;
  if (action === "assigned") return formatAssignmentSnapshot(value);
  const parsed = tryParseJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if ("status" in parsed && Object.keys(parsed).length <= 4)
      return parsed.status || null;
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
    return {
      title: "Ticket created",
      detail: to ? `Opened as ${to}` : "Ticket was created.",
      actor,
    };
  }
  if (action === "assigned") {
    if (from && to) return { title: "Reassigned", detail: `${from} → ${to}`, actor };
    if (to) return { title: "Assigned", detail: `Assigned to ${to}`, actor };
    return { title: "Assignment updated", detail: "Assignment changed.", actor };
  }
  if (action === "status_changed" || action === "status") {
    if (from && to)
      return { title: "Status changed", detail: `${from} → ${to}`, actor };
    return { title: "Status changed", detail: to || "Status updated.", actor };
  }
  if (action === "priority_changed") {
    if (from && to)
      return { title: "Priority changed", detail: `${from} → ${to}`, actor };
    return {
      title: "Priority changed",
      detail: to || "Priority updated.",
      actor,
    };
  }
  if (action === "resolve" || action === "resolved") {
    return {
      title: "Resolved",
      detail: from && to ? `${from} → ${to}` : "Ticket marked resolved.",
      actor,
    };
  }
  if (action === "closed" || action === "close") {
    return {
      title: "Closed",
      detail: from && to ? `${from} → ${to}` : "Ticket closed.",
      actor,
    };
  }
  if (action === "comment_added") {
    return {
      title: "Reply posted",
      detail: to || "A message was added to the conversation.",
      actor,
    };
  }
  if (action === "internal_note") {
    return {
      title: "Internal note",
      detail: to || "An internal note was added.",
      actor,
    };
  }
  if (action === "updated") {
    const fields =
      entry.new_value && !tryParseJson(entry.new_value)
        ? entry.new_value
        : null;
    if (fields)
      return { title: "Ticket updated", detail: `Updated ${fields}.`, actor };
    const before = tryParseJson(entry.old_value);
    const after = tryParseJson(entry.new_value);
    if (before && after) {
      const changes = [
        "status",
        "priority",
        "workspace",
        "title",
        "assigned_to_user_id",
        "assigned_group_id",
      ]
        .filter(
          (key) => String(before[key] ?? "") !== String(after[key] ?? "")
        )
        .map((key) => key.replaceAll("_", " "));
      if (changes.length)
        return {
          title: "Ticket updated",
          detail: `Updated ${changes.join(", ")}.`,
          actor,
        };
    }
    return {
      title: "Ticket updated",
      detail: "Ticket details were updated.",
      actor,
    };
  }
  if (action === "attachment_added") {
    return { title: "Attachment added", detail: to || "Files uploaded.", actor };
  }
  if (action === "approval_required") {
    return {
      title: "Approval required",
      detail: to
        ? `${to} change awaiting CAB / change-manager approval.`
        : "Change awaiting approval.",
      actor,
    };
  }
  return {
    title:
      action.replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase()) ||
      "Activity",
    detail: from && to ? `${from} → ${to}` : to || from || "Change recorded.",
    actor,
  };
}

function moduleMeta(ticket, details) {
  const type = String(ticket?.ticket_type || details?.module || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (type.includes("change") || details?.module === "change") {
    return { label: "Change", crumb: "Changes" };
  }
  if (type.includes("asset") || details?.module === "asset") {
    return { label: "Asset Request", crumb: "Asset Requests" };
  }
  if (
    type.includes("service") ||
    type === "request" ||
    details?.module === "service"
  ) {
    return { label: "Service Request", crumb: "Service Requests" };
  }
  return { label: "Incident", crumb: "Incidents" };
}

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const cardClass =
  "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-soft";
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#172b57]/40 focus:ring-2 focus:ring-[#172b57]/15";

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, employeeView } = useAuth();
  const operationsUser = OPERATIONS_ROLES.has(user?.role) && !employeeView;
  const ticketsPath = operationsUser ? "/tickets" : "/tickets?view=mine";

  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [edit, setEdit] = useState({
    title: "",
    description: "",
    priority: "Medium",
    status: "Open",
    workspace: "IT",
    assignedGroupId: "",
    assignedToUserId: "",
    dueAt: "",
  });

  const fetchTicket = async () => {
    setLoading(true);
    setError("");
    try {
      const [ticketResponse, historyResponse, commentsResponse] =
        await Promise.all([
          ticketsApi.getById(id),
          ticketsApi.getHistory(id).catch(() => ({ data: [] })),
          ticketsApi.getComments(id).catch(() => ({ data: [] })),
        ]);
      setTicket(ticketResponse.data);
      setAttachments(
        Array.isArray(ticketResponse.data?.attachments)
          ? ticketResponse.data.attachments
          : []
      );
      setHistory(
        Array.isArray(historyResponse.data) ? historyResponse.data : []
      );
      setComments(
        Array.isArray(commentsResponse.data) ? commentsResponse.data : []
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Ticket could not be loaded."));
      setTicket(null);
      setAttachments([]);
      setHistory([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  useEffect(() => {
    if (!operationsUser) return;
    groupsApi
      .getAll()
      .then((response) =>
        setGroups(Array.isArray(response.data) ? response.data : [])
      )
      .catch(() => setGroups([]));
  }, [operationsUser]);

  const canSelfAssign =
    !operationsUser &&
    ticket &&
    Number(ticket.requester_id) === Number(user?.id) &&
    !["Resolved", "Closed"].includes(ticket.status);

  const [agentDirectory, setAgentDirectory] = useState([]);

  useEffect(() => {
    if (!canSelfAssign) return;
    let cancelled = false;
    groupsApi
      .getAgents({
        category: ticket?.category || undefined,
        subCategory: ticket?.sub_category || undefined,
      })
      .then((response) => {
        if (!cancelled) {
          setAgentDirectory(
            Array.isArray(response.data) ? response.data : []
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAgentDirectory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canSelfAssign, ticket?.category, ticket?.sub_category]);

  const recommendedAgents = useMemo(() => {
    const scored = agentDirectory.filter(
      (agent) => agent.resolvedSub > 0 || agent.resolvedCategory > 0
    );
    const pool = scored.length
      ? scored
      : agentDirectory.filter((agent) => agent.resolvedTotal > 0);
    const available = pool.filter((agent) => agent.onShift !== false);
    return (available.length ? available : pool).slice(0, 3);
  }, [agentDirectory]);

  const otherDirectoryAgents = useMemo(() => {
    const recommendedIds = new Set(recommendedAgents.map((agent) => agent.id));
    return agentDirectory
      .filter((agent) => !recommendedIds.has(agent.id))
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [agentDirectory, recommendedAgents]);

  const selectedGroup = groups.find(
    (group) => String(group.id) === String(edit.assignedGroupId)
  );
  const assignmentText = useMemo(
    () =>
      ticket?.assigned_to_name ||
      (ticket?.assigned_to_user_id
        ? `User #${ticket.assigned_to_user_id}`
        : "Unassigned"),
    [ticket]
  );
  const timeline = useMemo(
    () => history.map((entry) => ({ ...entry, ...describeHistoryEntry(entry) })),
    [history]
  );
  const details = useMemo(() => {
    const raw = ticket?.request_details;
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [ticket]);
  const module = useMemo(() => moduleMeta(ticket, details), [ticket, details]);

  const downloadAttachment = async (attachment) => {
    try {
      const response = await ticketsApi.downloadAttachment(
        ticket.id,
        attachment.id
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name || `attachment-${attachment.id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Attachment could not be downloaded.")
      );
    }
  };

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
    setEditMode(true);
    setError("");
    setSuccess("");
  };

  const runAction = async (action, message) => {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
      await fetchTicket();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The ticket action failed."));
    } finally {
      setActionLoading(false);
    }
  };

  const save = () =>
    runAction(
      () =>
        ticketsApi.update(ticket.id, {
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

  const postReply = async () => {
    const body = reply.trim();
    if (!body) {
      setError("Write a message before posting.");
      return;
    }
    await runAction(
      () =>
        ticketsApi.addComment(ticket.id, {
          body,
          isInternal: operationsUser && internalNote,
        }),
      operationsUser && internalNote
        ? "Internal note posted."
        : "Reply posted."
    );
    setReply("");
    setInternalNote(false);
  };

  const uploadPending = async () => {
    if (!pendingFiles.length) {
      setError("Choose at least one file to upload.");
      return;
    }
    await runAction(
      () => ticketsApi.uploadAttachments(ticket.id, pendingFiles),
      `${pendingFiles.length} file(s) uploaded.`
    );
    setPendingFiles([]);
  };

  const resolveTicket = async () => {
    const note = resolutionNote.trim();
    await runAction(async () => {
      if (note) {
        await ticketsApi.addComment(ticket.id, {
          body: `Resolution: ${note}`,
          isInternal: false,
        });
      }
      await ticketsApi.resolve(ticket.id);
    }, "Ticket resolved.");
    setResolutionNote("");
  };

  const closeTicket = async () => {
    const note = resolutionNote.trim();
    await runAction(async () => {
      if (note) {
        await ticketsApi.addComment(ticket.id, {
          body: `Closed: ${note}`,
          isInternal: false,
        });
      }
      await ticketsApi.close(ticket.id);
    }, "Ticket closed.");
    setResolutionNote("");
  };

  const shellActions = (
    <>
      <button
        type="button"
        onClick={() => navigate(ticketsPath)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      {ticket ? (
        <>
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${priorityClass(ticket.priority)}`}
          >
            {ticket.priority}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(ticket.status)}`}
          >
            {ticket.status}
          </span>
        </>
      ) : null}
    </>
  );

  if (loading) {
    return (
      <OperationsShell
        breadcrumb={
          operationsUser ? "Helpdesk / Tickets" : "Helpdesk / My Tickets"
        }
        title="Ticket"
        subtitle="Loading…"
        actions={shellActions}
      >
        <p className="text-sm text-slate-500">Loading ticket…</p>
      </OperationsShell>
    );
  }

  if (!ticket) {
    return (
      <OperationsShell
        breadcrumb={
          operationsUser ? "Helpdesk / Tickets" : "Helpdesk / My Tickets"
        }
        title="Ticket not found"
        actions={shellActions}
      >
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 shadow-soft">
          {error || "Ticket not found."}
        </div>
      </OperationsShell>
    );
  }

  const ticketRef = ticket.ticket_ref || `TICKET-${ticket.id}`;

  return (
    <OperationsShell
      breadcrumb={
        operationsUser
          ? `Helpdesk / ${module.crumb} / ${ticketRef}`
          : `Helpdesk / My Tickets / ${ticketRef}`
      }
      title={ticket.title}
      subtitle={`${module.label} · Created ${formatDateTime(ticket.created_at)} · Updated ${formatDateTime(ticket.updated_at)}`}
      actions={shellActions}
      contentOverflow="hidden"
      contentClassName="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-5 lg:py-4 xl:px-6"
    >
      {/* <xl: whole page scrolls. xl+: page locks and each column scrolls on
          its own, so the SLA/People rail stays pinned while the ticket
          content moves. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden">
      {error ? (
        <div className="mb-4 shrink-0 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="scroll-slim space-y-5 xl:min-h-0 xl:overflow-y-auto xl:pb-2 xl:pr-1">
          {!operationsUser ? <StatusJourney ticket={ticket} /> : null}

          <div className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-[0.14em]"
                  style={{ color: BRAND }}
                >
                  {ticketRef}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Ticket details
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {operationsUser
                    ? "Full request and operational information."
                    : "What you reported and how it's classified."}
                </p>
              </div>
              {operationsUser && !editMode ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
                  style={{ backgroundColor: BRAND }}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              ) : null}
              {operationsUser && editMode ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: BRAND }}
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>

            {!editMode ? (
              <>
                {operationsUser ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <MetaChip label="Type" value={module.shortLabel || module.label} />
                    {ticket.category ? (
                      <MetaChip
                        label="Category"
                        value={[
                          ticket.category,
                          ticket.sub_category,
                          ticket.item_category,
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      />
                    ) : null}
                    {ticket.impact ? (
                      <MetaChip label="Impact" value={ticket.impact} />
                    ) : null}
                    {ticket.urgency ? (
                      <MetaChip label="Urgency" value={ticket.urgency} />
                    ) : null}
                    <MetaChip label="Workspace" value={ticket.workspace} />
                    {ticket.due_at ? (
                      <MetaChip
                        label="Due"
                        value={formatDateTime(ticket.due_at)}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <MetaChip label="Type" value={module.shortLabel || module.label} />
                    {ticket.category ? (
                      <MetaChip
                        label="Category"
                        value={[
                          ticket.category,
                          ticket.sub_category,
                          ticket.item_category,
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      />
                    ) : null}
                    {ticket.impact ? (
                      <MetaChip label="Impact" value={ticket.impact} />
                    ) : null}
                    {ticket.urgency ? (
                      <MetaChip label="Urgency" value={ticket.urgency} />
                    ) : null}
                    {ticket.due_at ? (
                      <MetaChip
                        label="Due"
                        value={formatDateTime(ticket.due_at)}
                      />
                    ) : null}
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Description
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {ticket.description || "No description provided."}
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input
                    value={edit.title}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Priority">
                  <select
                    value={edit.priority}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {PRIORITY_OPTIONS.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={edit.status}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Workspace">
                  <select
                    value={edit.workspace}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        workspace: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {WORKSPACE_OPTIONS.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Support Group">
                  <select
                    value={edit.assignedGroupId}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        assignedGroupId: event.target.value,
                        assignedToUserId: "",
                      }))
                    }
                    className={inputClass}
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
                    value={edit.assignedToUserId}
                    disabled={!edit.assignedGroupId}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        assignedToUserId: event.target.value,
                      }))
                    }
                    className={`${inputClass} disabled:bg-slate-100`}
                  >
                    <option value="">Unassigned</option>
                    {(selectedGroup?.members || []).map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name || member.email}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Due Date">
                  <input
                    type="datetime-local"
                    value={edit.dueAt}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        dueAt: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Description">
                    <textarea
                      rows="8"
                      value={edit.description}
                      onChange={(event) =>
                        setEdit((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {details.module === "change" ||
          details.module === "asset" ||
          details.module === "service" ||
          details.majorIncident ? (
            <div className={cardClass}>
              <h2 className="text-lg font-bold text-slate-950">
                Request details
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Structured fields captured with this request.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {details.changeType ? (
                  <Info label="Change Type" value={details.changeType} />
                ) : null}
                {details.risk ? <Info label="Risk" value={details.risk} /> : null}
                {details.plannedStart ? (
                  <Info
                    label="Planned Start"
                    value={formatDateTime(details.plannedStart)}
                  />
                ) : null}
                {details.plannedEnd ? (
                  <Info
                    label="Planned End"
                    value={formatDateTime(details.plannedEnd)}
                  />
                ) : null}
                {details.approvalStatus ? (
                  <Info
                    label="Approval"
                    value={
                      details.approvalStatus === "pending"
                        ? "Pending CAB / change manager"
                        : details.approvalStatus
                    }
                  />
                ) : null}
                {details.catalogItemName ? (
                  <Info label="Catalog Item" value={details.catalogItemName} />
                ) : null}
                {details.assetItem ? (
                  <Info label="Asset Item" value={details.assetItem} />
                ) : null}
                {details.quantity ? (
                  <Info label="Quantity" value={details.quantity} />
                ) : null}
                {details.requestReason ? (
                  <Info label="Reason" value={details.requestReason} />
                ) : null}
                {details.neededBy ? (
                  <Info label="Needed By" value={details.neededBy} />
                ) : null}
                {details.deliveryLocation ? (
                  <Info label="Delivery" value={details.deliveryLocation} />
                ) : null}
                {details.majorIncidentType ? (
                  <Info
                    label="Major Incident Type"
                    value={details.majorIncidentType}
                  />
                ) : null}
                {details.impactedLocations ? (
                  <Info
                    label="Impacted Locations"
                    value={details.impactedLocations}
                  />
                ) : null}
                {details.customersImpacted ? (
                  <Info
                    label="Customers Impacted"
                    value={details.customersImpacted}
                  />
                ) : null}
              </div>
              {[
                ["Reason for Change", details.changeReason],
                ["Rollout Plan", details.changePlan],
                ["Backout Plan", details.backoutPlan],
                ["Business Impact", details.businessImpact],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="mt-3 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {value}
                    </p>
                  </div>
                ))}
            </div>
          ) : null}

          <div className={cardClass}>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" style={{ color: BRAND }} />
              <h2 className="text-lg font-bold text-slate-950">Conversation</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Replies between the requester and support. Agents can add private
              notes.
            </p>

            {comments.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No messages yet. Post an update or ask a follow-up question.
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {comments.map((comment) => {
                  const mine =
                    Number(comment.author_user_id) === Number(user?.id);
                  const authorLabel = mine
                    ? "You"
                    : comment.display_name ||
                      comment.author_name ||
                      comment.display_email ||
                      "User";
                  return (
                    <li
                      key={comment.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        comment.is_internal
                          ? "border-amber-200 bg-amber-50/70"
                          : mine
                            ? "border-[#172b57]/15 bg-[#172b57]/[0.04]"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                              mine
                                ? "bg-[#172b57] text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {String(authorLabel).charAt(0).toUpperCase()}
                          </span>
                          {authorLabel}
                          {comment.is_internal ? (
                            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                              Internal
                            </span>
                          ) : null}
                          {!operationsUser && !mine && !comment.is_internal ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Support
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {formatDateTime(comment.created_at)}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {comment.body}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <textarea
                rows="3"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder={
                  operationsUser
                    ? "Write a reply to the requester, or an internal note…"
                    : "Add an update or ask a follow-up…"
                }
                className={inputClass}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {operationsUser ? (
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={internalNote}
                      onChange={(event) =>
                        setInternalNote(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300"
                      style={{ accentColor: BRAND }}
                    />
                    Internal note (agents only)
                  </label>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={postReply}
                  disabled={actionLoading || !reply.trim()}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  <Send className="h-4 w-4" />
                  Post
                </button>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" style={{ color: BRAND }} />
              <h2 className="text-lg font-bold text-slate-950">Attachments</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Evidence and supporting files for this ticket.
            </p>

            {attachments.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No attachments on this ticket yet.
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {attachment.original_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[
                            formatBytes(attachment.size_bytes),
                            attachment.content_type,
                            attachment.uploaded_by_name,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadAttachment(attachment)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 text-center transition hover:border-[#172b57]/40 hover:bg-slate-50">
              <UploadCloud
                className="mx-auto h-7 w-7"
                style={{ color: BRAND }}
              />
              <p className="mt-2 text-sm font-bold text-slate-800">
                Add evidence or screenshots
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PNG, JPG, WebP, or PDF — up to 5 files.
              </p>
              <input
                type="file"
                multiple
                accept={ALLOWED_ATTACH.join(",")}
                onChange={(event) =>
                  setPendingFiles(
                    Array.from(event.target.files || []).slice(0, 5)
                  )
                }
                className="hidden"
              />
            </label>
            {pendingFiles.length ? (
              <div className="mt-3 space-y-2">
                {pendingFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-semibold text-slate-800">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setPendingFiles((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index)
                        )
                      }
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={uploadPending}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload {pendingFiles.length} file
                  {pendingFiles.length === 1 ? "" : "s"}
                </button>
              </div>
            ) : null}
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-bold text-slate-950">Activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Audit trail of assignments, status changes, and updates.
            </p>
            {timeline.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No activity recorded yet.
              </div>
            ) : (
              <ol className="mt-4 space-y-0">
                {timeline.map((entry, index) => (
                  <li
                    key={entry.id || `${entry.created_at}-${index}`}
                    className="relative flex gap-4 pb-5 last:pb-0"
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[#172b57]/10"
                        style={{ backgroundColor: BRAND }}
                      />
                      {index < timeline.length - 1 ? (
                        <span className="mt-1 w-px flex-1 bg-slate-200" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {entry.title}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {entry.detail}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        By {entry.actor}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="scroll-hidden space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pb-2">
          {operationsUser ? (
            <div className={cardClass}>
              <h2 className="text-lg font-bold text-slate-950">Actions</h2>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      () =>
                        ticketsApi.assign(
                          ticket.id,
                          user.id,
                          ticket.assigned_group_id || null
                        ),
                      "Ticket assigned to you."
                    )
                  }
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800"
                >
                  <UserCheck className="h-4 w-4" />
                  Assign to Me
                </button>
                <textarea
                  rows="2"
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  placeholder="Optional resolution / close note…"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={resolveTicket}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={closeTicket}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                >
                  <XCircle className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>
          ) : null}

          <div className={cardClass}>
            <h2 className="text-lg font-bold text-slate-950">SLA and timing</h2>
            <div className="mt-4 space-y-3">
              <Info label="Created" value={formatDateTime(ticket.created_at)} />
              <Info label="Updated" value={formatDateTime(ticket.updated_at)} />
              {ticket.due_at ? (
                <Info label="Deadline" value={formatDateTime(ticket.due_at)} />
              ) : null}
              <Info label="Age" value={ticket.age} />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-bold text-slate-950">People</h2>
            <div className="mt-4 space-y-3">
              <Info
                label="Requester"
                value={ticket.requester_name || ticket.requester_email}
              />
              {(ticket.created_by_name || ticket.created_by_email) &&
              (ticket.created_by_name || ticket.created_by_email) !==
                (ticket.requester_name || ticket.requester_email) ? (
                <Info
                  label="Created By"
                  value={ticket.created_by_name || ticket.created_by_email}
                />
              ) : null}
              <Info label="Assigned To" value={assignmentText} />
              {canSelfAssign ? (
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Choose or change agent
                  </p>
                  <select
                    value={ticket.assigned_to_user_id || ""}
                    disabled={actionLoading}
                    onChange={(event) => {
                      const value = event.target.value;
                      runAction(
                        () => ticketsApi.assignAgent(ticket.id, value || null),
                        value
                          ? "Agent assigned — they have been notified."
                          : "Returned to the team for triage."
                      );
                    }}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="">Team triage — no specific agent</option>
                    {recommendedAgents.length ? (
                      <optgroup
                        label={
                          ticket.category
                            ? `Recommended for ${ticket.category}`
                            : "Recommended"
                        }
                      >
                        {recommendedAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                            {agent.job_title ? ` — ${agent.job_title}` : ""}
                            {agent.onShift === true && agent.shiftLabel
                              ? ` (on ${agent.shiftLabel.toLowerCase()})`
                              : ""}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {otherDirectoryAgents.length ? (
                      <optgroup label="All IT agents">
                        {otherDirectoryAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                            {agent.job_title ? ` — ${agent.job_title}` : ""}
                            {agent.onShift === false ? " (off shift)" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Recommendations are based on who resolved similar issues.
                    IT may still reassign.
                  </p>
                </div>
              ) : null}
              <Info
                label="Group"
                value={ticket.assigned_group_name || "Triage"}
              />
            </div>
          </div>

          {ticket.status === "Waiting Approval" ? (
            <div className="flex gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 shadow-soft">
              <Clock className="h-4 w-4 shrink-0" />
              Awaiting CAB / change-manager approval before implementation.
            </div>
          ) : null}
          {operationsUser && !ticket.assigned_to_user_id ? (
            <div className="flex gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-soft">
              <Clock className="h-4 w-4 shrink-0" />
              No individual agent is assigned yet.
            </div>
          ) : null}
        </aside>
      </div>
      </div>
    </OperationsShell>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

/**
 * Employee "where is my ticket" tracker — order-tracking mental model.
 * Submitted → Assigned → In progress → Resolved, with waiting states surfaced.
 */
function StatusJourney({ ticket }) {
  const status = ticket.status;
  const rank = ["Resolved", "Closed"].includes(status)
    ? 4
    : ["Investigating", "Pending", "Escalated", "Waiting Approval"].includes(
          status
        )
      ? 3
      : status === "Assigned" || ticket.assigned_to_user_id
        ? 2
        : 1;

  const steps = [
    { label: "Submitted", note: null, position: 1 },
    {
      label: "Assigned",
      note:
        rank >= 2
          ? ticket.assigned_to_name || ticket.assigned_group_name || null
          : "Waiting for triage",
      position: 2,
    },
    {
      label: "In progress",
      note:
        status === "Pending"
          ? "Waiting on you"
          : status === "Waiting Approval"
            ? "Awaiting approval"
            : status === "Escalated"
              ? "Escalated"
              : null,
      position: 3,
    },
    {
      label: status === "Closed" ? "Closed" : "Resolved",
      note: null,
      position: 4,
    },
  ];

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-4 shadow-soft sm:px-6">
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const complete =
            step.position === 1 || step.position < rank || rank === 4;
          const current = !complete && step.position === rank;
          return (
            <li key={step.label} className="flex flex-1 items-start last:flex-none">
              <div className="flex flex-col items-center text-center">
                <span
                  className={
                    complete
                      ? "flex h-7 w-7 items-center justify-center rounded-full bg-[#172b57] text-white"
                      : current
                        ? "flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#172b57] bg-white"
                        : "flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-200 bg-white"
                  }
                >
                  {complete ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <span
                      className={
                        current
                          ? "h-2 w-2 rounded-full bg-[#172b57]"
                          : "h-2 w-2 rounded-full bg-slate-200"
                      }
                    />
                  )}
                </span>
                <p
                  className={
                    complete || current
                      ? "mt-1.5 max-w-[7rem] text-xs font-bold text-slate-900"
                      : "mt-1.5 max-w-[7rem] text-xs font-semibold text-slate-400"
                  }
                >
                  {step.label}
                </p>
                {step.note ? (
                  <p className="mt-0.5 max-w-[8rem] truncate text-[11px] font-semibold text-slate-400">
                    {step.note}
                  </p>
                ) : null}
              </div>
              {index < steps.length - 1 ? (
                <span
                  className={
                    step.position < rank
                      ? "mx-2 mt-3.5 h-0.5 flex-1 rounded bg-[#172b57]"
                      : "mx-2 mt-3.5 h-0.5 flex-1 rounded bg-slate-200"
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MetaChip({ label, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
      <span className="font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value || "N/A"}
      </p>
    </div>
  );
}
