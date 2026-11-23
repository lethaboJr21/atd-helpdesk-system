const pool = require("../db/pool");
const financeAccess = require("../middleware/financeAccess");
const financePeriodService = require("./financePeriodService");
const financeKpiScoring = require("./financeKpiScoring");
const reportingService = require("./financeEnterpriseReportingService");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

const WORK_ITEM_TYPES = ["ticket", "journal", "reconciliation", "month_end"];
const COMPLETE_STATUSES = new Set(["resolved", "closed", "completed", "accepted", "cancelled", "canceled"]);
const MANAGER_LEVELS = new Set(["manager", "workspace_manager", "security_admin"]);
const HOD_LEVELS = new Set(["director", "executive"]);

const ITEM_LOADERS = {
  ticket: (id) => pool.query(
    `SELECT t.id, t.ticket_ref AS reference, t.title, t.status, t.closed_at AS completed_at, t.assigned_to_user_id AS owner_user_id FROM tickets t WHERE t.id=$1::bigint`,
    [id]
  ),
  journal: (id) => pool.query(
    `SELECT j.id, j.journal_reference AS reference, j.description AS title, j.status, j.submitted_at AS completed_at, j.preparer_user_id AS owner_user_id FROM finance_journals j WHERE j.id=$1::bigint`,
    [id]
  ),
  reconciliation: (id) => pool.query(
    `SELECT r.id, r.reconciliation_reference AS reference, r.control_name AS title, r.status, COALESCE(r.reviewed_at, r.approved_at, r.closed_at) AS completed_at, r.owner_user_id FROM finance_reconciliations r WHERE r.id=$1::bigint`,
    [id]
  ),
  month_end: (id) => pool.query(
    `SELECT t.id, t.task_reference AS reference, t.title, t.status, COALESCE(t.closed_at, t.completed_at) AS completed_at, t.owner_user_id FROM finance_close_tasks t WHERE t.id=$1::bigint`,
    [id]
  )
};

function isItemCompleted(workItemType, item) {
  if (item == null) return false;
  const status = String(item.status || "").toLowerCase();
  if (workItemType === "ticket" || workItemType === "month_end") return COMPLETE_STATUSES.has(status);
  if (workItemType === "journal") return ["approved", "published", "posted"].includes(status) && item.completed_at != null;
  if (workItemType === "reconciliation") return ["approved", "posted"].includes(status) && item.completed_at != null;
  return false;
}

