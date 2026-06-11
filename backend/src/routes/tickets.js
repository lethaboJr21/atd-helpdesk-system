const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { sendTicketAssignmentEmail } = require("../services/email");

router.use(auth);

/**
 * ✅ Formats ticket age from created_at.
 */
function formatAge(createdAt) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 60) return `${mins}m`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;

  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

/**
 * ✅ Adds ticket history.
 * This is intentionally non-blocking so that ticket actions do not fail
 * just because history insert fails.
 */
async function addHistory(ticketId, actorId, action, oldValue, newValue) {
  try {
    await pool.query(
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
        oldValue === undefined || oldValue === null ? null : String(oldValue),
        newValue === undefined || newValue === null ? null : String(newValue),
      ]
    );
  } catch (err) {
    console.error("Ticket history insert failed:", err.message);
  }
}

/**
 * ✅ Generates a friendly ticket prefix.
 */
function getTicketPrefix({ title, workspace }) {
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
    lowerTitle.includes("create")
  ) {
    return "REQ";
  }

  return "INC";
}

/**
 * ✅ Gets support group email recipients.
 */
async function getGroupEmailRecipients(groupId) {
  if (!groupId) {
    return {
      groupName: null,
      emails: [],
    };
  }

  const { rows } = await pool.query(
    `
    SELECT
      g.name AS group_name,
      u.email AS email
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

/**
 * ✅ Gets direct assignee email.
 */
async function getAssigneeEmail(userId) {
  if (!userId) return null;

  const { rows } = await pool.query(
    `
    SELECT email
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return rows[0]?.email || null;
}

/**
 * ✅ Sends assignment email.
 * Email failure must not break ticket workflow.
 */
async function notifyTicketAssignment({ ticket, assignedGroupId, assignedToUserId }) {
  try {
    const groupInfo = await getGroupEmailRecipients(assignedGroupId);
    const assigneeEmail = await getAssigneeEmail(assignedToUserId);

    const recipients = [...groupInfo.emails];

    if (assigneeEmail) {
      recipients.push(assigneeEmail);
    }

    await sendTicketAssignmentEmail({
      recipients,
      ticket,
      groupName: groupInfo.groupName,
    });
  } catch (emailErr) {
    console.error("Ticket assignment email failed:", emailErr.message);
  }
}

/**
 * ✅ GET /api/tickets
 * Returns tickets visible to current user.
 */
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
    i++;
  }

  /**
   * ✅ Normal users only see tickets they requested.
   */
  if (req.user.role === "user") {
    where.push(`t.requester_id = $${i++}`);
    params.push(req.user.id);
  }

  /**
   * ✅ Agents see:
   * - directly assigned tickets
   * - group tickets for groups they belong to
   * - unassigned tickets
   */
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
    i++;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

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
      [...params, Number(limit), Number(offset)]
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

/**
 * ✅ GET /api/tickets/my-tickets
 * Returns tickets requested by or assigned to current user.
 */
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

/**
 * ✅ GET /api/tickets/:id
 * Returns one ticket with requester, assignee, and group details.
 */
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

/**
 * ✅ POST /api/tickets
 * Creates a ticket.
 * Rule: requester must choose either support group or direct assignee.
 */
