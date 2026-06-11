import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  XCircle,
} from "lucide-react";

import { groupsApi, ticketsApi } from "../services/api";

/**
 * ✅ TicketWorkspace
 * Main ticket workspace for helpdesk support teams.
 * Supports:
 * - ticket list
 * - ticket detail
 * - create ticket with mandatory group/assignee
 * - status changes
 * - resolve/close
 */
export default function TicketWorkspace() {
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    priority: "Medium",
    workspace: "IT",
    assignedGroupId: "",
    assignedToUserId: "",
  });

  /**
   * ✅ Fetch tickets
   */
  const fetchTickets = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await ticketsApi.getAll();
      const data = Array.isArray(res.data) ? res.data : [];

      setTickets(data);

      setSelectedTicket((current) => {
        if (!current) return data[0] || null;

        const updated = data.find((ticket) => ticket.id === current.id);
        return updated || data[0] || null;
      });
    } catch (err) {
      console.error("Fetch tickets failed:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to fetch tickets"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ Fetch support groups
   */
  const fetchGroups = async () => {
    try {
      const res = await groupsApi.getAll();
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch groups failed:", err);
      setError(
        err?.response?.data?.error || err?.message || "Failed to fetch groups"
      );
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchGroups();
  }, []);

  /**
   * ✅ Selected group members for assignee dropdown
   */
  const selectedGroup = groups.find(
    (group) => String(group.id) === String(newTicket.assignedGroupId)
  );

  const groupMembers = selectedGroup?.members || [];

  /**
   * ✅ Filter ticket list
   */
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
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
        .join(" ")
        .toLowerCase();

      const matchesSearch = text.includes(query.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || ticket.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tickets, query, statusFilter]);

  /**
   * ✅ Stats
   */
  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === "Open").length,
      assigned: tickets.filter((ticket) => ticket.status === "Assigned").length,
      resolved: tickets.filter((ticket) => ticket.status === "Resolved").length,
      closed: tickets.filter((ticket) => ticket.status === "Closed").length,
      critical: tickets.filter((ticket) => ticket.priority === "Critical")
        .length,
    };
  }, [tickets]);

  /**
   * ✅ Create ticket
   */
  const handleCreateTicket = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!newTicket.title.trim()) {
      setError("Ticket title is required.");
      return;
    }

    if (!newTicket.assignedGroupId && !newTicket.assignedToUserId) {
      setError("Please choose either a support group or an assignee.");
      return;
    }

    try {
      await ticketsApi.create({
        title: newTicket.title.trim(),
        description: newTicket.description.trim(),
        priority: newTicket.priority,
        workspace: newTicket.workspace,
        assignedGroupId: newTicket.assignedGroupId || null,
        assignedToUserId: newTicket.assignedToUserId || null,
      });

      setSuccess("Ticket created successfully.");
      setShowCreateForm(false);

      setNewTicket({
        title: "",
        description: "",
        priority: "Medium",
        workspace: "IT",
        assignedGroupId: "",
        assignedToUserId: "",
      });

      await fetchTickets();
    } catch (err) {
      console.error("Create ticket failed:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to create ticket"
      );
    }
  };

  /**
   * ✅ Change ticket status
   */
  const handleStatusChange = async (ticketId, status) => {
    setError("");
    setSuccess("");

    try {
      await ticketsApi.updateStatus(ticketId, status);
      setSuccess(`Ticket status changed to ${status}.`);
      await fetchTickets();
    } catch (err) {
      console.error("Status update failed:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to update ticket status"
      );
    }
  };

  /**
   * ✅ Resolve ticket
   */
  const handleResolve = async (ticketId) => {
    setError("");
    setSuccess("");

    try {
      await ticketsApi.resolve(ticketId);
      setSuccess("Ticket resolved.");
      await fetchTickets();
    } catch (err) {
      console.error("Resolve failed:", err);
      setError(
        err?.response?.data?.error || err?.message || "Failed to resolve ticket"
      );
    }
  };

  /**
   * ✅ Close ticket
   */
  const handleClose = async (ticketId) => {
    setError("");
    setSuccess("");

    try {
      await ticketsApi.close(ticketId);
      setSuccess("Ticket closed.");
      await fetchTickets();
    } catch (err) {
      console.error("Close failed:", err);
      setError(
        err?.response?.data?.error || err?.message || "Failed to close ticket"
      );
    }
  };

  /**
   * ✅ Priority style
   */
  const priorityClass = (priority) => {
    return {
      Critical: "bg-red-100 text-red-700 border-red-200",
      High: "bg-orange-100 text-orange-700 border-orange-200",
      Medium: "bg-amber-100 text-amber-700 border-amber-200",
      Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    }[priority || "Medium"];
  };

  /**
   * ✅ Status style
   */
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

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      {/* ✅ Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Ticket className="h-4 w-4" />
            Helpdesk / Ticket Workspace
          </div>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Ticket Workspace
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage Syspro ERP, Infrastructure, access, devices and helpdesk
            support tickets.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchTickets}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* ✅ Alerts */}
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

      {/* ✅ Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Assigned" value={stats.assigned} />
        <StatCard label="Resolved" value={stats.resolved} />
        <StatCard label="Closed" value={stats.closed} />
        <StatCard label="Critical" value={stats.critical} danger />
      </div>

      {/* ✅ Create ticket */}
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
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
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
                <option>IT</option>
                <option>ERP / Syspro</option>
                <option>Infrastructure</option>
                <option>Applications</option>
                <option>Access & Security</option>
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
                    {member.name} — {member.email}
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
              {creatingTicket ? "Ticket is being created, please wait..." : "Create Ticket"}
            </button>

            <button
              type="button"
              disabled={creatingTicket}
              onClick={() => setShowCreateForm(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      

      {/* ✅ Main Layout */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* ✅ Ticket queue */}
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
                  <option>Open</option>
                  <option>Assigned</option>
                  <option>Pending</option>
                  <option>Investigating</option>
                  <option>Waiting Approval</option>
                  <option>Resolved</option>
                  <option>Closed</option>
                  <option>Escalated</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredTickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No tickets found.
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`grid w-full gap-4 p-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_130px_130px_150px] lg:items-center ${
                    selectedTicket?.id === ticket.id ? "bg-blue-50" : ""
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
                </button>
              ))
            )}
          </div>
        </div>

        {/* ✅ Ticket detail */}
        <div className="space-y-6">
          {!selectedTicket ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
              Select a ticket to view details.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-blue-700">
                    {selectedTicket.ticket_ref ||
                      `TICKET-${selectedTicket.id}`}
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

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Description
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedTicket.description || "No description provided."}
                </p>
              </div>

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
              </div>

              <div className="mt-5">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Change Status
                </label>

                <select
                  value={selectedTicket.status || "Open"}
                  onChange={(event) =>
                    handleStatusChange(selectedTicket.id, event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option>Open</option>
                  <option>Assigned</option>
                  <option>Pending</option>
                  <option>Investigating</option>
                  <option>Waiting Approval</option>
                  <option>Resolved</option>
                  <option>Closed</option>
                  <option>Escalated</option>
                </select>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => handleResolve(selectedTicket.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Resolve
                </button>

                <button
                  onClick={() => handleClose(selectedTicket.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <XCircle className="h-4 w-4" />
                  Close
                </button>
              </div>

              {selectedTicket.priority === "Critical" && (
                <div className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Critical ticket. Prioritize investigation and escalation.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ✅ Form field wrapper.
 */
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

/**
 * ✅ Stat card.
 */
function StatCard({ label, value, danger = false }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        danger ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          danger ? "text-red-700" : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <h2
        className={`mt-2 text-3xl font-bold ${
          danger ? "text-red-800" : "text-slate-950"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}

/**
 * ✅ Info box.
 */
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