const pool = require("../db/pool");

const VALID_MODULES = new Set([
  "admin",
  "helpdesk",
  "production",
  "system",
]);

function normalizeModule(moduleName) {
  const normalizedModule = String(moduleName || "system")
    .trim()
    .toLowerCase();

  return VALID_MODULES.has(normalizedModule)
    ? normalizedModule
    : "system";
}

function normalizeRecipientIds(recipientUserIds) {
  return Array.from(
    new Set(
      (recipientUserIds || [])
        .map(Number)
        .filter((userId) => Number.isInteger(userId) && userId > 0)
    )
  );
}

async function getGroupMemberUserIds(groupId) {
  if (!groupId) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT user_id
    FROM support_group_members
    WHERE group_id = $1
    `,
    [groupId]
  );

  return result.rows.map((row) => Number(row.user_id));
}

async function createNotifications({
  recipientUserIds,
  targetRole = null,
  type = "info",
  module = "system",
  message,
  targetType = null,
  targetId = null,
  targetUrl = null,
  attachmentCount = 0,
}) {
  const normalizedRecipients = normalizeRecipientIds(recipientUserIds);
  const normalizedModule = normalizeModule(module);

  if (!message || !String(message).trim()) {
    throw new Error("Notification message is required.");
  }

  if (normalizedRecipients.length === 0 && !targetRole) {
    return [];
  }

  const createdNotifications = [];

  for (const userId of normalizedRecipients) {
    const result = await pool.query(
      `
      INSERT INTO notifications (
        user_id,
        target_role,
        type,
        module,
        message,
        target_type,
        target_id,
        target_url,
        attachment_count,
        is_read,
        created_at
      )
      VALUES (
        $1,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        FALSE,
        NOW()
      )
      RETURNING *
      `,
      [
        userId,
        type,
        normalizedModule,
        String(message).trim(),
        targetType,
        targetId,
        targetUrl,
        Number(attachmentCount) || 0,
      ]
    );

    createdNotifications.push(result.rows[0]);
  }

  if (targetRole) {
    const result = await pool.query(
      `
      INSERT INTO notifications (
        user_id,
        target_role,
        type,
        module,
        message,
        target_type,
        target_id,
        target_url,
        attachment_count,
        is_read,
        created_at
      )
      VALUES (
        NULL,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        FALSE,
        NOW()
      )
      RETURNING *
      `,
      [
        targetRole,
        type,
        normalizedModule,
        String(message).trim(),
        targetType,
        targetId,
        targetUrl,
        Number(attachmentCount) || 0,
      ]
    );

    createdNotifications.push(result.rows[0]);
  }

  return createdNotifications;
}

async function createTicketAssignmentNotifications({
  ticket,
  assignedGroupId,
  assignedToUserId,
}) {
  const groupMemberIds = await getGroupMemberUserIds(assignedGroupId);

  const recipientUserIds = normalizeRecipientIds([
    ...groupMemberIds,
    assignedToUserId,
  ]);

  if (recipientUserIds.length === 0) {
    return [];
  }

  const ticketReference =
    ticket.ticket_ref ||
    `TICKET-${ticket.id}`;

  const message =
    `${ticketReference}: ` +
    `${ticket.title || "Ticket assigned"}`;

  return createNotifications({
    recipientUserIds,
    type: "assignment",
    module: "admin",
    message,
    targetType: "ticket",
    targetId: ticket.id,
    targetUrl: `/tickets/${ticket.id}`,
  });
}

module.exports = {
  normalizeModule,
  createNotifications,
  createTicketAssignmentNotifications,
  getGroupMemberUserIds,
};
