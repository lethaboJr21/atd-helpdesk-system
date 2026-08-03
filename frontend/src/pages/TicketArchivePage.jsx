import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  Download,
  ExternalLink,
  Filter,
  Lock,
  Mail,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { archiveApi } from "../services/api";

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);

const cn = (...values) => values.filter(Boolean).join(" ");

const STATUS_TONES = {
  Open: "bg-blue-100 text-blue-800",
  Pending: "bg-amber-100 text-amber-800",
  Resolved: "bg-emerald-100 text-emerald-800",
  Closed: "bg-slate-200 text-slate-700",
};

const PRIORITY_TONES = {
  Urgent: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-sky-100 text-sky-800",
  Low: "bg-slate-100 text-slate-700",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function errorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

function Pill({ children, tone = "bg-slate-100 text-slate-700" }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-bold leading-none tracking-wide",
        tone,
      )}
    >
      {children || "Unknown"}
    </span>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

/**
 * Archived email bodies are untrusted HTML, so the original markup is only ever
 * rendered inside a sandboxed iframe. The plain-text version is the default.
 */
function MessageBody({ html, text }) {
  const [showOriginal, setShowOriginal] = useState(false);

  const plain = String(text || "").trim();

  if (!plain && !html) {
    return <p className="text-sm italic text-slate-400">No message content captured.</p>;
  }

  return (
    <div>
      {showOriginal && html ? (
        <iframe
          title="Original message"
          sandbox=""
          srcDoc={html}
          className="h-96 w-full rounded-lg border border-slate-200 bg-white"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
          {plain || "No plain-text version captured — view the original below."}
        </p>
      )}

      {html ? (
        <button
          type="button"
          onClick={() => setShowOriginal((current) => !current)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800"
        >
          <Code2 className="h-3.5 w-3.5" />
          {showOriginal ? "Show plain text" : "View original formatting"}
        </button>
      ) : null}
    </div>
  );
}

async function downloadAttachment(attachment) {
  const response = await archiveApi.downloadAttachment(attachment.fs_id);
  const url = URL.createObjectURL(response.data);

  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.name || `attachment-${attachment.fs_id}`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function AttachmentRow({ attachment }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    setFailed(false);

    try {
      await downloadAttachment(attachment);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">
          {attachment.name}
        </p>
        <p className="text-xs text-slate-500">
          {[attachment.content_type, formatBytes(attachment.size_bytes)]
            .filter(Boolean)
            .join(" · ")}
          {failed ? " · download failed" : ""}
        </p>
      </div>

      {attachment.stored_path ? (
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {busy ? "Downloading..." : "Download"}
        </button>
      ) : (
        <span className="text-xs font-semibold text-slate-400">
          Not yet copied across
        </span>
      )}
    </li>
  );
}

function TicketDrawer({ fsId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await archiveApi.getTicket(fsId);
        if (!cancelled) setData(response.data);
      } catch (requestError) {
        if (!cancelled) {
          setError(errorMessage(requestError, "Unable to load the archived ticket."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fsId]);

  const ticket = data?.ticket;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-blue-700">
              {ticket ? ticket.reference : `FS-${fsId}`}
            </p>
            <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950">
              {loading ? "Loading..." : ticket?.subject || "Archived ticket"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Close archived ticket"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Loading archived ticket...
            </p>
          ) : error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={STATUS_TONES[ticket.status_label]}>{ticket.status_label}</Pill>
                <Pill tone={PRIORITY_TONES[ticket.priority_label]}>
                  {ticket.priority_label}
                </Pill>
                {ticket.ticket_type ? <Pill>{ticket.ticket_type}</Pill> : null}
                {ticket.is_escalated ? (
                  <Pill tone="bg-red-100 text-red-800">Escalated</Pill>
                ) : null}
                {ticket.spam ? <Pill tone="bg-amber-100 text-amber-800">Spam</Pill> : null}
                {ticket.deleted ? (
                  <Pill tone="bg-slate-200 text-slate-700">Deleted in Freshservice</Pill>
                ) : null}
              </div>

              <dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
                {[
                  ["Requester", ticket.requester_name || ticket.resolved_requester_name],
                  ["Requester email", ticket.requester_email || ticket.resolved_requester_email],
                  ["Assigned agent", ticket.assigned_agent_name || ticket.responder_name],
                  ["Support group", ticket.resolved_group_name],
                  ["Department", ticket.resolved_department_name],
                  ["Source", ticket.source_label],
                  ["Category", [ticket.category, ticket.sub_category, ticket.item_category].filter(Boolean).join(" › ")],
                  ["Logged", formatDateTime(ticket.created_at)],
                  ["First response", formatDateTime(ticket.first_responded_at)],
                  ["Resolved", formatDateTime(ticket.resolved_at)],
                  ["Closed", formatDateTime(ticket.closed_at)],
                  ["Response due", formatDateTime(ticket.fr_due_by)],
                  ["Resolution due", formatDateTime(ticket.due_by)],
                  ["Last updated", formatDateTime(ticket.updated_at)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-slate-950">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Original request
                </h3>
                <div className="mt-3">
                  <MessageBody html={ticket.description_html} text={ticket.description_text} />
                </div>
              </section>

              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                  <MessageSquare className="h-4 w-4" />
                  Conversation ({data.conversations.length})
                </h3>

                {data.conversations.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                    No replies were recorded on this ticket.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {data.conversations.map((message) => (
                      <li
                        key={message.fs_id}
                        className={cn(
                          "rounded-xl border bg-white p-5 shadow-sm",
                          message.private
                            ? "border-amber-200 bg-amber-50/60"
                            : "border-slate-200",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950">
                              {message.author_name || message.from_email || "Unknown sender"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {message.from_email || message.author_email || ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {message.private ? (
                              <Pill tone="bg-amber-100 text-amber-800">
                                <Lock className="mr-1 h-3 w-3" />
                                Private note
                              </Pill>
                            ) : (
                              <Pill tone={message.incoming ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-800"}>
                                {message.incoming ? "From requester" : "From agent"}
                              </Pill>
                            )}
                            <span className="text-xs font-semibold text-slate-500">
                              {formatDateTime(message.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <MessageBody html={message.body_html} text={message.body_text} />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {data.attachments.length > 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({data.attachments.length})
                  </h3>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {data.attachments.map((attachment) => (
                      <AttachmentRow key={attachment.fs_id} attachment={attachment} />
                    ))}
                  </ul>
                </section>
              ) : null}

              {ticket.local_ticket_id ? (
                <a
                  href={`/helpdesk/tickets/${ticket.local_ticket_id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open the linked helpdesk ticket
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketArchivePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const operational = OPERATIONS_ROLES.has(user?.role);

  const [summary, setSummary] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFsId, setSelectedFsId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    priority: "",
    type: "",
    category: "",
    group_id: "",
    agent_id: "",
    from: "",
    to: "",
    page: 1,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.q === searchInput ? current : { ...current, q: searchInput, page: 1 },
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!operational) return;

    Promise.all([archiveApi.getSummary(), archiveApi.getFilters()])
      .then(([summaryResponse, filtersResponse]) => {
        setSummary(summaryResponse.data);
        setFilterOptions(filtersResponse.data);
      })
      .catch(() => {
        // The ticket search below surfaces any real connectivity problem.
      });
  }, [operational]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = Object.fromEntries(
      Object.entries({ ...filters, per_page: 25 }).filter(
        ([, value]) => value !== "" && value !== null && value !== undefined,
      ),
    );

    try {
      const response = operational
        ? await archiveApi.searchTickets(params)
        : await archiveApi.getMyTickets(params);

      setTickets(response.data.tickets || []);
      setPagination(response.data.pagination || null);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to search the ticket archive."));
      setTickets([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [filters, operational]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const activeFilterCount = useMemo(
    () =>
      ["status", "priority", "type", "category", "group_id", "agent_id", "from", "to"].filter(
        (key) => filters[key],
      ).length,
    [filters],
  );

  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  const clearFilters = () => {
    setSearchInput("");
    setFilters({
      q: "",
      status: "",
      priority: "",
      type: "",
      category: "",
      group_id: "",
      agent_id: "",
      from: "",
      to: "",
      page: 1,
    });
  };

  const totals = summary?.totals;
  const coverage = summary?.coverage;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(operational ? "/" : "/employee")}
              className="mb-4 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Archive className="h-4 w-4" />
              Data Migration
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Freshservice Import
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Raw mirror of the Freshservice tenant, used to confirm nothing is
              missing before the subscription is cancelled. The tickets themselves
              live in the{" "}
              <button
                type="button"
                onClick={() => navigate("/tickets")}
                className="font-semibold text-blue-700 underline hover:text-blue-800"
              >
                Ticket Workspace
              </button>{" "}
              alongside everything else.
            </p>
          </div>

          {operational ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={loadTickets}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </button>
            </div>
          ) : null}
        </header>

        {operational && totals ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Archived tickets"
              value={Number(totals.tickets).toLocaleString("en-ZA")}
              hint={
                coverage?.oldest
                  ? `${formatDate(coverage.oldest)} – ${formatDate(coverage.newest)}`
                  : null
              }
            />
            <StatCard
              label="Conversations"
              value={Number(totals.conversations).toLocaleString("en-ZA")}
              hint={`${Number(totals.attachments).toLocaleString("en-ZA")} attachments catalogued`}
            />
            <StatCard
              label="People"
              value={Number(totals.requesters).toLocaleString("en-ZA")}
              hint={`${Number(totals.agents).toLocaleString("en-ZA")} agents archived`}
            />
            <StatCard
              label="Assets & knowledge"
              value={Number(totals.assets).toLocaleString("en-ZA")}
              hint={`${Number(totals.knowledge_articles).toLocaleString("en-ZA")} knowledge articles`}
            />
          </div>
        ) : null}

        {operational && summary?.lastSync ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
            <Database className="h-4 w-4 text-slate-400" />
            <span className="font-bold text-slate-800">
              Last sync #{summary.lastSync.id}
            </span>
            <Pill
              tone={
                summary.lastSync.status === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : summary.lastSync.status === "failed"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
              }
            >
              {summary.lastSync.status}
            </Pill>
            <span>{formatDateTime(summary.lastSync.finished_at || summary.lastSync.started_at)}</span>
            <span className="text-slate-400">·</span>
            <span>
              {Number(totals?.tickets_detailed || 0).toLocaleString("en-ZA")} of{" "}
              {Number(totals?.tickets || 0).toLocaleString("en-ZA")} tickets fully mirrored
            </span>
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Search subject, requester, ticket number or message text"
              />
            </div>

            {operational ? (
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-sm",
                  showFilters || activeFilterCount > 0
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                )}
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            ) : null}
          </div>

          {operational && showFilters ? (
            <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { key: "status", label: "Status", options: filterOptions?.statuses },
                { key: "priority", label: "Priority", options: filterOptions?.priorities },
                { key: "type", label: "Type", options: filterOptions?.types },
                { key: "category", label: "Category", options: filterOptions?.categories },
              ].map((field) => (
                <label key={field.key} className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field.label}
                  </span>
                  <select
                    value={filters[field.key]}
                    onChange={(event) => setFilter(field.key, event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">All</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Support group
                </span>
                <select
                  value={filters.group_id}
                  onChange={(event) => setFilter("group_id", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">All groups</option>
                  {(filterOptions?.groups || []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Handled by
                </span>
                <select
                  value={filters.agent_id}
                  onChange={(event) => setFilter("agent_id", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">All agents</option>
                  {(filterOptions?.agents || []).map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Logged from
                </span>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilter("from", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Logged until
                </span>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => setFilter("to", event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="flex items-end lg:col-span-4">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Clear all filters
                </button>
              </div>
            </div>
          ) : null}

          <div className="hidden border-b border-slate-200 px-5 py-3 md:grid md:grid-cols-[110px_minmax(0,1.6fr)_minmax(0,1fr)_110px_110px_100px] md:items-center md:gap-4">
            {["Reference", "Subject", "Requester", "Status", "Priority", "Logged"].map(
              (heading) => (
                <p
                  key={heading}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {heading}
                </p>
              ),
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <p className="p-10 text-center text-sm text-slate-500">
                Searching the archive...
              </p>
            ) : error ? (
              <p className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : tickets.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">
                No archived tickets match your search.
              </p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.fs_id}
                  type="button"
                  onClick={() => setSelectedFsId(ticket.fs_id)}
                  className="grid w-full items-center gap-3 p-5 text-left hover:bg-slate-50 md:grid-cols-[110px_minmax(0,1.6fr)_minmax(0,1fr)_110px_110px_100px] md:gap-4"
                >
                  <p className="font-bold text-blue-700">{ticket.reference}</p>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">
                      {ticket.subject || "No subject"}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span>{ticket.ticket_type || "Unspecified"}</span>
                      {ticket.category ? <span>· {ticket.category}</span> : null}
                      {ticket.conversation_count > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          · <MessageSquare className="h-3 w-3" />
                          {ticket.conversation_count}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {ticket.requester_name || "Unknown"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <Mail className="h-3 w-3 shrink-0" />
                      {ticket.requester_email || "No email captured"}
                    </p>
                  </div>

                  <div className="flex md:justify-start">
                    <Pill tone={STATUS_TONES[ticket.status_label]}>
                      {ticket.status_label}
                    </Pill>
                  </div>

                  <div className="flex md:justify-start">
                    <Pill tone={PRIORITY_TONES[ticket.priority_label]}>
                      {ticket.priority_label}
                    </Pill>
                  </div>

                  <p className="text-sm font-semibold text-slate-700">
                    {formatDate(ticket.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <p className="text-sm text-slate-600">
                Page{" "}
                <span className="font-bold text-slate-950">{pagination.page}</span> of{" "}
                <span className="font-bold text-slate-950">{pagination.totalPages}</span>
                {" · "}
                <span className="font-bold text-slate-950">
                  {pagination.total.toLocaleString("en-ZA")}
                </span>{" "}
                tickets
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: current.page - 1 }))
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: current.page + 1 }))
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selectedFsId ? (
        <TicketDrawer fsId={selectedFsId} onClose={() => setSelectedFsId(null)} />
      ) : null}
    </div>
  );
}
