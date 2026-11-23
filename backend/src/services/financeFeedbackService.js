const pool = require("../db/pool");
const config = require("../config");
const { sendEmail } = require("./email");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const MANAGER_LEVELS = new Set(["manager", "workspace_manager", "security_admin", "director", "executive"]);

function validateRating(rating) {
  if (rating == null) return null;
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw fail(400, "INVALID_RATING", "Rating must be between 1 and 5.");
  return r;
}

async function workItemExists(workItemId, workItemType) {
  const table = {ticket: "tickets", journal: "finance_journals", reconciliation: "finance_reconciliations", month_end: "finance_close_tasks"}[workItemType];
  if (!table) throw fail(400, "INVALID_WORK_ITEM_TYPE", "Work item type must be ticket, journal, reconciliation or month_end.");
  const result = await pool.query(`SELECT 1 FROM ${table} WHERE id=$1::bigint`, [workItemId]);
  return Boolean(result.rowCount);
}

async function isManagerAuthority(userId) {
  const row = (await pool.query(
    `SELECT fr.is_finance_manager,p.access_level FROM users u
     LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=u.id AND fr.active=TRUE
     LEFT JOIN finance_approved_positions p ON p.position_key=LOWER(TRIM(COALESCE(u.job_title,''))) AND p.active=TRUE
     WHERE u.id=$1::bigint`,
    [userId]
  )).rows[0];
  return Boolean(row?.is_finance_manager) || MANAGER_LEVELS.has(row?.access_level);
}

async function managerOf(userId) {
  const row = (await pool.query(
    `SELECT manager_user_id FROM finance_employee_responsibilities WHERE user_id=$1::bigint AND active=TRUE AND manager_user_id IS NOT NULL LIMIT 1`,
    [userId]
  )).rows[0];
  return row ? Number(row.manager_user_id) : null;
}

async function assertCanPostAbout(authorUserId, recipientUserId) {
  if (await isManagerAuthority(authorUserId)) return;
  const manager = await managerOf(authorUserId);
  if (manager != null && String(manager) === String(recipientUserId)) return;
  throw fail(403, "CROSS_EMPLOYEE_FEEDBACK_PROHIBITED", "Employees may only post feedback to their own manager.");
}

