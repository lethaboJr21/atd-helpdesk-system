const router = require("express").Router();

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const {
  sendTicketAssignmentEmail,
} = require("../services/email");
const {
  createTicketAssignmentNotifications,
} = require("../services/notificationService");

router.use(auth);

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);

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

const TICKET_SELECT = `
  SELECT
    t.*,
    requester.name AS requester_name,
    requester.email AS requester_email,
    requester.employee_number AS requester_employee_number,
    assignee.name AS assigned_to_name,
    assignee.email AS assigned_to_email,
    g.name AS assigned_group_name
  FROM tickets t
  LEFT JOIN users requester
    ON requester.id = t.requester_id
  LEFT JOIN users assignee
    ON assignee.id = t.assigned_to_user_id
  LEFT JOIN support_groups g
    ON g.id = t.assigned_group_id
`;

function normalizeStatus(status) {
  if (!status) {
    return null;
  }

  return STATUS_MAP[
    String(status).trim().toLowerCase()
  ] || null;
}

function normalizePriority(priority) {
  if (!priority) {
    return null;
  }

  return PRIORITY_MAP[
    String(priority).trim().toLowerCase()
  ] || null;
}

function normalizeNullableId(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : null;
}

function isOperationsUser(user) {
  return OPERATIONS_ROLES.has(
    String(user?.role || "").toLowerCase()
  );
}

