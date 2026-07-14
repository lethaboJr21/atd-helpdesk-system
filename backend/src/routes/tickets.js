const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { sendTicketAssignmentEmail } = require("../services/email");

router.use(auth);

const STATUS_MAP = {
  open: "Open",
  assigned: "Assigned",
  pending: "Pending",
  investigating: "Investigating",
  "waiting approval": "Waiting Approval",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
};

const PRIORITY_MAP = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const TICKET_TYPE_PREFIX = {
  incident: "INC",
  request: "REQ",
  service_request: "REQ",
  change: "CHG",
};

function normalizeStatus(status) {
  if (!status) return null;
  return STATUS_MAP[String(status).trim().toLowerCase()] || null;
}

function normalizePriority(priority) {
  if (!priority) return null;
  return PRIORITY_MAP[String(priority).trim().toLowerCase()] || null;
}

function normalizeNullableId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatAge(createdAt) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "N/A";

  const diffMs = Math.max(0, Date.now() - created);
  const mins = Math.floor(diffMs / 60000);

  if (mins < 60) return `${mins}m`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;

  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

/**
 * Writes ticket history using the supplied database executor.
 *
 * IMPORTANT:
 * When the caller already has an open transaction, pass that transaction's
 * client here. Using pool.query() while another client holds a row lock on the
 * same ticket can make PostgreSQL wait on itself through the foreign-key check.
 */