const QUEUE_DEFS = {
  ticket: {
    select: `SELECT t.id, t.ticket_ref AS reference, t.title, t.assigned_to_user_id AS owner_user_id, u.name AS owner_name, t.closed_at AS completed_at, (SELECT COUNT(*) FROM ticket_attachments ta WHERE ta.ticket_id=t.id)::int AS attachment_count, qa.rating AS allocation_rating, qa.justification AS allocation_justification, qa.rater_user_id AS allocation_rater_user_id, qa.updated_at AS allocation_rated_at`,
    from: `FROM tickets t LEFT JOIN users u ON u.id=t.assigned_to_user_id LEFT JOIN finance_manager_quality_allocations qa ON qa.work_item_id=t.id AND qa.work_item_type='ticket'`,
    where: `t.workspace='FIN' AND t.archived_at IS NULL AND LOWER(t.status) IN ('resolved','closed','completed','accepted','cancelled','canceled')`,
    ownerColumn: "t.assigned_to_user_id",
    periodClause: (idx) => `EXISTS (SELECT 1 FROM finance_ticket_operations fto WHERE fto.ticket_id=t.id AND fto.kpi_period=ANY($${idx}::text[]))`
  },
  journal: {
    select: `SELECT j.id, j.journal_reference AS reference, j.description AS title, j.preparer_user_id AS owner_user_id, u.name AS owner_name, j.submitted_at AS completed_at, (SELECT COUNT(*) FROM finance_record_evidence e WHERE e.record_type='journal' AND e.record_id=j.id)::int AS attachment_count, qa.rating AS allocation_rating, qa.justification AS allocation_justification, qa.rater_user_id AS allocation_rater_user_id, qa.updated_at AS allocation_rated_at`,
    from: `FROM finance_journals j LEFT JOIN users u ON u.id=j.preparer_user_id LEFT JOIN finance_manager_quality_allocations qa ON qa.work_item_id=j.id AND qa.work_item_type='journal'`,
    where: `j.status IN ('approved','published','posted') AND j.submitted_at IS NOT NULL`,
    ownerColumn: "j.preparer_user_id",
    periodClause: (idx) => `j.kpi_period=ANY($${idx}::text[])`
  },
  reconciliation: {
    select: `SELECT r.id, r.reconciliation_reference AS reference, r.control_name AS title, r.owner_user_id, u.name AS owner_name, COALESCE(r.reviewed_at, r.approved_at, r.closed_at) AS completed_at, (SELECT COUNT(*) FROM finance_record_evidence e WHERE e.record_type='reconciliation' AND e.record_id=r.id)::int AS attachment_count, qa.rating AS allocation_rating, qa.justification AS allocation_justification, qa.rater_user_id AS allocation_rater_user_id, qa.updated_at AS allocation_rated_at`,
    from: `FROM finance_reconciliations r LEFT JOIN users u ON u.id=r.owner_user_id LEFT JOIN finance_manager_quality_allocations qa ON qa.work_item_id=r.id AND qa.work_item_type='reconciliation'`,
    where: `r.status IN ('approved','posted') AND COALESCE(r.reviewed_at, r.approved_at, r.closed_at) IS NOT NULL`,
    ownerColumn: "r.owner_user_id",
    periodClause: (idx) => `r.kpi_period=ANY($${idx}::text[])`
  },
  month_end: {
    select: `SELECT t.id, t.task_reference AS reference, t.title, t.owner_user_id, u.name AS owner_name, COALESCE(t.closed_at, t.completed_at) AS completed_at, (SELECT COUNT(*) FROM finance_close_task_evidence ce WHERE ce.task_id=t.id)::int AS attachment_count, qa.rating AS allocation_rating, qa.justification AS allocation_justification, qa.rater_user_id AS allocation_rater_user_id, qa.updated_at AS allocation_rated_at`,
    from: `FROM finance_close_tasks t LEFT JOIN users u ON u.id=t.owner_user_id LEFT JOIN finance_manager_quality_allocations qa ON qa.work_item_id=t.id AND qa.work_item_type='month_end'`,
    where: `LOWER(t.status) IN ('resolved','closed','completed','accepted','cancelled','canceled')`,
    ownerColumn: "t.owner_user_id",
    periodClause: (idx) => `t.kpi_period=ANY($${idx}::text[])`
  }
};

async function runQueueQuery(type, { scopeIds, monthlyKeys, includeRated }) {
  const def = QUEUE_DEFS[type];
  const params = [];
  const conditions = [def.where];
  const scope = reportingService.scopeClause(scopeIds, def.ownerColumn, params.length + 1);
  if (scope.params.length) params.push(scope.params[0]);
  conditions.push(scope.sql);
  if (monthlyKeys != null) {
    params.push(monthlyKeys);
    conditions.push(def.periodClause(params.length));
  }
  if (!includeRated) conditions.push("qa.id IS NULL");
  const order = includeRated ? "ORDER BY (qa.id IS NULL) DESC, completed_at DESC" : "ORDER BY completed_at DESC";
  return (await pool.query(`${def.select} ${def.from} WHERE ${conditions.join(" AND ")} ${order}`, params)).rows;
}

