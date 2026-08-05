const pool = require("../db/pool");

const VALID_MODULES = new Set([
  "admin",
  "helpdesk",
  "production",
  "system",
]);

function normalizeModule(moduleName) {
  const normalized = String(moduleName || "system")
    .trim()
    .toLowerCase();

  return VALID_MODULES.has(normalized)
    ? normalized
    : "system";
}

function normalizeRecipientIds(recipientUserIds) {
  return Array.from(
    new Set(
      (recipientUserIds || [])
        .map(Number)
        .filter(
          (userId) => Number.isInteger(userId) && userId > 0
        )
    )
  );
}

async function getGroupMemberUserIds(groupId) {
  if (!groupId) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT DISTINCT u.id AS user_id
    FROM support_group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = $1
      AND u.approved = TRUE
      AND u.status = 'active'
      AND u.archived_at IS NULL
      AND u.role IN ('agent', 'operator', 'manager', 'admin', 'superadmin')
    `,
    [groupId]
  );

  return result.rows.map((row) => Number(row.user_id));
}

async function getAccountApprovalRecipientUserIds() {
  const result = await pool.query(
    `
    SELECT DISTINCT u.id
    FROM users u
    LEFT JOIN support_group_members gm ON gm.user_id = u.id
    LEFT JOIN support_groups g ON g.id = gm.group_id
    WHERE u.approved = TRUE
      AND u.status = 'active'
      AND u.archived_at IS NULL
      AND (
        u.role IN ('admin', 'superadmin', 'manager')
        OR (
          u.role IN ('agent', 'operator')
          AND (
            LOWER(COALESCE(g.name, '')) LIKE '%infrastructure%'
            OR LOWER(COALESCE(g.name, '')) LIKE '%it%'
          )
        )
      )
    `
  );

  return result.rows.map((row) => Number(row.id));
}

/**
 * Test-environment guard: when NOTIFY_ONLY_EMAILS is set (comma-separated),
 * in-app notifications are only created for those accounts. Role-wide
 * broadcasts are suppressed entirely. Keeps shared-DB test instances from
 * pinging real agents.
 */
const NOTIFY_ONLY_EMAILS = String(process.env.NOTIFY_ONLY_EMAILS || "")
  .split(/[;,]/)
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

async function restrictRecipients(recipients) {
  if (!NOTIFY_ONLY_EMAILS.length || recipients.length === 0) return recipients;
  const result = await pool.query(
    `SELECT id FROM users WHERE LOWER(email) = ANY($1)`,
    [NOTIFY_ONLY_EMAILS]
  );
  const allowed = new Set(result.rows.map((row) => Number(row.id)));
  return recipients.filter((userId) => allowed.has(Number(userId)));
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
  let recipients = normalizeRecipientIds(recipientUserIds);
  recipients = await restrictRecipients(recipients);
  if (NOTIFY_ONLY_EMAILS.length) targetRole = null;
  const normalizedModule = normalizeModule(module);
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage) {
    throw new Error("Notification message is required.");
  }

  if (recipients.length === 0 && !targetRole) {
    return [];
  }

  const created = [];

  for (const userId of recipients) {
    const result = await pool.query(
      `
      INSERT INTO notifications (
        user_id, target_role, type, module, message,
        target_type, target_id, target_url,
        attachment_count, is_read, created_at
      )
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())
      RETURNING *
      `,
      [
        userId,
        type,
        normalizedModule,
        cleanMessage,
        targetType,
        targetId,
        targetUrl,
        Number(attachmentCount) || 0,
      ]
    );
    created.push(result.rows[0]);
  }

  if (targetRole) {
    const result = await pool.query(
      `
      INSERT INTO notifications (
        user_id, target_role, type, module, message,
        target_type, target_id, target_url,
        attachment_count, is_read, created_at
      )
      VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())
      RETURNING *
      `,
      [
        targetRole,
        type,
        normalizedModule,
        cleanMessage,
        targetType,
        targetId,
        targetUrl,
        Number(attachmentCount) || 0,
      ]
    );
    created.push(result.rows[0]);
  }

  return created;
}

async function createAccountApprovalNotifications(user) {
  const recipientUserIds = await getAccountApprovalRecipientUserIds();

  return createNotifications({
    recipientUserIds,
    type: "user_signup",
    module: "admin",
    message: `New account request awaiting approval: ${user.email}`,
    targetType: "user",
    targetId: user.id,
    targetUrl: "/admin/users?view=pending",
  });
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

  const ticketReference = ticket.ticket_ref || `TICKET-${ticket.id}`;

  return createNotifications({
    recipientUserIds,
    type: "assignment",
    module: "helpdesk",
    message: `${ticketReference}: ${ticket.title || "Ticket assigned"}`,
    targetType: "ticket",
    targetId: ticket.id,
    targetUrl: `/tickets/${ticket.id}`,
  });
}

module.exports = {
  normalizeModule,
  normalizeRecipientIds,
  createNotifications,
  createAccountApprovalNotifications,
  createTicketAssignmentNotifications,
  getAccountApprovalRecipientUserIds,
  getGroupMemberUserIds,
};
