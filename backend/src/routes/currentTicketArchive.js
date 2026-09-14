const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const router = express.Router();
router.use(auth);

const clean = (value, limit = 1000) => String(value ?? "").trim().slice(0, limit);
const positiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const RESTORE_ROLES = new Set(["manager", "admin", "superadmin"]);
const DELETE_ROLE = "superadmin";

async function authorityFor(database, user, ticketAlias = "t") {
  if (["admin", "superadmin"].includes(user.role)) return { sql: "TRUE", values: [] };
  if (["agent", "operator"].includes(user.role)) {
    return {
      sql: `(${ticketAlias}.assigned_to_user_id = $1 OR ${ticketAlias}.assigned_group_id IN
        (SELECT group_id FROM support_group_members WHERE user_id = $1))`,
      values: [user.id],
    };
  }
  if (user.role === "manager") {
    const manager = await database.query("SELECT NULLIF(department,'') AS department FROM users WHERE id=$1", [user.id]);
    const department = manager.rows[0]?.department || "";
    return {
      sql: `(${ticketAlias}.assigned_to_user_id = $1
        OR ${ticketAlias}.assigned_group_id IN (SELECT group_id FROM support_group_members WHERE user_id = $1)
        OR EXISTS (SELECT 1 FROM users requester WHERE requester.id = ${ticketAlias}.requester_id
          AND NULLIF(requester.department,'') = NULLIF($2,'')))`,
      values: [user.id, department],
    };
  }
  return { sql: `${ticketAlias}.requester_id = $1`, values: [user.id] };
}

async function loadArchivedTicket(database, ticketId, user, lock = false) {
  const authority = await authorityFor(database, user);
  const idParameter = authority.values.length + 1;
  const result = await database.query(`SELECT t.*, requester.name AS requester_name, requester.email AS requester_email,
      requester.department AS requester_department, assignee.name AS assignee_name,
      support_group.name AS support_group_name, archive_actor.name AS archived_by_name
    FROM tickets t
    LEFT JOIN users requester ON requester.id=t.requester_id
    LEFT JOIN users assignee ON assignee.id=t.assigned_to_user_id
    LEFT JOIN support_groups support_group ON support_group.id=t.assigned_group_id
    LEFT JOIN users archive_actor ON archive_actor.id=t.archived_by_user_id
    WHERE t.id=$${idParameter} AND t.archived_at IS NOT NULL AND ${authority.sql}
    ${lock ? "FOR UPDATE OF t" : ""}`, [...authority.values, ticketId]);
  return result.rows[0] || null;
}

