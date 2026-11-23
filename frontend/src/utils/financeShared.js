export function csvExport(rows, columns, filename) {
  const header = columns.map(c => `"${String(c.label || c.key).replaceAll('"', '""')}"`).join(",");
  const body = rows.map(row =>
    columns.map(c => `"${String(row[c.key] ?? "").replaceAll('"', '""')}"`).join(",")
  ).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function deriveWorkItemFlags(item) {
  const effectiveDue = item.effective_due_at || item.due_at;
  const isOverdue = Boolean(effectiveDue && new Date(effectiveDue) < new Date());
  const dueWithin24h = Boolean(effectiveDue && new Date(effectiveDue) - Date.now() <= 86400000 && new Date(effectiveDue) > new Date());
  const dueToday = Boolean(effectiveDue && new Date(effectiveDue).toDateString() === new Date().toDateString());
  const halfElapsed = Number(item.elapsedPercent) >= 50 && !isOverdue;
  const evidenceRequired = Boolean(item.evidence_state === "required" || (item.requires_evidence && !(item.evidence_count > 0)));
  return { isOverdue, dueWithin24h, dueToday, halfElapsed, evidenceRequired };
}

export function formatFinanceDate(value) {
  return value ? new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "No due date";
}

export function formatElapsed(item) {
  if (item.isOverdue) return "Overdue";
  const pct = Math.min(100, Math.max(0, item.elapsedPercent || 0));
  return `${pct}% time elapsed`;
}

export function workItemTone(item) {
  return item.isOverdue
    ? "border-red-200 bg-red-50"
    : item.dueWithin24h
    ? "border-amber-200 bg-amber-50"
    : Number(item.elapsedPercent) >= 50
    ? "border-sky-200 bg-sky-50"
    : "border-slate-200 bg-white";
}