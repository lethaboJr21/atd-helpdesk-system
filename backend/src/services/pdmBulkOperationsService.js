const pool = require("../db/pool");

const BULK_MAX = parseInt(process.env.PDM_BULK_MAX || "100", 10);
const BULK_STATUSES = new Set(["Open", "In Progress", "Resolved", "Closed"]);

function normalizeTicketIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

function assertBulkTicketIds(ticketIds) {
  if (!ticketIds.length || ticketIds.length > BULK_MAX) {
    throw Object.assign(new Error(`Select between 1 and ${BULK_MAX} tickets for bulk operations.`), { status: 400, code: "PDM_BULK_LIMIT_EXCEEDED" });
  }
}

function normalizeTarget(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return undefined;
  return numeric;
}

async function history(client, ticketId, actorId, action, oldValue, newValue) {
  try {
    await client.query(`INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value) VALUES($1,$2,$3,$4,$5)`, [ticketId, actorId || null, action, oldValue == null ? null : String(oldValue), newValue == null ? null : String(newValue)]);
  } catch (error) {
    if (error.code !== "42P01") console.error("Ticket history write failed:", error);
  }
}

async function assertGroupActive(client, groupId) {
  const result = await client.query("SELECT id FROM support_groups WHERE id=$1 AND COALESCE(is_active,TRUE)=TRUE", [groupId]);
  if (!result.rows[0]) throw Object.assign(new Error("The selected support group is unavailable."), { status: 400 });
}

async function assertAssigneeEligible(client, groupId, assigneeId) {
  if (!groupId) throw Object.assign(new Error("Select a support group before choosing an agent."), { status: 400 });
  const result = await client.query(`SELECT u.id FROM users u JOIN support_group_members gm ON gm.user_id=u.id AND gm.group_id=$2 WHERE u.id=$1 AND u.approved=TRUE AND u.status='active' AND u.archived_at IS NULL AND COALESCE(u.account_type,'person')='person' AND COALESCE(u.microsoft_account_enabled,TRUE)=TRUE AND u.role IN ('agent','operator','manager','admin','superadmin') LIMIT 1`, [assigneeId, groupId]);
  if (!result.rows[0]) throw Object.assign(new Error("The selected agent is not an eligible member of this support group."), { status: 400 });
}

async function runPerTicket(client, ticketIds, apply) {
  const results = [];
  for (const ticketId of ticketIds) {
    const savepoint = `pdm_bulk_${ticketId}`;
    try {
      await client.query(`SAVEPOINT ${savepoint}`);
      const found = await client.query("SELECT id,status,archived_at,assigned_group_id,assigned_to_user_id FROM tickets WHERE id=$1 FOR UPDATE", [ticketId]);
      const before = found.rows[0];
      if (!before) throw Object.assign(new Error("Ticket not found."), { status: 404 });
      if (before.archived_at) throw Object.assign(new Error("Archived tickets cannot be modified in bulk."), { status: 409 });
      await apply(ticketId, before);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      results.push({ ticketId, ok: true });
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`).catch(() => {});
      results.push({ ticketId, ok: false, error: error.message || "Ticket action failed." });
    }
  }
  return results;
}

async function bulkAssign({ ticketIds: rawIds, assigneeUserId, groupId, reason, actorUserId }) {
  const ticketIds = normalizeTicketIds(rawIds);
  assertBulkTicketIds(ticketIds);
  const group = normalizeTarget(groupId);
  const assignee = normalizeTarget(assigneeUserId);
  if (group === undefined || assignee === undefined) throw Object.assign(new Error("Choose a valid support group and agent for the bulk assignment."), { status: 400, code: "PDM_BULK_FIELDS_REQUIRED" });
  if (!group && !assignee) throw Object.assign(new Error("Choose a support group or an agent for the bulk assignment."), { status: 400, code: "PDM_BULK_FIELDS_REQUIRED" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = await runPerTicket(client, ticketIds, async (ticketId, before) => {
      if (group) await assertGroupActive(client, group);
      if (assignee) await assertAssigneeEligible(client, group, assignee);
      await client.query("UPDATE tickets SET assigned_group_id=$1,assigned_to_user_id=$2,updated_at=NOW() WHERE id=$3", [group, assignee, ticketId]);
      await history(client, ticketId, actorUserId, "bulk_assignment", JSON.stringify({ groupId: before.assigned_group_id, assigneeUserId: before.assigned_to_user_id }), JSON.stringify({ groupId: group, assigneeUserId: assignee, reason: reason || null }));
    });
    await client.query("COMMIT");
    return { results, updated: results.filter((item) => item.ok).length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function bulkStatus({ ticketIds: rawIds, status: rawStatus, reason, actorUserId }) {
  const ticketIds = normalizeTicketIds(rawIds);
  assertBulkTicketIds(ticketIds);
  const nextStatus = String(rawStatus || "").trim();
  if (!BULK_STATUSES.has(nextStatus)) throw Object.assign(new Error("Choose a valid ticket status."), { status: 400, code: "PDM_BULK_STATUS_INVALID" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = await runPerTicket(client, ticketIds, async (ticketId, before) => {
      if (before.status === "Waiting Approval") throw Object.assign(new Error("Ticket is awaiting approval."), { status: 409 });
      if (before.status === "Closed") throw Object.assign(new Error("Closed tickets must be reopened through the governed reopen workflow."), { status: 409 });
      await client.query(`UPDATE tickets SET status=$1,updated_at=NOW(),resolved_at=CASE WHEN $1 IN ('Resolved','Closed') THEN COALESCE(resolved_at,NOW()) ELSE NULL END,closed_at=CASE WHEN $1='Closed' THEN COALESCE(closed_at,NOW()) ELSE NULL END WHERE id=$2`, [nextStatus, ticketId]);
      await history(client, ticketId, actorUserId, "bulk_status_change", before.status, JSON.stringify({ status: nextStatus, reason: reason || null }));
    });
    await client.query("COMMIT");
    return { results, updated: results.filter((item) => item.ok).length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { bulkAssign, bulkStatus };