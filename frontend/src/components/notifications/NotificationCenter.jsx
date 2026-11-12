import { CheckCircle2, Circle, ExternalLink, Settings } from "lucide-react";
import { useMemo, useState } from "react";

function payloadOf(item) {
  return item?.action_payload || {};
}
function actionRequired(item) {
  const payload = payloadOf(item);
  return Boolean(payload.requiresAction || payload.requires_action);
}
function accessRequest(item) {
  const payload = payloadOf(item);
  const requestId = Number(payload.requestId || payload.request_id);
  return item.target_type === "access_request" || item.type === "access_request_approval" || (Number.isInteger(requestId) && requestId > 0);
}
function actionExpired(item) {
  return Boolean(item.action_expires_at && new Date(item.action_expires_at).getTime() <= Date.now());
}
function categoryOf(item) {
  const payload = payloadOf(item);
  const value = [item.type, item.target_type, item.module, payload.category, payload.eventType, payload.event_type]
    .filter(Boolean).join(" ").toLowerCase();
  if (value.includes("approval") || value.includes("access_request")) return "approvals";
  if (value.includes("discussion") || value.includes("comment") || value.includes("reply") || value.includes("conversation")) return "discussions";
  return "all";
}
function actorLabel(item) {
  const payload = payloadOf(item);
  return item.actor_name || item.actor_email || payload.actorName || payload.actor_name || payload.participant || "ATD";
}
function initials(value) {
  return String(value || "ATD").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
function referenceOf(item) {
  const payload = payloadOf(item);
  return item.ticket_ref || payload.ticketRef || payload.ticket_ref || payload.requestRef || payload.request_ref || "";
}

export default function NotificationCenter({ notifications = [], actionLoading, onAction, onReadState, onClear, onMarkAllRead, onSettings }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => notifications.filter((item) => filter === "all" || categoryOf(item) === filter), [filter, notifications]);
  return (
    <section role="dialog" aria-label="Notification Centre" className="w-[min(94vw,34rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black text-slate-950">Notification Centre</h3><p className="text-xs text-slate-500">Read state never removes a valid pending action.</p></div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <button type="button" onClick={onMarkAllRead} className="text-[var(--portal-primary)] hover:underline">Mark all as read</button>
            <button type="button" onClick={onSettings} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-950"><Settings className="h-3.5 w-3.5" />Settings</button>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-2" role="tablist" aria-label="Notification filters">
            {[['all','All'],['approvals','Approvals'],['discussions','Discussions']].map(([value,label]) => (
              <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={"rounded-full px-3 py-1.5 text-xs font-bold " + (filter === value ? "bg-[var(--portal-primary)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={onClear} className="text-xs font-bold text-red-600">Clear completed</button>
        </div>
      </header>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
        {filtered.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">No notifications in this view.</p> : filtered.map((notification) => {
          const required = actionRequired(notification);
          const expired = actionExpired(notification);
          const status = expired ? "Expired" : required ? "Action required" : notification.is_read ? "Read" : "Unread";
          const actor = actorLabel(notification);
          const reference = referenceOf(notification);
          return <article key={notification.id} className={"rounded-xl border p-3 " + (notification.is_read ? "border-slate-200 bg-slate-50" : "border-sky-300 bg-sky-50 ring-1 ring-sky-100")}>
            <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700">{initials(actor)}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-500">{notification.title || notification.type || "Notification"}</p><p className="mt-0.5 text-sm text-slate-800"><span className="font-bold">{actor}</span> {notification.message}</p></div><span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase">{status}</span></div>{reference ? <p className="mt-1 text-xs font-bold text-[var(--portal-primary)]">{reference}</p> : null}<p className="mt-1 text-xs text-slate-500">{new Date(notification.created_at).toLocaleString("en-ZA")}</p></div></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {required && !expired ? accessRequest(notification) ? <><button disabled={actionLoading} onClick={() => onAction(notification, "approve")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button><button disabled={actionLoading} onClick={() => onAction(notification, "reject")} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Reject</button><button onClick={() => onAction(notification, "view")} className="rounded-lg border px-3 py-1.5 text-xs font-bold">View Request</button></> : <><button disabled={actionLoading} onClick={() => onAction(notification, "accept")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Accept and Action</button><button disabled={actionLoading} onClick={() => onAction(notification, "return_to_queue")} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Return to Queue</button><button onClick={() => onAction(notification, "view")} className="rounded-lg border px-3 py-1.5 text-xs font-bold">View Ticket</button></> : null}
              <button disabled={actionLoading} onClick={() => onReadState(notification, !notification.is_read)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold">{notification.is_read ? <Circle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{notification.is_read ? "Mark unread" : "Mark read"}</button>
              {notification.target_url && !required ? <button onClick={() => onAction(notification, "view")} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold"><ExternalLink className="h-3.5 w-3.5" />Open</button> : null}
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