async function getQualityRatingQueue({ requestingUser, itemType, periodKey, includeRated } = {}) {
  const types = [];
  if (itemType != null && String(itemType).trim() !== "") {
    if (!WORK_ITEM_TYPES.includes(itemType)) throw fail(400, "INVALID_ITEM_TYPE", "itemType must be ticket, journal, reconciliation or month_end.");
    types.push(itemType);
  } else {
    types.push(...WORK_ITEM_TYPES);
  }
  const wantsPeriod = periodKey != null && String(periodKey).trim() !== "";
  const monthlyKeys = wantsPeriod ? financePeriodService.resolvePeriodKey(periodKey).monthlyKeys : null;
  const { scopeIds } = await reportingService.resolveScope(requestingUser);
  const items = [];
  const counts = { ticket: 0, journal: 0, reconciliation: 0, month_end: 0 };
  const warnings = [];
  for (const type of types) {
    try {
      const rows = await runQueueQuery(type, { scopeIds, monthlyKeys, includeRated: includeRated === true });
      for (const row of rows) {
        counts[type]++;
        items.push({
          workItemId: Number(row.id),
          workItemType: type,
          reference: row.reference,
          title: row.title,
          ownerUserId: row.owner_user_id != null ? Number(row.owner_user_id) : null,
          ownerName: row.owner_name || null,
          completedAt: row.completed_at,
          attachmentCount: Number(row.attachment_count || 0),
          allocation: row.allocation_rating != null
            ? {
                rating: Number(row.allocation_rating),
                justification: row.allocation_justification,
                raterUserId: row.allocation_rater_user_id != null ? Number(row.allocation_rater_user_id) : null,
                ratedAt: row.allocation_rated_at
              }
            : null
        });
      }
    } catch (error) {
      if (!["42P01", "42703"].includes(error.code)) throw error;
      warnings.push(`${type.toUpperCase()}_OMITTED`);
      console.warn(`Quality rating queue omitted ${type} items: ${error.message}`);
    }
  }
  return { items, counts: { ...counts, total: items.length }, warnings, generatedAt: new Date().toISOString() };
}

async function resolveRaterClasses(userId) {
  let role = null;
  try {
    const profile = await pool.query(`SELECT role FROM users WHERE id=$1::bigint`, [userId]);
    role = profile.rows[0]?.role ?? null;
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) throw error;
  }
  if (role === "superadmin") return { manager: true, hod: true };
  try {
    const context = await financeAccess.resolve({ user: { id: userId, role } });
    return { manager: MANAGER_LEVELS.has(context.accessLevel), hod: HOD_LEVELS.has(context.accessLevel) };
  } catch (error) {
    return { manager: false, hod: false };
  }
}

async function isConfiguredFinalApprover(raterId, ownerUserId) {
  const approverRows = await reportingService.queryTolerant(`SELECT scope_key FROM finance_final_approvers WHERE approver_user_id=$1::bigint AND active=TRUE`, [raterId]);
  const keys = new Set(approverRows.map((row) => row.scope_key));
  if (keys.has("all_finance")) return true;
  if (keys.has("ap_office") && ownerUserId != null) {
    const officeRows = await reportingService.queryTolerant(`SELECT office_code FROM finance_employee_responsibilities WHERE user_id=$1::bigint AND active=TRUE`, [Number(ownerUserId)]);
    if (officeRows.some((row) => String(row.office_code || "").trim().toUpperCase() === "AP")) return true;
  }
  return false;
}

function assertWorkItemRef(workItemId, workItemType) {
  if (workItemId == null || !Number.isFinite(Number(workItemId))) throw fail(400, "WORK_ITEM_ID_REQUIRED", "workItemId is required.");
  if (!WORK_ITEM_TYPES.includes(workItemType)) throw fail(400, "INVALID_WORK_ITEM_TYPE", "workItemType must be ticket, journal, reconciliation or month_end.");
  return Number(workItemId);
}

async function loadWorkItem(workItemId, workItemType) {
  const item = (await ITEM_LOADERS[workItemType](workItemId)).rows[0] ?? null;
  if (item == null) throw fail(404, "WORK_ITEM_NOT_FOUND", "Work item not found.");
  return item;
}