async function addHistory(
  db,
  ticketId,
  actorId,
  action,
  oldValue,
  newValue
) {
  const savepointName = "ticket_history_write";

  try {
    // The history write is protected by a savepoint. If history fails, the
    // ticket transaction can still commit instead of becoming aborted.
    await db.query(`SAVEPOINT ${savepointName}`);

    await db.query(
      `
      INSERT INTO ticket_history (
        ticket_id,
        actor_user_id,
        action,
        old_value,
        new_value
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        ticketId,
        actorId || null,
        action,
        oldValue === undefined || oldValue === null
          ? null
          : String(oldValue),
        newValue === undefined || newValue === null
          ? null
          : String(newValue),
      ]
    );

    await db.query(`RELEASE SAVEPOINT ${savepointName}`);
    return true;
  } catch (err) {
    try {
      await db.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      await db.query(`RELEASE SAVEPOINT ${savepointName}`);
    } catch (savepointErr) {
      console.error("Ticket history savepoint recovery failed:", {
        ticketId,
        message: savepointErr.message,
      });
      throw err;
    }

    console.error("Ticket history insert failed; ticket change will continue:", {
      ticketId,
      action,
      message: err.message,
      code: err.code,
    });

    return false;
  }
}

function getTicketPrefix({ ticketType, title, workspace }) {
  const normalizedType = String(ticketType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (TICKET_TYPE_PREFIX[normalizedType]) {
    return TICKET_TYPE_PREFIX[normalizedType];
  }

  const lowerTitle = String(title || "").toLowerCase();
  const lowerWorkspace = String(workspace || "").toLowerCase();

  if (lowerWorkspace.includes("change") || lowerTitle.includes("change")) {
    return "CHG";
  }

  if (
    lowerWorkspace.includes("request") ||
    lowerTitle.includes("request") ||
    lowerTitle.includes("access") ||
    lowerTitle.includes("laptop") ||
    lowerTitle.includes("create") ||
    lowerTitle.includes("install")
  ) {
    return "REQ";
  }

  return "INC";
}

async function getGroupEmailRecipients(groupId) {
  if (!groupId) {
    return { groupName: null, emails: [] };
  }

  const { rows } = await pool.query(
    `
    SELECT
      g.name AS group_name,
      u.email
    FROM support_groups g
    LEFT JOIN support_group_members gm ON gm.group_id = g.id
    LEFT JOIN users u ON u.id = gm.user_id
    WHERE g.id = $1
    `,
    [groupId]
  );

  return {
    groupName: rows[0]?.group_name || null,
    emails: rows.map((row) => row.email).filter(Boolean),
  };
}

async function getAssigneeEmail(userId) {
  if (!userId) return null;

  const { rows } = await pool.query(
    `SELECT email FROM users WHERE id = $1`,
    [userId]
  );

  return rows[0]?.email || null;
}

async function notifyTicketAssignment({
  ticket,
  assignedGroupId,
  assignedToUserId,
}) {
  try {
    const groupInfo = await getGroupEmailRecipients(assignedGroupId);
    const assigneeEmail = await getAssigneeEmail(assignedToUserId);
    const recipients = [...groupInfo.emails];

    if (assigneeEmail) recipients.push(assigneeEmail);

    await sendTicketAssignmentEmail({
      recipients,
      ticket,
      groupName: groupInfo.groupName,
    });
  } catch (emailErr) {
    console.error("Ticket assignment email failed:", emailErr.message);
  }
}

router.get("/", async (req, res) => {
  const {
    search,
    status,
    priority,
    workspace,
    groupId,
    limit = 50,
    offset = 0,
  } = req.query;

  const where = [];
  const params = [];
  let i = 1;

  if (status) {
    where.push(`t.status = $${i++}`);
    params.push(status);
  }

  if (priority) {
    where.push(`t.priority = $${i++}`);
    params.push(priority);
  }

  if (workspace) {
    where.push(`t.workspace = $${i++}`);
    params.push(workspace);
  }

  if (groupId) {
    where.push(`t.assigned_group_id = $${i++}`);
    params.push(groupId);
  }

  if (search) {
    where.push(`
      (
        t.ticket_ref ILIKE $${i}
        OR t.title ILIKE $${i}
        OR t.description ILIKE $${i}
        OR t.priority ILIKE $${i}
        OR t.status ILIKE $${i}
        OR t.workspace ILIKE $${i}
        OR requester.name ILIKE $${i}
        OR requester.email ILIKE $${i}
        OR assignee.name ILIKE $${i}
        OR assignee.email ILIKE $${i}
        OR g.name ILIKE $${i}
      )
    `);

    params.push(`%${search}%`);
    i += 1;
  }

  if (req.user.role === "user") {
    where.push(`t.requester_id = $${i++}`);
    params.push(req.user.id);
  }

  if (req.user.role === "agent") {
    where.push(`
      (
        t.assigned_to_user_id = $${i}
        OR t.assigned_to_user_id IS NULL
        OR t.assigned_group_id IN (
          SELECT group_id
          FROM support_group_members
          WHERE user_id = $${i}
        )
      )
    `);

    params.push(req.user.id);
    i += 1;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.*,
        requester.name AS requester_name,
        requester.email AS requester_email,
        assignee.name AS assigned_to_name,
        assignee.email AS assigned_to_email,
        g.name AS assigned_group_name
      FROM tickets t
      LEFT JOIN users requester ON requester.id = t.requester_id
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      LEFT JOIN support_groups g ON g.id = t.assigned_group_id
      ${whereClause}
      ORDER BY
        CASE t.priority
          WHEN 'Critical' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          WHEN 'Low' THEN 4
          ELSE 5
        END,
        t.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...params, safeLimit, safeOffset]
    );

    return res.json(
      rows.map((ticket) => ({
        ...ticket,
        age: formatAge(ticket.created_at),
      }))
    );
  } catch (err) {
    console.error("Fetch tickets error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/my-tickets", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.*,
        requester.name AS requester_name,
        requester.email AS requester_email,
        assignee.name AS assigned_to_name,
        assignee.email AS assigned_to_email,
        g.name AS assigned_group_name
      FROM tickets t
      LEFT JOIN users requester ON requester.id = t.requester_id
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      LEFT JOIN support_groups g ON g.id = t.assigned_group_id
      WHERE
        t.requester_id = $1
        OR t.assigned_to_user_id = $1
        OR t.assigned_group_id IN (
          SELECT group_id
          FROM support_group_members
          WHERE user_id = $1
        )
      ORDER BY t.created_at DESC
      `,
      [req.user.id]
    );

    return res.json(
      rows.map((ticket) => ({
        ...ticket,
        age: formatAge(ticket.created_at),
      }))
    );
  } catch (err) {
    console.error("My tickets error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.*,
        requester.name AS requester_name,
        requester.email AS requester_email,
        assignee.name AS assigned_to_name,
        assignee.email AS assigned_to_email,
        g.name AS assigned_group_name
      FROM tickets t
      LEFT JOIN users requester ON requester.id = t.requester_id
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      LEFT JOIN support_groups g ON g.id = t.assigned_group_id
      WHERE t.id = $1
      `,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.json({
      ...rows[0],
      age: formatAge(rows[0].created_at),
    });
  } catch (err) {
    console.error("Get ticket error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post(
  "/",
  allowRoles("superadmin", "admin", "agent", "user", "operator", "manager"),
  async (req, res) => {
    const {
      ticketType,
      title,
      description,
      priority,
      workspace,
      assignedGroupId,
      assignedToUserId,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    if (!assignedGroupId && !assignedToUserId) {
      return res.status(400).json({
        error: "Please choose either a support group or an assignee.",
      });
    }

    try {
      const duplicateCheck = await pool.query(
        `
        SELECT id, ticket_ref, title, created_at
        FROM tickets
        WHERE requester_id = $1
          AND LOWER(title) = LOWER($2)
          AND created_at > NOW() - INTERVAL '30 seconds'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [req.user.id, String(title).trim()]
      );

      if (duplicateCheck.rows[0]) {
        return res.status(409).json({
          error:
            "A similar ticket was just created. Please wait before submitting again.",
          ticket: duplicateCheck.rows[0],
        });
      }
    } catch (err) {
      console.error("Duplicate ticket check failed:", err);
      return res.status(500).json({ error: "Server error" });
    }

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      // Prevent any accidental lock from hanging this request indefinitely.
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '15s'");

      const seqResult = await client.query(
        "SELECT nextval(pg_get_serial_sequence('tickets', 'id')) AS next_id"
      );

      const nextId = seqResult.rows[0].next_id;
      const prefix = getTicketPrefix({ ticketType, title, workspace });
      const ticketRef = `${prefix}-${String(nextId).padStart(5, "0")}`;

      const { rows } = await client.query(
        `
        INSERT INTO tickets (
          id,
          ticket_ref,
          title,
          description,
          requester_id,
          created_by_user_id,
          priority,
          status,
          workspace,
          assigned_group_id,
          assigned_to_user_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'Open',$8,$9,$10)
        RETURNING *
        `,
        [
          nextId,
          ticketRef,
          String(title).trim(),
          description || "",
          req.user.id,
          req.user.id,
          normalizePriority(priority) || "Medium",
          workspace || "IT",
          normalizeNullableId(assignedGroupId),
          normalizeNullableId(assignedToUserId),
        ]
      );

      const createdTicket = rows[0];

      await addHistory(
        client,
        createdTicket.id,
        req.user.id,
        "created",
        null,
        "Open"
      );

      await client.query("COMMIT");
      transactionOpen = false;

      notifyTicketAssignment({
        ticket: createdTicket,
        assignedGroupId: createdTicket.assigned_group_id,
        assignedToUserId: createdTicket.assigned_to_user_id,
      }).catch((err) => {
        console.error("Ticket creation email background failure:", err.message);
      });

      return res.status(201).json({
        ...createdTicket,
        age: "0m",
      });
    } catch (err) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Create ticket rollback failed:", rollbackErr.message);
        }
      }

      console.error("Create ticket error:", err);

      if (err.code === "55P03" || err.code === "57014") {
        return res.status(409).json({
          error: "The ticket database is busy. Please try again in a few seconds.",
        });
      }

      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id",
  allowRoles("superadmin", "admin", "agent", "manager"),
  async (req, res) => {
    const {
      title,
      description,
      priority,
      status,
      workspace,
      assignedGroupId,
      assignedToUserId,
      dueAt,
    } = req.body;

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      console.log("Updating ticket:", req.params.id);

      await client.query("BEGIN");
      transactionOpen = true;

      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '15s'");

      const oldTicketResult = await client.query(
        `
        SELECT *
        FROM tickets
        WHERE id = $1
        FOR UPDATE
        `,
        [req.params.id]
      );

      const oldTicket = oldTicketResult.rows[0];

      if (!oldTicket) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(404).json({ error: "Ticket not found" });
      }

      const nextTitle =
        title === undefined ? oldTicket.title : String(title).trim();

      if (!nextTitle) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(400).json({ error: "Ticket title is required" });
      }

      const nextDescription =
        description === undefined ? oldTicket.description : description || "";

      const nextPriority =
        priority === undefined ? oldTicket.priority : normalizePriority(priority);

      if (!nextPriority) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(400).json({ error: "Invalid priority" });
      }

      const nextStatus =
        status === undefined ? oldTicket.status : normalizeStatus(status);

      if (!nextStatus) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(400).json({ error: "Invalid status" });
      }

      const nextWorkspace =
        workspace === undefined ? oldTicket.workspace : workspace || "IT";

      const normalizedGroupId = normalizeNullableId(assignedGroupId);
      const normalizedUserId = normalizeNullableId(assignedToUserId);

      const nextAssignedGroupId =
        assignedGroupId === undefined
          ? oldTicket.assigned_group_id
          : normalizedGroupId;

      const nextAssignedToUserId =
        assignedToUserId === undefined
          ? oldTicket.assigned_to_user_id
          : normalizedUserId;

      const nextDueAt =
        dueAt === undefined ? oldTicket.due_at : dueAt || null;

      const nextClosedAt =
        nextStatus === "Closed"
          ? oldTicket.closed_at || new Date()
          : nextStatus === "Resolved"
          ? oldTicket.closed_at
          : null;

      const updatedResult = await client.query(
        `
        UPDATE tickets
        SET
          title = $1,
          description = $2,
          priority = $3,
          status = $4,
          workspace = $5,
          assigned_group_id = $6,
          assigned_to_user_id = $7,
          due_at = $8,
          closed_at = $9,
          updated_at = NOW()
        WHERE id = $10
        RETURNING *
        `,
        [
          nextTitle,
          nextDescription,
          nextPriority,
          nextStatus,
          nextWorkspace,
          nextAssignedGroupId,
          nextAssignedToUserId,
          nextDueAt,
          nextClosedAt,
          req.params.id,
        ]
      );

      const updatedTicket = updatedResult.rows[0];

      // Critical fix: use the SAME transaction client that updated the ticket.
      // This prevents the ticket_history foreign-key insert from waiting on the
      // uncommitted ticket row owned by this transaction.
      await addHistory(
        client,
        req.params.id,
        req.user.id,
        "updated",
        JSON.stringify(oldTicket),
        JSON.stringify(updatedTicket)
      );

      await client.query("COMMIT");
      transactionOpen = false;

      console.log("Ticket transaction committed:", req.params.id);

      const assignmentChanged =
        String(oldTicket.assigned_group_id || "") !==
          String(updatedTicket.assigned_group_id || "") ||
        String(oldTicket.assigned_to_user_id || "") !==
          String(updatedTicket.assigned_to_user_id || "");

      if (assignmentChanged) {
        notifyTicketAssignment({
          ticket: updatedTicket,
          assignedGroupId: updatedTicket.assigned_group_id,
          assignedToUserId: updatedTicket.assigned_to_user_id,
        }).catch((err) => {
          console.error("Assignment email background failure:", err.message);
        });
      }

      return res.json({
        ...updatedTicket,
        age: formatAge(updatedTicket.created_at),
      });
    } catch (err) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Update ticket rollback failed:", rollbackErr.message);
        }
      }

      console.error("Update ticket error:", {
        ticketId: req.params.id,
        message: err.message,
        code: err.code,
        detail: err.detail,
      });

      if (err.code === "55P03" || err.code === "57014") {
        return res.status(409).json({
          error: "This ticket is busy. Please wait a few seconds and try again.",
        });
      }

      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/:id/status",
  allowRoles("superadmin", "admin", "agent", "manager"),
  async (req, res) => {
    const normalizedStatus = normalizeStatus(req.body.status);

    if (!normalizedStatus) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query("SET LOCAL lock_timeout = '5s'");

      const oldTicketResult = await client.query(
        `SELECT status FROM tickets WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );

      if (!oldTicketResult.rows[0]) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await client.query(
        `
        UPDATE tickets
        SET
          status = $1,
          closed_at = CASE
            WHEN $1 = 'Closed' THEN COALESCE(closed_at, NOW())
            WHEN $1 IN ('Resolved') THEN closed_at
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [normalizedStatus, req.params.id]
      );

      await addHistory(
        client,
        req.params.id,
        req.user.id,
        "status_changed",
        oldTicketResult.rows[0].status,
        normalizedStatus
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return res.json(rows[0]);
    } catch (err) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Status rollback failed:", rollbackErr.message);
        }
      }

      console.error("Status update error:", err);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/:id/assign",
  allowRoles("superadmin", "admin", "agent", "manager"),
  async (req, res) => {
    const assignedToUserId = normalizeNullableId(req.body.assignedToUserId);
    const assignedGroupId = normalizeNullableId(req.body.assignedGroupId);

    if (!assignedToUserId && !assignedGroupId) {
      return res.status(400).json({
        error: "assignedToUserId or assignedGroupId is required",
      });
    }

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query("SET LOCAL lock_timeout = '5s'");

      const oldTicketResult = await client.query(
        `
        SELECT assigned_to_user_id, assigned_group_id
        FROM tickets
        WHERE id = $1
        FOR UPDATE
        `,
        [req.params.id]
      );

      if (!oldTicketResult.rows[0]) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(404).json({ error: "Ticket not found" });
      }

      const oldTicket = oldTicketResult.rows[0];
      const nextAssignedGroupId =
        assignedGroupId || oldTicket.assigned_group_id || null;

      const { rows } = await client.query(
        `
        UPDATE tickets
        SET
          assigned_to_user_id = $1,
          assigned_group_id = $2,
          status = 'Assigned',
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [assignedToUserId || null, nextAssignedGroupId, req.params.id]
      );

      const updatedTicket = rows[0];

      await addHistory(
        client,
        req.params.id,
        req.user.id,
        "assigned",
        JSON.stringify(oldTicket),
        JSON.stringify({
          assigned_to_user_id: updatedTicket.assigned_to_user_id,
          assigned_group_id: updatedTicket.assigned_group_id,
        })
      );

      await client.query("COMMIT");
      transactionOpen = false;

      notifyTicketAssignment({
        ticket: updatedTicket,
        assignedGroupId: updatedTicket.assigned_group_id,
        assignedToUserId: updatedTicket.assigned_to_user_id,
      }).catch((err) => {
        console.error("Assignment email background failure:", err.message);
      });

      return res.json({
        ...updatedTicket,
        age: formatAge(updatedTicket.created_at),
      });
    } catch (err) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Assignment rollback failed:", rollbackErr.message);
        }
      }

      console.error("Assign ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/:id/resolve",
  allowRoles("superadmin", "admin", "agent", "manager"),
  async (req, res) => {
    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query("SET LOCAL lock_timeout = '5s'");

      const oldTicketResult = await client.query(
        `SELECT status FROM tickets WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );

      if (!oldTicketResult.rows[0]) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await client.query(
        `
        UPDATE tickets
        SET status = 'Resolved', updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [req.params.id]
      );

      await addHistory(
        client,
        req.params.id,
        req.user.id,
        "resolved",
        oldTicketResult.rows[0].status,
        "Resolved"
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return res.json(rows[0]);
    } catch (err) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Resolve rollback failed:", rollbackErr.message);
        }
      }

      console.error("Resolve ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/:id/close",
  allowRoles("superadmin", "admin", "agent", "manager"),
  async (req, res) => {
    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query("SET LOCAL lock_timeout = '5s'");

      const oldTicketResult = await client.query(
        `SELECT status FROM tickets WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );

      if (!oldTicketResult.rows[0]) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await client.query(
        `
        UPDATE tickets
        SET status = 'Closed', closed_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [req.params.id]
      );

      await addHistory(
        client,
        req.params.id,
        req.user.id,
        "closed",
        oldTicketResult.rows[0].status,
        "Closed"
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return res.json(rows[0]);
    } catch (err) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Close rollback failed:", rollbackErr.message);
        }
      }

      console.error("Close ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
