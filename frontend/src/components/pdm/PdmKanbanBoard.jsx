import { useState } from "react";

const LIFECYCLE_ORDER = ["Open", "In Progress", "Resolved", "Closed"];

export function deriveKanbanColumns(tickets = []) {
  const distinct = [...new Set((tickets || []).map((ticket) => ticket.status).filter(Boolean))];
  const lifecycle = distinct.filter((status) => LIFECYCLE_ORDER.includes(status));
  const extra = distinct.filter((status) => !LIFECYCLE_ORDER.includes(status)).sort();
  lifecycle.sort((a, b) => LIFECYCLE_ORDER.indexOf(a) - LIFECYCLE_ORDER.indexOf(b));
  return [...lifecycle, ...extra];
}

export default function PdmKanbanBoard({ tickets = [], onMove, moveError }) {
  const columns = deriveKanbanColumns(tickets);
  const [draggingId, setDraggingId] = useState(null);
  const grouped = columns.map((status) => ({ status, items: tickets.filter((ticket) => ticket.status === status) }));
  return (
    <div>
      {moveError && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{moveError}</p>}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(220px, 1fr))` }}>
        {grouped.map(({ status, items }) => (
          <div
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingId != null) onMove?.(draggingId, status);
              setDraggingId(null);
            }}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
          >
            <p className="mb-3 flex items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500">
              {status}
              <span className="rounded-full bg-white px-2 py-0.5">{items.length}</span>
            </p>
            <div className="space-y-2">
              {items.map((ticket) => (
                <div
                  key={ticket.id}
                  draggable
                  onDragStart={() => setDraggingId(ticket.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="text-xs font-black text-cyan-800">{ticket.ticket_ref}</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-800">{ticket.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{ticket.assignee_name || "Unassigned"} · {ticket.priority}</p>
                </div>
              ))}
              {!items.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">No tickets.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}