async function recordQualityAllocation({ workItemId, workItemType, rating, justification, raterUserId } = {}) {
  const itemId = assertWorkItemRef(workItemId, workItemType);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw fail(400, "QUALITY_RATING_OUT_OF_RANGE", "rating must be an integer between 1 and 5.");
  if (raterUserId == null || !Number.isFinite(Number(raterUserId))) throw fail(400, "RATER_REQUIRED", "raterUserId is required.");
  const raterId = Number(raterUserId);
  const item = await loadWorkItem(itemId, workItemType);
  if (!isItemCompleted(workItemType, item)) throw fail(409, "ITEM_NOT_COMPLETED", "The work item has not reached a completed or approved state.");
  const classes = await resolveRaterClasses(raterId);
  const finalApprover = await isConfiguredFinalApprover(raterId, item.owner_user_id);
  if (!classes.manager && !classes.hod && !finalApprover) throw fail(403, "QUALITY_ALLOCATION_AUTHORITY_REQUIRED", "Manager, HOD or configured final-approver authority is required to allocate quality.");
  if (item.owner_user_id != null && Number(item.owner_user_id) === raterId) throw fail(403, "QUALITY_SELF_RATING_PROHIBITED", "The preparer or owner of a work item may not allocate its quality.");
  const existing = (await pool.query(
    `SELECT id, rating, justification, rater_user_id, created_at, updated_at FROM finance_manager_quality_allocations WHERE work_item_id=$1::bigint AND work_item_type=$2`,
    [itemId, workItemType]
  )).rows[0] ?? null;
  const revision = existing != null;
  const allocation = (await pool.query(
    `INSERT INTO finance_manager_quality_allocations(work_item_id,work_item_type,rating,justification,rater_user_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(work_item_id,work_item_type) DO UPDATE SET rating=EXCLUDED.rating,justification=EXCLUDED.justification,rater_user_id=EXCLUDED.rater_user_id,updated_at=NOW() RETURNING id,work_item_id,work_item_type,rating,justification,rater_user_id,created_at,updated_at`,
    [itemId, workItemType, rating, justification ?? null, raterId]
  )).rows[0];
  try {
    await pool.query(
      `INSERT INTO finance_manager_quality_allocation_audit(work_item_id,work_item_type,previous_rating,new_rating,previous_rater_user_id,new_rater_user_id,reason,actor_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [itemId, workItemType, existing ? existing.rating : null, rating, existing ? existing.rater_user_id : null, raterId, justification ?? (revision ? "quality_allocation_revision" : "quality_allocation"), raterId]
    );
  } catch (error) {
    if (!["42P01", "42703"].includes(error.code)) throw error;
    console.warn(`Quality allocation audit entry omitted: ${error.message}`);
  }
  const recalculation = await financeKpiScoring.recalculateWorkItemScore({ workItemId: itemId, workItemType, reason: revision ? "quality_allocation_revision" : "quality_allocation" });
  return { allocation, qualityScore: rating * 20, recalculatedScore: recalculation?.score?.item_score != null ? Number(recalculation.score.item_score) : null, revision };
}

async function getQualityAllocation({ requestingUser, workItemId, workItemType } = {}) {
  const itemId = assertWorkItemRef(workItemId, workItemType);
  if (requestingUser == null || !Number.isFinite(Number(requestingUser.id))) throw fail(403, "REPORT_REQUESTER_REQUIRED", "A requesting user is required.");
  const item = await loadWorkItem(itemId, workItemType);
  const requesterId = Number(requestingUser.id);
  const isOwner = item.owner_user_id != null && Number(item.owner_user_id) === requesterId;
  const classes = await resolveRaterClasses(requesterId);
  if (!isOwner && !classes.manager && !classes.hod) throw fail(403, "QUALITY_ALLOCATION_VIEW_DENIED", "Quality allocation visibility requires the item owner or manager authority.");
  const current = (await reportingService.queryTolerant(
    `SELECT id,work_item_id,work_item_type,rating,justification,rater_user_id,created_at,updated_at FROM finance_manager_quality_allocations WHERE work_item_id=$1::bigint AND work_item_type=$2`,
    [itemId, workItemType]
  ))[0] ?? null;
  const history = await reportingService.queryTolerant(
    `SELECT id,work_item_id,work_item_type,previous_rating,new_rating,previous_rater_user_id,new_rater_user_id,reason,actor_user_id,created_at FROM finance_manager_quality_allocation_audit WHERE work_item_id=$1::bigint AND work_item_type=$2 ORDER BY created_at DESC`,
    [itemId, workItemType]
  );
  return { current, history };
}

module.exports = { getQualityRatingQueue, recordQualityAllocation, getQualityAllocation, WORK_ITEM_TYPES };