async function notifyRecipient(recipientUserId, authorUserId, remarkText) {
  try {
    const recipient = (await pool.query(`SELECT email,name FROM users WHERE id=$1::bigint`, [recipientUserId])).rows[0];
    if (!recipient?.email) return;
    await sendEmail({
      to: recipient.email,
      category: "finance_feedback",
      subject: "Finance feedback: new remark",
      text: `You have received a new feedback remark.\n\n${remarkText}`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>New feedback remark</h2><p>${escapeHtml(remarkText)}</p></div>`
    });
  } catch (error) {
    console.warn("Feedback notification failed:", error.message);
  }
}

async function createFeedback({authorUserId, recipientUserId, workItemId, workItemType, periodKey, remarkText, rating}) {
  if (!authorUserId || !recipientUserId) throw fail(400, "FEEDBACK_FIELDS_REQUIRED", "Author and recipient are required.");
  if (!remarkText || !String(remarkText).trim()) throw fail(400, "FEEDBACK_REMARK_REQUIRED", "A remark text is required.");
  if (String(authorUserId) === String(recipientUserId)) throw fail(400, "FEEDBACK_SELF_PROHIBITED", "Users cannot post feedback about themselves.");
  const validRating = validateRating(rating);
  if (workItemId != null && !(await workItemExists(workItemId, workItemType))) {
    throw fail(404, "WORK_ITEM_NOT_FOUND", "The referenced work item does not exist.");
  }
  await assertCanPostAbout(authorUserId, recipientUserId);
  const result = await pool.query(
    `INSERT INTO finance_feedback_entries(thread_id,author_user_id,recipient_user_id,work_item_id,work_item_type,period_key,remark_text,rating)
     VALUES(NULL,$1::bigint,$2::bigint,$3::bigint,$4,$5,$6,$7) RETURNING *`,
    [authorUserId, recipientUserId, workItemId ?? null, workItemType ?? null, periodKey ?? null, String(remarkText).trim(), validRating]
  );
  const entry = result.rows[0];
  await notifyRecipient(recipientUserId, authorUserId, entry.remark_text);
  return entry;
}

async function replyToFeedback({threadId, authorUserId, remarkText, rating}) {
  if (!threadId || !authorUserId) throw fail(400, "FEEDBACK_FIELDS_REQUIRED", "Thread and author are required.");
  if (!remarkText || !String(remarkText).trim()) throw fail(400, "FEEDBACK_REMARK_REQUIRED", "A remark text is required.");
  const validRating = validateRating(rating);
  const thread = (await pool.query(`SELECT * FROM finance_feedback_entries WHERE id=$1::bigint`, [threadId])).rows[0];
  if (!thread) throw fail(404, "FEEDBACK_THREAD_NOT_FOUND", "Feedback thread not found.");
  const isAuthor = String(thread.author_user_id) === String(authorUserId);
  const isRecipient = String(thread.recipient_user_id) === String(authorUserId);
  if (!isAuthor && !isRecipient) {
    if (!(await isManagerAuthority(authorUserId))) {
      throw fail(403, "FEEDBACK_THREAD_ACCESS_DENIED", "Only the thread participants may reply.");
    }
  }
  const recipientUserId = isAuthor ? thread.recipient_user_id : thread.author_user_id;
  const result = await pool.query(
    `INSERT INTO finance_feedback_entries(thread_id,author_user_id,recipient_user_id,work_item_id,work_item_type,period_key,remark_text,rating)
     VALUES($1::bigint,$2::bigint,$3::bigint,$4::bigint,$5,$6,$7,$8) RETURNING *`,
    [threadId, authorUserId, recipientUserId, thread.work_item_id, thread.work_item_type, thread.period_key, String(remarkText).trim(), validRating]
  );
  const entry = result.rows[0];
  await notifyRecipient(recipientUserId, authorUserId, entry.remark_text);
  return entry;
}

async function assertThreadVisibility(requestingUser, thread) {
  if (!requestingUser) return;
  const userId = Number(requestingUser.userId ?? requestingUser.id);
  if (String(thread.author_user_id) === String(userId) || String(thread.recipient_user_id) === String(userId)) return;
  const financeAccess = requestingUser.financeAccess;
  if (["workspace_manager", "security_admin", "director", "executive"].includes(financeAccess?.accessLevel)) return;
  if (MANAGER_LEVELS.has(financeAccess?.accessLevel)) {
    const scope = (financeAccess?.reportingScope || []).map(String);
    if (scope.includes(String(thread.recipient_user_id))) return;
  }
  if (await managerOf(thread.recipient_user_id) === userId) return;
  throw fail(403, "FEEDBACK_ACCESS_DENIED", "You are not authorised to view this feedback thread.");
}

async function getFeedbackThread(threadId, requestingUser) {
  const thread = (await pool.query(`SELECT * FROM finance_feedback_entries WHERE id=$1::bigint`, [threadId])).rows[0];
  if (!thread) throw fail(404, "FEEDBACK_THREAD_NOT_FOUND", "Feedback thread not found.");
  await assertThreadVisibility(requestingUser, thread);
  const replies = (await pool.query(
    `SELECT f.*,a.name author_name FROM finance_feedback_entries f LEFT JOIN users a ON a.id=f.author_user_id
     WHERE f.thread_id=$1::bigint ORDER BY f.created_at`,
    [threadId]
  )).rows;
  return {thread, replies};
}

async function getFeedbackForUser({userId, direction = "all", workItemId, periodKey, limit = 50, offset = 0}) {
  if (!userId) throw fail(400, "FEEDBACK_USER_REQUIRED", "A user ID is required.");
  const clauses = [];
  const params = [];
  if (direction === "received") { params.push(userId); clauses.push(`recipient_user_id=$${params.length}::bigint`); }
  else if (direction === "sent") { params.push(userId); clauses.push(`author_user_id=$${params.length}::bigint`); }
  else { params.push(userId); clauses.push(`(recipient_user_id=$${params.length}::bigint OR author_user_id=$${params.length}::bigint)`); }
  if (workItemId != null) { params.push(workItemId); clauses.push(`work_item_id=$${params.length}::bigint`); }
  if (periodKey != null) { params.push(periodKey); clauses.push(`period_key=$${params.length}`); }
  params.push(Number(limit));
  params.push(Number(offset));
  const result = await pool.query(
    `SELECT f.*,a.name author_name,r.name recipient_name FROM finance_feedback_entries f
     LEFT JOIN users a ON a.id=f.author_user_id LEFT JOIN users r ON r.id=f.recipient_user_id
     WHERE ${clauses.join(" AND ")} ORDER BY f.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

async function editFeedback(entryId, editorUserId, newRemarkText, newRating) {
  if (!entryId || !editorUserId) throw fail(400, "FEEDBACK_FIELDS_REQUIRED", "Entry and editor are required.");
  if (!newRemarkText || !String(newRemarkText).trim()) throw fail(400, "FEEDBACK_REMARK_REQUIRED", "A remark text is required.");
  const validRating = validateRating(newRating);
  const entry = (await pool.query(`SELECT * FROM finance_feedback_entries WHERE id=$1::bigint`, [entryId])).rows[0];
  if (!entry) throw fail(404, "FEEDBACK_ENTRY_NOT_FOUND", "Feedback entry not found.");
  if (String(entry.author_user_id) !== String(editorUserId)) {
    throw fail(403, "FEEDBACK_EDIT_DENIED", "Only the author may edit a feedback remark.");
  }
  const windowMinutes = config.financeAdvanced?.feedbackEditWindowMinutes ?? 30;
  const windowStart = new Date(Date.now() - windowMinutes * 60000);
  if (new Date(entry.created_at).getTime() <= windowStart.getTime()) {
    throw fail(403, "FEEDBACK_EDIT_WINDOW_EXPIRED", `Feedback remarks can only be edited within ${windowMinutes} minutes of posting.`);
  }
  const result = await pool.query(
    `UPDATE finance_feedback_entries SET remark_text=$2,rating=$3,updated_at=NOW() WHERE id=$1::bigint RETURNING *`,
    [entryId, String(newRemarkText).trim(), validRating]
  );
  return result.rows[0];
}

async function getFeedbackSummary({employeeUserId, periodKey}) {
  if (!employeeUserId) throw fail(400, "FEEDBACK_USER_REQUIRED", "An employee user ID is required.");
  const result = (await pool.query(
    `SELECT COUNT(*) AS total_remarks, AVG(rating) AS avg_rating FROM finance_feedback_entries
     WHERE recipient_user_id=$1::bigint AND ($2::text IS NULL OR period_key=$2)`,
    [employeeUserId, periodKey ?? null]
  )).rows[0];
  return {
    employeeUserId: Number(employeeUserId),
    periodKey: periodKey ?? null,
    totalRemarks: Number(result.total_remarks),
    averageRating: result.avg_rating != null ? Math.round(Number(result.avg_rating) * 100) / 100 : null
  };
}

module.exports = {
  createFeedback,
  replyToFeedback,
  getFeedbackThread,
  getFeedbackForUser,
  editFeedback,
  getFeedbackSummary
};