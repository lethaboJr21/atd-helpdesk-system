import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  UserCheck,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { groupsApi, ticketsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

const STATUS_TABS = [

  { label: "Unresolved", value: "Unresolved" },
  { label: "All", value: "All" },
  { label: "Open", value: "Open" },
  { label: "Assigned", value: "Assigned" },
  { label: "Pending", value: "Pending" },
  { label: "Investigating", value: "Investigating" },
  { label: "Waiting Approval", value: "Waiting Approval" },
  { label: "Resolved", value: "Resolved" },
  { label: "Closed", value: "Closed" },
  { label: "Escalated", value: "Escalated" },
];

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

export default function TicketWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [loading, setLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("unresolved");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    priority: "Medium",
    workspace: "IT",
    assignedGroupId: "",
    assignedToUserId: "",
  });

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

  const getErrorMessage = (err, fallback) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    );
  };

  const getTicketAge = (ticket) => {
    if (!ticket?.created_at) return "N/A";

    const created = new Date(ticket.created_at).getTime();

    if (Number.isNaN(created)) return "N/A";

    const diffMs = Date.now() - created;
    const mins = Math.floor(diffMs / 60000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;

    const hours = Math.floor(mins / 60);

    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const ageClass = (ticket) => {
    if (!ticket?.created_at) return "bg-slate-100 text-slate-600";

    const created = new Date(ticket.created_at).getTime();

    if (Number.isNaN(created)) return "bg-slate-100 text-slate-600";

    const hours = (Date.now() - created) / (1000 * 60 * 60);

    if (hours >= 72) return "bg-red-100 text-red-700";
    if (hours >= 24) return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  };

  const priorityClass = (priority) => {
    return {
      Critical: "bg-red-100 text-red-700 border-red-200",
      High: "bg-orange-100 text-orange-700 border-orange-200",
      Medium: "bg-amber-100 text-amber-700 border-amber-200",
      Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    }[priority || "Medium"];
  };

  const statusClass = (status) => {
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
  };

  const fetchTickets = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await ticketsApi.getAll();
      const data = Array.isArray(res.data) ? res.data : [];

      setTickets(data);

      setSelectedTicket((current) => {
        if (!current) return data[0] || null;

        const updated = data.find(
          (ticket) => String(ticket.id) === String(current.id)
        );

        return updated || data[0] || null;
      });
    } catch (err) {
      console.error("Fetch tickets failed:", err);
      setError(getErrorMessage(err, "Failed to fetch tickets."));
      setTickets([]);
      setSelectedTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await groupsApi.getAll();
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch groups failed:", err);
      setError(getErrorMessage(err, "Failed to fetch groups."));
      setGroups([]);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchGroups();
  }, []);

  const selectedGroup = groups.find(
    (group) => String(group.id) === String(newTicket.assignedGroupId)
  );

  const groupMembers = selectedGroup?.members || [];

  const selectedEditGroup = groups.find(
    (group) => String(group.id) === String(editTicket.assignedGroupId)
  );

  const editGroupMembers = selectedEditGroup?.members || [];

  const filteredTickets = useMemo(() => {
  const normalizedQuery = query.trim().toLowerCase();

  const statusRank = {
    Open: 1,
    Assigned: 2,
    Pending: 3,
    Investigating: 4,
    "Waiting Approval": 5,
    Escalated: 6,
    Resolved: 98,
    Closed: 99,
  };

  return tickets
    .filter((ticket) => {
      const text = [
        ticket.id,
        ticket.ticket_ref,
        ticket.title,
        ticket.description,
        ticket.priority,
        ticket.status,
        ticket.workspace,
        ticket.requester_name,
        ticket.assigned_to_name,
        ticket.assigned_group_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedQuery.length === 0 || text.includes(normalizedQuery);

      const currentStatus = String(ticket.status || "Open");

      const matchesStatus =
        statusFilter === "All"
          ? true
          : statusFilter === "Unresolved"
          ? !["Resolved", "Closed"].includes(currentStatus)
          : currentStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aStatus = String(a.status || "Open");
      const bStatus = String(b.status || "Open");

      const aRank = statusRank[aStatus] || 50;
      const bRank = statusRank[bStatus] || 50;

      if (aRank !== bRank) return aRank - bRank;

      const priorityRank = {
        Critical: 1,
        High: 2,
        Medium: 3,
        Low: 4,
      };

      const aPriority = priorityRank[a.priority] || 5;
      const bPriority = priorityRank[b.priority] || 5;

      if (aPriority !== bPriority) return aPriority - bPriority;

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
}, [tickets, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === "Open").length,
      assigned: tickets.filter((ticket) => ticket.status === "Assigned").length,
      resolved: tickets.filter((ticket) => ticket.status === "Resolved").length,
      closed: tickets.filter((ticket) => ticket.status === "Closed").length,
      critical: tickets.filter((ticket) => ticket.priority === "Critical")
        .length,
      unassigned: tickets.filter(
        (ticket) => !ticket.assigned_to_name && !ticket.assigned_to_user_id
      ).length,
    };
  }, [tickets]);

  /**
   * ✅ Important:
   * This is a normal function, not useMemo.
   * This avoids hook-order errors.
   */
  
const getStatusCount = (status) => {
  if (status === "All") return tickets.length;

  if (status === "Unresolved") {
    return tickets.filter(
      (ticket) => !["Resolved", "Closed"].includes(String(ticket.status || ""))
    ).length;
  }

  return tickets.filter(
    (ticket) =>
      String(ticket.status || "").toLowerCase() === status.toLowerCase()
  ).length;
};


  const resetNewTicketForm = () => {
    setNewTicket({
      title: "",
      description: "",
      priority: "Medium",
      workspace: "IT",
      assignedGroupId: "",
      assignedToUserId: "",
    });
  };

  const startEditingTicket = (ticket) => {
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

  const handleCreateTicket = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const title = newTicket.title.trim();
    const description = newTicket.description.trim();

    if (!title) {
      setError("Ticket title is required.");
      return;
    }

    if (!newTicket.assignedGroupId && !newTicket.assignedToUserId) {
      setError("Please choose either a support group or an assignee.");
      return;
    }

    setCreatingTicket(true);

    try {
      await ticketsApi.create({
        title,
        description,
        priority: newTicket.priority,
        workspace: newTicket.workspace,
        assignedGroupId: newTicket.assignedGroupId || null,
        assignedToUserId: newTicket.assignedToUserId || null,
      });

      setSuccess("Ticket created successfully.");
      setShowCreateForm(false);
      resetNewTicketForm();

      await fetchTickets();
    } catch (err) {
      console.error("Create ticket failed:", err);
      setError(getErrorMessage(err, "Failed to create ticket."));
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleSaveTicketEdit = async () => {
    if (!selectedTicket?.id) return;

    setError("");
    setSuccess("");

    if (!editTicket.title.trim()) {
      setError("Ticket title is required.");
      return;
    }

    setSavingTicket(true);

    try {
      await ticketsApi.update(selectedTicket.id, {
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

      await fetchTickets();
    } catch (err) {
      console.error("Ticket update failed:", err);
      setError(getErrorMessage(err, "Failed to update ticket."));
    } finally {
      setSavingTicket(false);
    }
  };

  const handleStatusChange = async (ticketId, status) => {
    setError("");
    setSuccess("");
    setActionLoading(true);

    const previousTickets = tickets;
    const previousSelectedTicket = selectedTicket;

    setTickets((prev) =>
      prev.map((ticket) =>
        String(ticket.id) === String(ticketId) ? { ...ticket, status } : ticket
      )
    );

    setSelectedTicket((prev) =>
      prev && String(prev.id) === String(ticketId)
        ? { ...prev, status }
        : prev
    );

    try {
      await ticketsApi.updateStatus(ticketId, status);
      setSuccess(`Ticket status changed to ${status}.`);
      await fetchTickets();
    } catch (err) {
      console.error("Status update failed:", err);
      setTickets(previousTickets);
      setSelectedTicket(previousSelectedTicket);
      setError(getErrorMessage(err, "Failed to update ticket status."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (ticketId) => {
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      await ticketsApi.resolve(ticketId);
      setSuccess("Ticket resolved.");
      await fetchTickets();
    } catch (err) {
      console.error("Resolve failed:", err);
      setError(getErrorMessage(err, "Failed to resolve ticket."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async (ticketId) => {
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      await ticketsApi.close(ticketId);
      setSuccess("Ticket closed.");
      await fetchTickets();
    } catch (err) {
      console.error("Close failed:", err);
      setError(getErrorMessage(err, "Failed to close ticket."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignToMe = async (ticketId) => {
    setError("");
    setSuccess("");

    const userId = user?.id || user?.user_id;

    if (!userId) {
      setError("Cannot assign ticket because current user ID was not found.");
      return;
    }

    setActionLoading(true);

    try {
      await ticketsApi.assign(ticketId, userId);
      setSuccess("Ticket assigned to you.");
      await fetchTickets();
    } catch (err) {
      console.error("Assign to me failed:", err);
      setError(getErrorMessage(err, "Failed to assign ticket."));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
          >
            ← Back to Dashboard
          </button>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Ticket className="h-4 w-4" />
            Helpdesk / Ticket Workspace
          </div>


          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Ticket Workspace
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage Syspro ERP, infrastructure, access, devices and helpdesk
            support tickets.
          </p>
        </div>
            
        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >

            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setShowCreateForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Assigned" value={stats.assigned} />
        <StatCard label="Resolved" value={stats.resolved} />
        <StatCard label="Closed" value={stats.closed} />
        <StatCard label="Critical" value={stats.critical} danger />
        <StatCard label="Unassigned" value={stats.unassigned} warning />
      </div>

      {/* Create ticket */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateTicket}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-bold text-slate-950">
            Create New Ticket
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <input
                value={newTicket.title}
                onChange={(event) =>
                  setNewTicket((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                className="input"
                placeholder="Short summary of the issue"
              />
            </Field>

            <Field label="Priority">
              <select
                value={newTicket.priority}
                onChange={(event) =>
                  setNewTicket((prev) => ({
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

            <Field label="Workspace">
              <select
                value={newTicket.workspace}
                onChange={(event) =>
                  setNewTicket((prev) => ({
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

            <Field label="Support Group required if no assignee">
              <select
                value={newTicket.assignedGroupId}
                onChange={(event) =>
                  setNewTicket((prev) => ({
                    ...prev,
                    assignedGroupId: event.target.value,
                    assignedToUserId: "",
                  }))
                }
                className="input"
              >
                <option value="">Choose group</option>

                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Assignee optional">
              <select
                value={newTicket.assignedToUserId}
                onChange={(event) =>
                  setNewTicket((prev) => ({
                    ...prev,
                    assignedToUserId: event.target.value,
                  }))
                }
                disabled={!newTicket.assignedGroupId}
                className="input disabled:bg-slate-100"
              >
                <option value="">No specific assignee</option>

                {groupMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email} — {member.email}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Description">
                <textarea
                  value={newTicket.description}
                  onChange={(event) =>
                    setNewTicket((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows="4"
                  className="input"
                  placeholder="Describe the issue or request"
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={creatingTicket}
              className="btn-primary"
            >
              {creatingTicket
                ? "Ticket is being created, please wait..."
                : "Create Ticket"}
            </button>

            <button
              type="button"
              disabled={creatingTicket}
              onClick={() => {
                setShowCreateForm(false);
                resetNewTicketForm();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Main layout */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Ticket queue */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Tickets List
                </h2>
                <p className="text-sm text-slate-500">
                  Freshservice-style queue grouped by status, priority and
                  assignment.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tickets..."
                    className="rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option>All</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Status tabs */}
          <div className="border-b border-slate-200 px-5 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_TABS.map((tab) => {
                const active = statusFilter === tab.value;

                return (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}

                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      {getStatusCount(tab.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading && tickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Loading tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <EmptyTicketsState />
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected =
                  String(selectedTicket?.id) === String(ticket.id);

                const isCritical = ticket.priority === "Critical";

                const isUnassigned =
                  !ticket.assigned_to_name && !ticket.assigned_to_user_id;

                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    onDoubleClick={() => navigate(`/tickets/${ticket.id}`)}
                    className={`grid w-full gap-4 border-l-4 p-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_120px_130px_150px_80px] lg:items-center ${
                      isSelected ? "bg-blue-50" : ""
                    } ${
                      isCritical
                        ? "border-l-red-500"
                        : isUnassigned
                        ? "border-l-amber-500"
                        : "border-l-transparent"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-blue-700">
                          {ticket.ticket_ref || `TICKET-${ticket.id}`}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${priorityClass(
                            ticket.priority
                          )}`}
                        >
                          {ticket.priority || "Medium"}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                            ticket.status
                          )}`}
                        >
                          {ticket.status || "Open"}
                        </span>
                      </div>

                      <p className="mt-2 font-semibold text-slate-950">
                        {ticket.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {ticket.requester_name ||
                          `Requester #${ticket.requester_id || "N/A"}`}
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-slate-950">
                        {ticket.workspace || "IT"}
                      </p>
                      <p className="text-slate-500">Workspace</p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-slate-950">
                        {ticket.assigned_group_name || "No group"}
                      </p>
                      <p className="text-slate-500">Group</p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-slate-950">
                        {ticket.assigned_to_name ||
                          (ticket.assigned_to_user_id
                            ? `User #${ticket.assigned_to_user_id}`
                            : "None")}
                      </p>
                      <p className="text-slate-500">Assigned to</p>
                    </div>

                    <div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${ageClass(
                          ticket
                        )}`}
                      >
                        {getTicketAge(ticket)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket detail preview */}
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          {!selectedTicket ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
              Select a ticket to view details.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-blue-700">
                    {selectedTicket.ticket_ref || `TICKET-${selectedTicket.id}`}
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {selectedTicket.title}
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold ${priorityClass(
                    selectedTicket.priority
                  )}`}
                >
                  {selectedTicket.priority || "Medium"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/tickets/${selectedTicket.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Case
                </button>

                {!editMode ? (
                  <button
                    onClick={() => startEditingTicket(selectedTicket)}
                    className="btn-primary"
                  >
                    Edit Ticket
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveTicketEdit}
                      disabled={savingTicket}
                      className="btn-primary"
                    >
                      {savingTicket ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                      onClick={() => setEditMode(false)}
                      disabled={savingTicket}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {editMode ? (
                <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
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

                  <Field label="Description">
                    <textarea
                      value={editTicket.description}
                      onChange={(event) =>
                        setEditTicket((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      rows="4"
                      className="input"
                    />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
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

                    <Field label="Deadline">
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
                        onChange={(event) =>
                          setEditTicket((prev) => ({
                            ...prev,
                            assignedToUserId: event.target.value,
                          }))
                        }
                        disabled={!editTicket.assignedGroupId}
                        className="input disabled:bg-slate-100"
                      >
                        <option value="">Unassigned</option>

                        {editGroupMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name || member.email} — {member.email}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Description
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {selectedTicket.description || "No description provided."}
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <InfoBox label="Status" value={selectedTicket.status} />
                <InfoBox label="Workspace" value={selectedTicket.workspace} />

                <InfoBox
                  label="Group"
                  value={selectedTicket.assigned_group_name || "No group"}
                />

                <InfoBox
                  label="Assigned To"
                  value={
                    selectedTicket.assigned_to_name ||
                    (selectedTicket.assigned_to_user_id
                      ? `User #${selectedTicket.assigned_to_user_id}`
                      : "None")
                  }
                />

                <InfoBox label="Age" value={getTicketAge(selectedTicket)} />

                <InfoBox
                  label="Requester"
                  value={
                    selectedTicket.requester_name ||
                    `Requester #${selectedTicket.requester_id || "N/A"}`
                  }
                />
              </div>

              <div className="mt-5">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Change Status
                </label>

                <select
                  value={selectedTicket.status || "Open"}
                  disabled={actionLoading}
                  onChange={(event) =>
                    handleStatusChange(selectedTicket.id, event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  onClick={() => handleAssignToMe(selectedTicket.id)}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserCheck className="h-4 w-4" />
                  Assign to Me
                </button>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => handleResolve(selectedTicket.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Resolve
                  </button>

                  <button
                    onClick={() => handleClose(selectedTicket.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Close
                  </button>
                </div>
              </div>

              {selectedTicket.priority === "Critical" && (
                <div className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Critical ticket. Prioritize investigation and escalation.
                </div>
              )}

              {!selectedTicket.assigned_to_name &&
                !selectedTicket.assigned_to_user_id && (
                  <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    This ticket is currently unassigned.
                  </div>
                )}
            </div>
          )}
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

function StatCard({ label, value, danger = false, warning = false }) {
  const cardClass = danger
    ? "border-red-200 bg-red-50"
    : warning
    ? "border-amber-200 bg-amber-50"
    : "border-slate-200 bg-white";

  const labelClass = danger
    ? "text-red-700"
    : warning
    ? "text-amber-700"
    : "text-slate-500";

  const valueClass = danger
    ? "text-red-800"
    : warning
    ? "text-amber-800"
    : "text-slate-950";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${cardClass}`}>
      <p className={`text-sm font-semibold ${labelClass}`}>{label}</p>

      <h2 className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</h2>
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

function EmptyTicketsState() {
  return (
    <div className="p-8 text-center">
      <Ticket className="mx-auto h-10 w-10 text-slate-400" />

      <p className="mt-3 font-semibold text-slate-700">No tickets found</p>

      <p className="mt-1 text-sm text-slate-500">
        Try adjusting your search/filter, or create a new ticket.
      </p>
    </div>
  );
}