router.get("/", async (req, res, next) => {
  try {
    const authority = await authorityFor(pool, req.user);
    const values = [...authority.values];
    const where = ["t.archived_at IS NOT NULL", authority.sql];
    const view = clean(req.query.view || "archived", 30).toLowerCase();
    if (!["archived", "pending-deletion", "all"].includes(view)) {
      return res.status(400).json({ error: "Invalid archive view." });
    }
    if (view === "archived") where.push("t.archived_at > NOW() - INTERVAL '7 days'");
    if (view === "pending-deletion") where.push("t.archived_at <= NOW() - INTERVAL '7 days'");
    const add = (clause, value) => { values.push(value); where.push(clause.replace("$PARAM", `$${values.length}`)); };
    const queryText = clean(req.query.q, 120);
    if (queryText) {
      values.push(`%${queryText}%`);
      const p = `$${values.length}`;
      where.push(`(t.ticket_ref ILIKE ${p} OR t.title ILIKE ${p} OR requester.name ILIKE ${p})`);
    }
    if (req.query.priority) add("t.priority=$PARAM", clean(req.query.priority, 30));
    if (req.query.department) add("requester.department=$PARAM", clean(req.query.department, 120));
    if (req.query.workspace) add("t.workspace=$PARAM", clean(req.query.workspace, 120));
    if (req.query.status) add("t.status=$PARAM", clean(req.query.status, 40));
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 10), 100);
    const offset = (page - 1) * limit;
    values.push(limit, offset);
    const result = await pool.query(`SELECT t.id,t.ticket_ref,t.title,t.status,t.priority,t.workspace,
      t.archived_at,t.archive_reason,t.reopen_count,requester.name requester_name,
      requester.department requester_department,assignee.name assignee_name,
      support_group.name support_group_name,archive_actor.name archived_by_name,
      (t.archived_at + INTERVAL '7 days') AS grace_expires_at,
      GREATEST(EXTRACT(EPOCH FROM ((t.archived_at + INTERVAL '7 days') - NOW())),0)::bigint AS grace_seconds_remaining,
      (t.archived_at <= NOW() - INTERVAL '7 days') AS pending_deletion,
      COUNT(*) OVER()::int total_count
      FROM tickets t
      LEFT JOIN users requester ON requester.id=t.requester_id
      LEFT JOIN users assignee ON assignee.id=t.assigned_to_user_id
      LEFT JOIN support_groups support_group ON support_group.id=t.assigned_group_id
      LEFT JOIN users archive_actor ON archive_actor.id=t.archived_by_user_id
      WHERE ${where.join(" AND ")}
      ORDER BY t.archived_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json({
      tickets: result.rows,
      page,
      limit,
      total: result.rows[0]?.total_count || 0,
      view,
      permissions: {
        canRestore: RESTORE_ROLES.has(req.user.role),
        canPermanentlyDelete: req.user.role === DELETE_ROLE,
      },
    });
  } catch (error) {
    if (error.code === "42P01") return res.status(503).json({ code: "CURRENT_ARCHIVE_SCHEMA_PENDING", error: "Current-ticket archive storage is pending migration." });
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const ticket = await loadArchivedTicket(pool, positiveInteger(req.params.id), req.user);
    if (!ticket) return res.status(404).json({ error: "Archived ticket not found or outside your authority." });
    const history = await pool.query(`SELECT history.*,actor.name actor_name FROM ticket_history history
      LEFT JOIN users actor ON actor.id=history.actor_user_id WHERE history.ticket_id=$1
      ORDER BY history.created_at DESC,history.id DESC`, [ticket.id]);
    let cycles = [];
    try { cycles = (await pool.query("SELECT * FROM ticket_resolution_cycles WHERE ticket_id=$1 ORDER BY cycle_number DESC", [ticket.id])).rows; }
    catch (error) { if (error.code !== "42P01") throw error; }
    res.json({ ...ticket, history: history.rows, resolution_cycles: cycles,
      grace_expires_at: new Date(new Date(ticket.archived_at).getTime() + 7 * 86400000).toISOString(),
      pending_deletion: Date.now() >= new Date(ticket.archived_at).getTime() + 7 * 86400000,
      permissions: { canRestore: RESTORE_ROLES.has(req.user.role), canPermanentlyDelete: req.user.role === DELETE_ROLE } });
  } catch (error) { next(error); }
});

router.post("/:id/restore", async (req, res, next) => {
  if (!RESTORE_ROLES.has(req.user.role)) return res.status(403).json({ error: "Restore requires Manager, Administrator, or Superadministrator authority." });
  const reason = clean(req.body.reason);
  if (reason.length < 5) return res.status(400).json({ error: "Provide a restore reason of at least 5 characters." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticket = await loadArchivedTicket(client, positiveInteger(req.params.id), req.user, true);
    if (!ticket) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Archived ticket not found or outside your restore authority." }); }
    await client.query("UPDATE tickets SET archived_at=NULL,archived_by_user_id=NULL,archive_reason=NULL,updated_at=NOW() WHERE id=$1", [ticket.id]);
    await client.query("INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value) VALUES($1,$2,'ticket_restored',$3,$4)", [ticket.id,req.user.id,ticket.archive_reason,reason]);
    await client.query("COMMIT");
    res.json({ message: "Ticket restored to active queues.", ticketId: ticket.id });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { client.release(); }
});

router.delete("/:id", async (req, res, next) => {
  if (req.user.role !== DELETE_ROLE) return res.status(403).json({ error: "Permanent deletion requires Superadministrator authority." });
  const reason = clean(req.body.reason);
  const confirmation = clean(req.body.confirmation, 120);
  if (reason.length < 10) return res.status(400).json({ error: "Provide a deletion reason of at least 10 characters." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticket = await loadArchivedTicket(client, positiveInteger(req.params.id), req.user, true);
    if (!ticket) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Archived ticket not found." }); }
    const graceExpiresAt = new Date(ticket.archived_at).getTime() + 7 * 86400000;
    if (Date.now() < graceExpiresAt) { await client.query("ROLLBACK"); return res.status(409).json({ code: "ARCHIVE_GRACE_PERIOD_ACTIVE", error: "Permanent deletion is unavailable until the seven-day archive grace period ends." }); }
    if (confirmation !== `DELETE ${ticket.ticket_ref}`) { await client.query("ROLLBACK"); return res.status(400).json({ error: `Type DELETE ${ticket.ticket_ref} to confirm permanent deletion.` }); }
    const protectedProposal = await client.query("SELECT 1 FROM ticket_assignment_proposals WHERE ticket_id=$1 AND status IN ('group_queue','proposed','accepted') LIMIT 1", [ticket.id]);
    if (protectedProposal.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({ code: "TICKET_DELETE_PROTECTED", error: "Resolve active assignment proposals before permanent deletion." }); }
    await client.query(`INSERT INTO ticket_deletion_tombstones
      (ticket_id,ticket_ref,title,requester_id,deleted_by_user_id,deletion_reason,ticket_snapshot)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, [ticket.id,ticket.ticket_ref,ticket.title,ticket.requester_id,req.user.id,reason,JSON.stringify(ticket)]);
    await client.query("DELETE FROM tickets WHERE id=$1", [ticket.id]);
    await client.query("COMMIT");
    res.json({ message: "Ticket permanently deleted with tombstone evidence." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "42P01") return res.status(503).json({ code: "CURRENT_ARCHIVE_SCHEMA_PENDING", error: "Current-ticket archive storage is pending migration." });
    if (error.code === "23503") return res.status(409).json({ code: "TICKET_DELETE_PROTECTED", error: "Protected ticket dependencies prevent permanent deletion." });
    next(error);
  } finally { client.release(); }
});
module.exports = router;