router.post(
  "/",
  allowRoles("superadmin", "admin", "agent", "user", "operator", "manager"),
  async (req, res) => {
    const {
      title,
      description,
      priority,
      workspace,
      assignedGroupId,
      assignedToUserId,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        error: "title is required",
      });
    }

    if (!assignedGroupId && !assignedToUserId) {
      return res.status(400).json({
        error: "Please choose either a support group or an assignee.",
      });
    }
    
        const duplicateCheck = await pool.query(
      `
      SELECT id, ticket_ref, title, created_at
      FROM tickets
      WHERE
        requester_id = $1
        AND LOWER(title) = LOWER($2)
        AND created_at > NOW() - INTERVAL '30 seconds'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [req.user.id, title.trim()]
    );
    
    if (duplicateCheck.rows[0]) {
      return res.status(409).json({
        error:
          "A similar ticket was just created. Please wait before submitting again.",
        ticket: duplicateCheck.rows[0],
      });
    }
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const seqResult = await client.query(
        "SELECT nextval(pg_get_serial_sequence('tickets', 'id')) AS next_id"
      );

      const nextId = seqResult.rows[0].next_id;
      const prefix = getTicketPrefix({ title, workspace });
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
          title.trim(),
          description || "",
          req.user.id,
          req.user.id,
          priority || "Medium",
          workspace || "IT",
          assignedGroupId || null,
          assignedToUserId || null,
        ]
      );

      const createdTicket = rows[0];

      await client.query(
        `
        INSERT INTO ticket_history (
          ticket_id,
          actor_user_id,
          action,
          old_value,
          new_value
        )
        VALUES ($1, $2, 'created', NULL, $3)
        `,
        [createdTicket.id, req.user.id, "Open"]
      );

      await client.query("COMMIT");

      await notifyTicketAssignment({
        ticket: createdTicket,
        assignedGroupId,
        assignedToUserId,
      });

      return res.status(201).json({
        ...createdTicket,
        age: "0m",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Create ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  }
);

/**
 * ✅ PUT /api/tickets/:id
 * Updates editable ticket fields.
 */
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

    try {
      const oldTicket = await pool.query(
        `
        SELECT *
        FROM tickets
        WHERE id = $1
        `,
        [req.params.id]
      );

      if (!oldTicket.rows[0]) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await pool.query(
        `
        UPDATE tickets
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          priority = COALESCE($3, priority),
          status = COALESCE($4, status),
          workspace = COALESCE($5, workspace),
          assigned_group_id = COALESCE($6, assigned_group_id),
          assigned_to_user_id = COALESCE($7, assigned_to_user_id),
          due_at = COALESCE($8, due_at),
          closed_at = CASE WHEN $4 = 'Closed' THEN NOW() ELSE closed_at END,
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
        `,
        [
          title,
          description,
          priority,
          status,
          workspace,
          assignedGroupId,
          assignedToUserId,
          dueAt,
          req.params.id,
        ]
      );

      await addHistory(
        req.params.id,
        req.user.id,
        "updated",
        JSON.stringify(oldTicket.rows[0]),
        JSON.stringify(rows[0])
      );

      return res.json({
        ...rows[0],
        age: formatAge(rows[0].created_at),
      });
    } catch (err) {
      console.error("Update ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * ✅ PATCH /api/tickets/:id/status
 * Updates ticket status.
 */
router.patch(
  "/:id/status",
  allowRoles("superadmin", "admin", "agent", "manager"),
  async (req, res) => {
    const { status } = req.body;

    const allowedStatuses = [
      "Open",
      "Pending",
      "Assigned",
      "Investigating",
      "Waiting Approval",
      "Resolved",
      "Closed",
      "Escalated",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    try {
      const oldTicket = await pool.query(
        "SELECT status FROM tickets WHERE id = $1",
        [req.params.id]
      );

      if (!oldTicket.rows[0]) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await pool.query(
        `
        UPDATE tickets
        SET
          status = $1,
          closed_at = CASE WHEN $1 = 'Closed' THEN NOW() ELSE closed_at END,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, req.params.id]
      );

      await addHistory(
        req.params.id,
        req.user.id,
        "status_changed",
        oldTicket.rows[0].status,
        status
      );

      return res.json(rows[0]);
    } catch (err) {
      console.error("Status update error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * ✅ POST /api/tickets/:id/assign
 * Assigns ticket to group and/or user.
 */
router.post(
  "/:id/assign",
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    const { assignedToUserId, assignedGroupId } = req.body;

    if (!assignedToUserId && !assignedGroupId) {
      return res.status(400).json({
        error: "assignedToUserId or assignedGroupId is required",
      });
    }

    try {
      const oldTicket = await pool.query(
        `
        SELECT assigned_to_user_id, assigned_group_id
        FROM tickets
        WHERE id = $1
        `,
        [req.params.id]
      );

      if (!oldTicket.rows[0]) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await pool.query(
        `
        UPDATE tickets
        SET
          assigned_to_user_id = COALESCE($1, assigned_to_user_id),
          assigned_group_id = COALESCE($2, assigned_group_id),
          status = 'Assigned',
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [assignedToUserId || null, assignedGroupId || null, req.params.id]
      );

      const updatedTicket = rows[0];

      await addHistory(
        req.params.id,
        req.user.id,
        "assigned",
        JSON.stringify(oldTicket.rows[0]),
        JSON.stringify({
          assigned_to_user_id: updatedTicket.assigned_to_user_id,
          assigned_group_id: updatedTicket.assigned_group_id,
        })
      );

      await notifyTicketAssignment({
        ticket: updatedTicket,
        assignedGroupId: updatedTicket.assigned_group_id,
        assignedToUserId: updatedTicket.assigned_to_user_id,
      });

      return res.json(updatedTicket);
    } catch (err) {
      console.error("Assign ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * ✅ PATCH /api/tickets/:id/resolve
 * Resolves ticket.
 */
router.patch(
  "/:id/resolve",
  allowRoles("superadmin", "admin", "agent", "manager"),
  async (req, res) => {
    try {
      const oldTicket = await pool.query(
        "SELECT status FROM tickets WHERE id = $1",
        [req.params.id]
      );

      if (!oldTicket.rows[0]) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await pool.query(
        `
        UPDATE tickets
        SET
          status = 'Resolved',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [req.params.id]
      );

      await addHistory(
        req.params.id,
        req.user.id,
        "resolved",
        oldTicket.rows[0].status,
        "Resolved"
      );

      return res.json(rows[0]);
    } catch (err) {
      console.error("Resolve ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * ✅ PATCH /api/tickets/:id/close
 * Closes ticket.
 */
router.patch(
  "/:id/close",
  allowRoles("superadmin", "admin", "manager"),
  async (req, res) => {
    try {
      const oldTicket = await pool.query(
        "SELECT status FROM tickets WHERE id = $1",
        [req.params.id]
      );

      if (!oldTicket.rows[0]) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { rows } = await pool.query(
        `
        UPDATE tickets
        SET
          status = 'Closed',
          closed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [req.params.id]
      );

      await addHistory(
        req.params.id,
        req.user.id,
        "closed",
        oldTicket.rows[0].status,
        "Closed"
      );

      return res.json(rows[0]);
    } catch (err) {
      console.error("Close ticket error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;