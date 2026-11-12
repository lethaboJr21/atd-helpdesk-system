function ageBucket(createdAt, now = new Date()) {
  const created = new Date(createdAt);
  const ageDays = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86400000));
  return { ageDays, ageBand: ageDays < 7 ? "new" : "older" };
}
function buildMorningReminderReport(tickets = [], now = new Date()) {
  const rows = tickets.map((ticket) => ({ ...ticket, ...ageBucket(ticket.created_at || ticket.createdAt, now) }));
  const summarize = (items) => ({ total: items.length, overdue: items.filter((x) => x.is_overdue || x.overdue).length, dueToday: items.filter((x) => x.due_today || x.dueToday).length, awaitingReview: items.filter((x) => ["awaiting_review","submitted"].includes(String(x.review_status || x.status || "").toLowerCase())).length, unassigned: items.filter((x) => !x.assignee_id && !x.assigneeId).length });
  const newer = rows.filter((x) => x.ageBand === "new");
  const older = rows.filter((x) => x.ageBand === "older");
  return { generatedAt: now.toISOString(), thresholdDays: 7, new: { summary: summarize(newer), tickets: newer }, older: { summary: summarize(older), tickets: older }, all: { summary: summarize(rows), tickets: rows } };
}
module.exports = { ageBucket, buildMorningReminderReport };