function formatAge(createdAt) {
  const createdTime = new Date(createdAt).getTime();

  if (!Number.isFinite(createdTime)) {
    return "N/A";
  }

  const differenceMilliseconds = Math.max(
    0,
    Date.now() - createdTime
  );

  const minutes = Math.floor(
    differenceMilliseconds / 60000
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function withAge(ticket) {
  return {
    ...ticket,
    age: formatAge(ticket.created_at),
  };
}

function getTicketPrefix({
  ticketType,
  title,
  workspace,
}) {
  const normalizedType = String(ticketType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (TICKET_TYPE_PREFIX[normalizedType]) {
    return TICKET_TYPE_PREFIX[normalizedType];
  }

  const normalizedTitle = String(title || "").toLowerCase();
  const normalizedWorkspace = String(workspace || "").toLowerCase();

  if (
    normalizedWorkspace.includes("change") ||
    normalizedTitle.includes("change")
  ) {
    return "CHG";
  }

  if (
    normalizedWorkspace.includes("request") ||
    normalizedTitle.includes("request") ||
    normalizedTitle.includes("access") ||
    normalizedTitle.includes("install")
  ) {
    return "REQ";
  }

  return "INC";
}

async function addHistory(
  database,
  ticketId,
  actorId,
  action,
  oldValue,
  newValue
) {
  const savepointName = "ticket_history_write";

  try {
    await database.query(
      `SAVEPOINT ${savepointName}`
    );

    await database.query(
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

    await database.query(
      `RELEASE SAVEPOINT ${savepointName}`
    );

    return true;
  } catch (error) {
    try {
      await database.query(
        `ROLLBACK TO SAVEPOINT ${savepointName}`
      );

      await database.query(
        `RELEASE SAVEPOINT ${savepointName}`
      );
    } catch (savepointError) {
      console.error(
        "Ticket history savepoint recovery failed:",
        {
          ticketId,
          message: savepointError.message,
        }
      );

      throw error;
    }

    console.error(
      "Ticket history insert failed; ticket change will continue:",
      {
        ticketId,
        action,
        message: error.message,
        code: error.code,
      }
    );

    return false;
  }
}

async function getGroupEmailRecipients(groupId) {
  if (!groupId) {
    return {
      groupName: null,
      emails: [],
    };
  }

  const result = await pool.query(
    `
    SELECT
      g.name AS group_name,
      u.email
    FROM support_groups g
    LEFT JOIN support_group_members gm
      ON gm.group_id = g.id
    LEFT JOIN users u
      ON u.id = gm.user_id
    WHERE g.id = $1
      AND (
        u.id IS NULL
        OR (
          u.status = 'active'
          AND u.approved = TRUE
          AND u.archived_at IS NULL
        )
      )
    `,
    [groupId]
  );

  return {
    groupName: result.rows[0]?.group_name || null,
    emails: result.rows
      .map((row) => row.email)
      .filter(Boolean),
  };
}

async function getAssigneeEmail(userId) {
  if (!userId) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT email
    FROM users
    WHERE id = $1
      AND status = 'active'
      AND approved = TRUE
      AND archived_at IS NULL
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0]?.email || null;
}

async function notifyTicketAssignment({
  ticket,
  assignedGroupId,
  assignedToUserId,
}) {
  try {
    await createTicketAssignmentNotifications({
      ticket,
      assignedGroupId,
      assignedToUserId,
    });
  } catch (notificationError) {
    console.error(
      "Ticket assignment in-app notification failed:",
      {
        ticketId: ticket?.id || null,
        message: notificationError.message,
      }
    );
  }

  try {
    const groupInformation =
      await getGroupEmailRecipients(assignedGroupId);

    const assigneeEmail =
      await getAssigneeEmail(assignedToUserId);

    const recipients = [
      ...groupInformation.emails,
    ];

    if (assigneeEmail) {
      recipients.push(assigneeEmail);
    }

    const emailResult =
      await sendTicketAssignmentEmail({
        recipients,
        ticket,
        groupName: groupInformation.groupName,
      });

    if (!emailResult?.sent && !emailResult?.skipped) {
      console.error(
        "Ticket assignment email delivery failed:",
        {
          ticketId: ticket?.id || null,
          code: emailResult?.error?.code || null,
          message: emailResult?.error?.message || "Unknown email error",
        }
      );
    }
  } catch (emailError) {
    console.error(
      "Ticket assignment email processing failed:",
      {
        ticketId: ticket?.id || null,
        code: emailError.code || null,
        message: emailError.message,
      }
    );
  }
}

async function getTicketById(ticketId) {
  const result = await pool.query(
    `
    ${TICKET_SELECT}
    WHERE t.id = $1
    LIMIT 1
    `,
    [ticketId]
  );

  return result.rows[0] || null;
}

function canViewTicket(user, ticket) {
  if (isOperationsUser(user)) {
    return true;
  }

  return (
    user?.role === "user" &&
    Number(ticket.requester_id) === Number(user.id)
  );
}

router.get("/", async (request, response) => {
  const {
    search,
    status,
    priority,
    workspace,
    groupId,
    limit = 50,
    offset = 0,
  } = request.query;

  const conditions = [];
  const parameters = [];
  let parameterIndex = 1;

  if (status) {
    const normalizedStatus = normalizeStatus(status);

    if (!normalizedStatus) {
      return response.status(400).json({
        error: "Invalid status filter",
      });
    }

    conditions.push(
      `t.status = $${parameterIndex}`
    );
    parameters.push(normalizedStatus);
    parameterIndex += 1;
  }

  if (priority) {
    const normalizedPriority = normalizePriority(priority);

    if (!normalizedPriority) {
      return response.status(400).json({
        error: "Invalid priority filter",
      });
    }

    conditions.push(
      `t.priority = $${parameterIndex}`
    );
    parameters.push(normalizedPriority);
    parameterIndex += 1;
  }

  if (workspace) {
    conditions.push(
      `t.workspace = $${parameterIndex}`
    );
    parameters.push(workspace);
    parameterIndex += 1;
  }

  if (groupId) {
    const normalizedGroupId = normalizeNullableId(groupId);

    if (!normalizedGroupId) {
      return response.status(400).json({
        error: "Invalid group filter",
      });
    }

    conditions.push(
      `t.assigned_group_id = $${parameterIndex}`
    );
    parameters.push(normalizedGroupId);
    parameterIndex += 1;
  }

  if (search) {
    conditions.push(
      `
      (
        t.ticket_ref ILIKE $${parameterIndex}
        OR t.title ILIKE $${parameterIndex}
        OR t.description ILIKE $${parameterIndex}
        OR t.priority ILIKE $${parameterIndex}
        OR t.status ILIKE $${parameterIndex}
        OR t.workspace ILIKE $${parameterIndex}
        OR requester.name ILIKE $${parameterIndex}
        OR requester.email ILIKE $${parameterIndex}
        OR assignee.name ILIKE $${parameterIndex}
        OR assignee.email ILIKE $${parameterIndex}
        OR g.name ILIKE $${parameterIndex}
      )
      `
    );

    parameters.push(`%${search}%`);
    parameterIndex += 1;
  }

  if (request.user.role === "user") {
    conditions.push(
      `t.requester_id = $${parameterIndex}`
    );
    parameters.push(request.user.id);
    parameterIndex += 1;
  } else if (
    ["agent", "operator"].includes(request.user.role)
  ) {
    conditions.push(
      `
      (
        t.assigned_to_user_id = $${parameterIndex}
        OR t.assigned_to_user_id IS NULL
        OR t.assigned_group_id IN (
          SELECT group_id
          FROM support_group_members
          WHERE user_id = $${parameterIndex}
        )
      )
      `
    );

    parameters.push(request.user.id);
    parameterIndex += 1;
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    200
  );

  const safeOffset = Math.max(
    Number(offset) || 0,
    0
  );

  try {
    const result = await pool.query(
      `
      ${TICKET_SELECT}
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
      LIMIT $${parameterIndex}
      OFFSET $${parameterIndex + 1}
      `,
      [
        ...parameters,
        safeLimit,
        safeOffset,
      ]
    );

    return response.json(
      result.rows.map(withAge)
    );
  } catch (error) {
    console.error("Fetch tickets failed:", error);
    return response.status(500).json({
      error: "Failed to fetch tickets",
    });
  }
});

router.get("/my-tickets", async (request, response) => {
  const employeeOnly = request.user.role === "user";

  const visibilityCondition = employeeOnly
    ? "t.requester_id = $1"
    : `
      (
        t.requester_id = $1
        OR t.assigned_to_user_id = $1
        OR t.assigned_group_id IN (
          SELECT group_id
          FROM support_group_members
          WHERE user_id = $1
        )
      )
    `;

  try {
    const result = await pool.query(
      `
      ${TICKET_SELECT}
      WHERE ${visibilityCondition}
      ORDER BY t.created_at DESC
      LIMIT 200
      `,
      [request.user.id]
    );

    return response.json(
      result.rows.map(withAge)
    );
  } catch (error) {
    console.error("Fetch my tickets failed:", error);
    return response.status(500).json({
      error: "Failed to fetch your tickets",
    });
  }
});

router.get("/:id", async (request, response) => {
  try {
    const ticket = await getTicketById(request.params.id);

    if (!ticket) {
      return response.status(404).json({
        error: "Ticket not found",
      });
    }

    if (!canViewTicket(request.user, ticket)) {
      return response.status(403).json({
        error:
          "You can only view tickets requested by your account.",
      });
    }

    return response.json(withAge(ticket));
  } catch (error) {
    console.error("Fetch ticket failed:", error);
    return response.status(500).json({
      error: "Failed to fetch ticket",
    });
  }
});

router.post(
  "/",
  allowRoles(
    "superadmin",
    "admin",
    "agent",
    "user",
    "operator",
    "manager"
  ),
  async (request, response) => {
    const {
      ticketType,
      title,
      description,
      priority,
      workspace,
      assignedGroupId,
      assignedToUserId,
    } = request.body;

    const normalizedTitle = String(title || "").trim();
    const normalizedDescription = String(description || "").trim();
    const normalizedGroupId = normalizeNullableId(assignedGroupId);
    const normalizedAssigneeId = normalizeNullableId(assignedToUserId);

    if (!normalizedTitle) {
      return response.status(400).json({
        error: "A ticket title is required.",
      });
    }

    if (!normalizedDescription) {
      return response.status(400).json({
        error: "A ticket description is required.",
      });
    }

    if (!normalizedGroupId && !normalizedAssigneeId) {
      return response.status(400).json({
        error: "Please choose a support group or an assignee.",
      });
    }

    try {
      const duplicateResult = await pool.query(
        `
        SELECT
          id,
          ticket_ref,
          title,
          created_at
        FROM tickets
        WHERE requester_id = $1
          AND LOWER(title) = LOWER($2)
          AND created_at > NOW() - INTERVAL '30 seconds'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [
          request.user.id,
          normalizedTitle,
        ]
      );

      if (duplicateResult.rows[0]) {
        return response.status(409).json({
          error:
            "A similar ticket was just created. Please wait before submitting again.",
          ticket: duplicateResult.rows[0],
        });
      }
    } catch (error) {
      console.error("Duplicate ticket check failed:", error);
      return response.status(500).json({
        error: "Failed to validate the new ticket",
      });
    }

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      await client.query(
        "SET LOCAL lock_timeout = '5s'"
      );

      await client.query(
        "SET LOCAL statement_timeout = '15s'"
      );

      const sequenceResult = await client.query(
        "SELECT nextval(pg_get_serial_sequence('tickets', 'id')) AS next_id"
      );

      const nextId = sequenceResult.rows[0].next_id;
      const ticketReference = `${getTicketPrefix({
        ticketType,
        title: normalizedTitle,
        workspace,
      })}-${String(nextId).padStart(5, "0")}`;

      const insertResult = await client.query(
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
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'Open',
          $8,
          $9,
          $10
        )
        RETURNING *
        `,
        [
          nextId,
          ticketReference,
          normalizedTitle,
          normalizedDescription,
          request.user.id,
          request.user.id,
          normalizePriority(priority) || "Medium",
          workspace || "IT",
          normalizedGroupId,
          normalizedAssigneeId,
        ]
      );

      const createdTicket = insertResult.rows[0];

      await addHistory(
        client,
        createdTicket.id,
        request.user.id,
        "created",
        null,
        "Open"
      );

      await client.query("COMMIT");
      transactionOpen = false;

      setImmediate(() => {
        notifyTicketAssignment({
          ticket: createdTicket,
          assignedGroupId: createdTicket.assigned_group_id,
          assignedToUserId: createdTicket.assigned_to_user_id,
        }).catch((error) => {
          console.error(
            "Ticket creation notification background failure:",
            error.message
          );
        });
      });

      return response.status(201).json(
        withAge(createdTicket)
      );
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Create ticket rollback failed:",
            rollbackError.message
          );
        }
      }

      console.error("Create ticket failed:", error);

      if (
        error.code === "55P03" ||
        error.code === "57014"
      ) {
        return response.status(409).json({
          error:
            "The ticket database is busy. Please try again in a few seconds.",
        });
      }

      return response.status(500).json({
        error: "Failed to create ticket",
      });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id",
  allowRoles(
    "superadmin",
    "admin",
    "agent",
    "operator",
    "manager"
  ),
  async (request, response) => {
    const {
      title,
      description,
      priority,
      status,
      workspace,
      assignedGroupId,
      assignedToUserId,
      dueAt,
    } = request.body;

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      await client.query(
        "SET LOCAL lock_timeout = '5s'"
      );

      await client.query(
        "SET LOCAL statement_timeout = '15s'"
      );

      const oldTicketResult = await client.query(
        `
        SELECT *
        FROM tickets
        WHERE id = $1
        FOR UPDATE
        `,
        [request.params.id]
      );

      const oldTicket = oldTicketResult.rows[0];

      if (!oldTicket) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return response.status(404).json({
          error: "Ticket not found",
        });
      }

      const nextTitle = title === undefined
        ? oldTicket.title
        : String(title).trim();

      if (!nextTitle) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return response.status(400).json({
          error: "Ticket title is required",
        });
      }

      const nextPriority = priority === undefined
        ? oldTicket.priority
        : normalizePriority(priority);

      const nextStatus = status === undefined
        ? oldTicket.status
        : normalizeStatus(status);

      if (!nextPriority || !nextStatus) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return response.status(400).json({
          error: "Invalid priority or status",
        });
      }

      const nextAssignedGroupId = assignedGroupId === undefined
        ? oldTicket.assigned_group_id
        : normalizeNullableId(assignedGroupId);

      const nextAssignedToUserId = assignedToUserId === undefined
        ? oldTicket.assigned_to_user_id
        : normalizeNullableId(assignedToUserId);

      const nextClosedAt = nextStatus === "Closed"
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
          description === undefined
            ? oldTicket.description
            : String(description || "").trim(),
          nextPriority,
          nextStatus,
          workspace === undefined
            ? oldTicket.workspace
            : workspace || "IT",
          nextAssignedGroupId,
          nextAssignedToUserId,
          dueAt === undefined
            ? oldTicket.due_at
            : dueAt || null,
          nextClosedAt,
          request.params.id,
        ]
      );

      const updatedTicket = updatedResult.rows[0];

      await addHistory(
        client,
        request.params.id,
        request.user.id,
        "updated",
        JSON.stringify(oldTicket),
        JSON.stringify(updatedTicket)
      );

      await client.query("COMMIT");
      transactionOpen = false;

      const assignmentChanged =
        String(oldTicket.assigned_group_id || "") !==
          String(updatedTicket.assigned_group_id || "") ||
        String(oldTicket.assigned_to_user_id || "") !==
          String(updatedTicket.assigned_to_user_id || "");

      if (assignmentChanged) {
        setImmediate(() => {
          notifyTicketAssignment({
            ticket: updatedTicket,
            assignedGroupId: updatedTicket.assigned_group_id,
            assignedToUserId: updatedTicket.assigned_to_user_id,
          }).catch((error) => {
            console.error(
              "Updated ticket assignment notification failure:",
              error.message
            );
          });
        });
      }

      return response.json(
        withAge(updatedTicket)
      );
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Update ticket rollback failed:",
            rollbackError.message
          );
        }
      }

      console.error("Update ticket failed:", {
        ticketId: request.params.id,
        message: error.message,
        code: error.code,
      });

      if (
        error.code === "55P03" ||
        error.code === "57014"
      ) {
        return response.status(409).json({
          error:
            "This ticket is busy. Please wait a few seconds and try again.",
        });
      }

      return response.status(500).json({
        error: "Failed to update ticket",
      });
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/:id/status",
  allowRoles(
    "superadmin",
    "admin",
    "agent",
    "operator",
    "manager"
  ),
  async (request, response) => {
    const normalizedStatus = normalizeStatus(
      request.body.status
    );

    if (!normalizedStatus) {
      return response.status(400).json({
        error: "Invalid status",
      });
    }

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      await client.query(
        "SET LOCAL lock_timeout = '5s'"
      );

      const oldTicketResult = await client.query(
        `
        SELECT status
        FROM tickets
        WHERE id = $1
        FOR UPDATE
        `,
        [request.params.id]
      );

      if (!oldTicketResult.rows[0]) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return response.status(404).json({
          error: "Ticket not found",
        });
      }

      const updateResult = await client.query(
        `
        UPDATE tickets
        SET
          status = $1,
          closed_at = CASE
            WHEN $1 = 'Closed'
              THEN COALESCE(closed_at, NOW())
            WHEN $1 = 'Resolved'
              THEN closed_at
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [
          normalizedStatus,
          request.params.id,
        ]
      );

      await addHistory(
        client,
        request.params.id,
        request.user.id,
        "status_changed",
        oldTicketResult.rows[0].status,
        normalizedStatus
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return response.json(
        withAge(updateResult.rows[0])
      );
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
      }

      console.error("Update ticket status failed:", error);
      return response.status(500).json({
        error: "Failed to update ticket status",
      });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/:id/assign",
  allowRoles(
    "superadmin",
    "admin",
    "agent",
    "operator",
    "manager"
  ),
  async (request, response) => {
    const assignedToUserId = normalizeNullableId(
      request.body.assignedToUserId
    );

    const requestedGroupId = normalizeNullableId(
      request.body.assignedGroupId
    );

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      await client.query(
        "SET LOCAL lock_timeout = '5s'"
      );

      const oldTicketResult = await client.query(
        `
        SELECT
          assigned_to_user_id,
          assigned_group_id,
          status
        FROM tickets
        WHERE id = $1
        FOR UPDATE
        `,
        [request.params.id]
      );

      const oldTicket = oldTicketResult.rows[0];

      if (!oldTicket) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return response.status(404).json({
          error: "Ticket not found",
        });
      }

      const nextAssignedGroupId =
        request.body.assignedGroupId === undefined
          ? oldTicket.assigned_group_id
          : requestedGroupId;

      if (!assignedToUserId && !nextAssignedGroupId) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return response.status(400).json({
          error:
            "The ticket must remain assigned to a support group or an agent.",
        });
      }

      const updateResult = await client.query(
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
        [
          assignedToUserId,
          nextAssignedGroupId,
          request.params.id,
        ]
      );

      const updatedTicket = updateResult.rows[0];

      await addHistory(
        client,
        request.params.id,
        request.user.id,
        "assigned",
        JSON.stringify(oldTicket),
        JSON.stringify({
          assigned_to_user_id:
            updatedTicket.assigned_to_user_id,
          assigned_group_id:
            updatedTicket.assigned_group_id,
        })
      );

      await client.query("COMMIT");
      transactionOpen = false;

      setImmediate(() => {
        notifyTicketAssignment({
          ticket: updatedTicket,
          assignedGroupId: updatedTicket.assigned_group_id,
          assignedToUserId: updatedTicket.assigned_to_user_id,
        }).catch((error) => {
          console.error(
            "Ticket assignment notification background failure:",
            error.message
          );
        });
      });

      return response.json(
        withAge(updatedTicket)
      );
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
      }

      console.error("Assign ticket failed:", error);
      return response.status(500).json({
        error: "Failed to assign ticket",
      });
    } finally {
      client.release();
    }
  }
);

async function updateTerminalStatus({
  request,
  response,
  status,
  action,
}) {
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    const oldTicketResult = await client.query(
      `
      SELECT status
      FROM tickets
      WHERE id = $1
      FOR UPDATE
      `,
      [request.params.id]
    );

    if (!oldTicketResult.rows[0]) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return response.status(404).json({
        error: "Ticket not found",
      });
    }

    const updateResult = await client.query(
      `
      UPDATE tickets
      SET
        status = $1,
        closed_at = CASE
          WHEN $1 = 'Closed' THEN NOW()
          ELSE closed_at
        END,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [
        status,
        request.params.id,
      ]
    );

    await addHistory(
      client,
      request.params.id,
      request.user.id,
      action,
      oldTicketResult.rows[0].status,
      status
    );

    await client.query("COMMIT");
    transactionOpen = false;

    return response.json(
      withAge(updateResult.rows[0])
    );
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }

    console.error(`${action} ticket failed:`, error);
    return response.status(500).json({
      error: `Failed to ${action} ticket`,
    });
  } finally {
    client.release();
  }
}

router.patch(
  "/:id/resolve",
  allowRoles(
    "superadmin",
    "admin",
    "agent",
    "operator",
    "manager"
  ),
  async (request, response) => {
    return updateTerminalStatus({
      request,
      response,
      status: "Resolved",
      action: "resolve",
    });
  }
);

router.patch(
  "/:id/close",
  allowRoles(
    "superadmin",
    "admin",
    "agent",
    "operator",
    "manager"
  ),
  async (request, response) => {
    return updateTerminalStatus({
      request,
      response,
      status: "Closed",
      action: "close",
    });
  }
);

module.exports = router;
