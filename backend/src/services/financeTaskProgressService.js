const pool = require("../db/pool");
const { sendEmail } = require("./email");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const TASK_TABLES = {ticket: "tickets", journal: "finance_journals", reconciliation: "finance_reconciliations", month_end: "finance_close_tasks"};
const COMPLETE_STATUSES = new Set(["resolved", "closed", "completed", "accepted", "cancelled", "canceled", "posted", "published"]);

async function loadTask(taskId, taskType) {
  const table = TASK_TABLES[taskType];
  if (!table) throw fail(400, "INVALID_TASK_TYPE", "Task type must be ticket, journal, reconciliation or month_end.");
  const task = (await pool.query(
    `SELECT id,status,progress_percentage,created_at,due_at FROM ${table} WHERE id=$1::bigint`,
    [taskId]
  )).rows[0];
  if (!task) throw fail(404, "TASK_NOT_FOUND", "Task not found.");
  return task;
}

async function latestProgress(taskId, taskType) {
  const row = (await pool.query(
    `SELECT new_progress FROM finance_task_progress_updates WHERE task_id=$1::bigint AND task_type=$2 ORDER BY created_at DESC LIMIT 1`,
    [taskId, taskType]
  )).rows[0];
  return row ? Number(row.new_progress) : null;
}

async function notifyManagerOfTrajectory(taskType, taskId, newProgress) {
  try {
    const table = TASK_TABLES[taskType];
    const ownerColumn = taskType === "ticket" ? "assigned_to_user_id" : (taskType === "journal" ? "preparer_user_id" : "owner_user_id");
    const task = (await pool.query(`SELECT t.id,t.due_at,t.created_at,t.${ownerColumn} AS owner_user_id FROM ${table} t WHERE t.id=$1::bigint`, [taskId])).rows[0];
    if (!task?.owner_user_id || !task.due_at || !task.created_at) return null;
    const start = new Date(task.created_at).getTime();
    const due = new Date(task.due_at).getTime();
    const now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start || now >= due) return null;
    const expectedProgress = ((now - start) / (due - start)) * 100;
    if (newProgress >= expectedProgress) return null;
    const manager = (await pool.query(
      `SELECT fr.manager_user_id,u.email,u.name FROM finance_employee_responsibilities fr JOIN users u ON u.id=fr.manager_user_id WHERE fr.user_id=$1::bigint AND fr.active=TRUE AND fr.manager_user_id IS NOT NULL LIMIT 1`,
      [task.owner_user_id]
    )).rows[0];
    if (!manager?.email) return null;
    await sendEmail({
      to: manager.email,
      category: "finance_task_progress",
      subject: `[${taskType}-${taskId}] Team task progress behind trajectory`,
      text: `A task assigned to a member of your team is behind its expected progress trajectory.\n\nTask ID: ${taskId} (${taskType})\nCurrent progress: ${newProgress}%\nExpected progress: ${Math.round(expectedProgress)}%\n\nConcern: progress_behind_trajectory`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>Task progress behind trajectory</h2><p>Task ID: ${taskId} (${taskType})<br>Current progress: ${newProgress}%<br>Expected progress: ${Math.round(expectedProgress)}%</p><p>Concern: progress_behind_trajectory</p></div>`
    });
    return {concern: "progress_behind_trajectory", expectedProgress: Math.round(expectedProgress * 100) / 100};
  } catch (error) {
    console.warn("Trajectory notification failed:", error.message);
    return null;
  }
}

async function updateProgress({taskId, taskType, newProgress, newStatus, actorUserId, reason}) {
  if (!taskId || !actorUserId) throw fail(400, "PROGRESS_FIELDS_REQUIRED", "Task ID and actor are required.");
  const progress = Number(newProgress);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw fail(400, "INVALID_PROGRESS_VALUE", "Progress must be between 0 and 100.");
  const task = await loadTask(taskId, taskType);
  if (COMPLETE_STATUSES.has(String(task.status || "").toLowerCase())) {
    throw fail(409, "TASK_CLOSED_PROGRESS_UPDATE_DENIED", "Closed tasks do not accept progress updates.");
  }
  const previous = await latestProgress(taskId, taskType);
  const previousProgress = previous ?? Number(task.progress_percentage ?? 0);
  if (progress < previousProgress) {
    if (!reason || String(reason).trim().length < 10) {
      throw fail(400, "PROGRESS_REDUCTION_REASON_REQUIRED", "A reason of at least 10 characters is required when reducing progress.");
    }
  }
  const table = TASK_TABLES[taskType];
  const effectiveNewStatus = newStatus ?? task.status;
  const partiallyComplete = progress > 0 && progress < 100;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const audit = await client.query(
      `INSERT INTO finance_task_progress_updates(task_id,task_type,previous_progress,new_progress,previous_status,new_status,actor_user_id,reason)
       VALUES($1::bigint,$2,$3::numeric,$4::numeric,$5,$6,$7::bigint,$8) RETURNING *`,
      [taskId, taskType, previousProgress, progress, task.status, effectiveNewStatus, actorUserId, reason ?? null]
    );
    await client.query(
      `UPDATE ${table} SET progress_percentage=$2::numeric,partially_complete=$3,last_progress_update_at=NOW(),status=$4 WHERE id=$1::bigint`,
      [taskId, progress, partiallyComplete, effectiveNewStatus]
    );
    await client.query("COMMIT");
    const trajectoryConcern = partiallyComplete || progress > 0 ? await notifyManagerOfTrajectory(taskType, taskId, progress) : null;
    return {
      taskId: Number(taskId),
      taskType,
      previousProgress,
      newProgress: progress,
      previousStatus: task.status,
      newStatus: effectiveNewStatus,
      partiallyComplete,
      trajectoryConcern,
      audit: audit.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getProgressHistory({taskId, taskType, limit = 50}) {
  const table = TASK_TABLES[taskType];
  if (!table) throw fail(400, "INVALID_TASK_TYPE", "Task type must be ticket, journal, reconciliation or month_end.");
  const result = await pool.query(
    `SELECT p.*,u.name actor_name FROM finance_task_progress_updates p LEFT JOIN users u ON u.id=p.actor_user_id
     WHERE p.task_id=$1::bigint AND p.task_type=$2 ORDER BY p.created_at DESC LIMIT $3`,
    [taskId, taskType, Number(limit)]
  );
  return result.rows;
}

async function reopenTask({taskId, taskType, actorUserId, reason}) {
  const task = await loadTask(taskId, taskType);
  if (!COMPLETE_STATUSES.has(String(task.status || "").toLowerCase())) {
    throw fail(409, "TASK_NOT_CLOSED", "Only closed tasks can be reopened.");
  }
  const table = TASK_TABLES[taskType];
  const reopenedStatus = taskType === "ticket" ? "In Progress" : "draft";
  const preservedProgress = await latestProgress(taskId, taskType) ?? Number(task.progress_percentage ?? 0);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const audit = await client.query(
      `INSERT INTO finance_task_progress_updates(task_id,task_type,previous_progress,new_progress,previous_status,new_status,actor_user_id,reason)
       VALUES($1::bigint,$2,$3::numeric,$4::numeric,$5,$6,$7::bigint,$8) RETURNING *`,
      [taskId, taskType, preservedProgress, preservedProgress, task.status, reopenedStatus, actorUserId, reason ?? "reopen"]
    );
    await client.query(
      `UPDATE ${table} SET status=$2,partially_complete=$3,last_progress_update_at=NOW() WHERE id=$1::bigint`,
      [taskId, reopenedStatus, preservedProgress > 0 && preservedProgress < 100]
    );
    await client.query("COMMIT");
    return {taskId: Number(taskId), taskType, status: reopenedStatus, preservedProgress, audit: audit.rows[0]};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function logTime({taskId, taskType, userId, startTime, endTime, description}) {
  if (!taskId || !taskType || !userId) throw fail(400, "TIME_ENTRY_FIELDS_REQUIRED", "Task, type and user are required.");
  if (!TASK_TABLES[taskType]) throw fail(400, "INVALID_TASK_TYPE", "Task type must be ticket, journal, reconciliation or month_end.");
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw fail(400, "INVALID_TIME_RANGE", "Start and end times must be valid dates.");
  if (end.getTime() <= start.getTime()) throw fail(400, "INVALID_TIME_RANGE", "End time must be after start time.");
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const overlap = await pool.query(
    `SELECT id FROM finance_time_tracking_entries WHERE task_id=$1::bigint AND task_type=$2 AND user_id=$3::bigint
     AND NOT (end_time <= $4 OR start_time >= $5) LIMIT 1`,
    [taskId, taskType, userId, start.toISOString(), end.toISOString()]
  );
  if (overlap.rowCount) console.warn("TIME_ENTRY_OVERLAP", {taskId, taskType, userId, startTime, endTime});
  const result = await pool.query(
    `INSERT INTO finance_time_tracking_entries(task_id,task_type,user_id,start_time,end_time,duration_minutes,description)
     VALUES($1::bigint,$2,$3::bigint,$4,$5,$6,$7) RETURNING *`,
    [taskId, taskType, userId, start.toISOString(), end.toISOString(), durationMinutes, description ?? null]
  );
  return {...result.rows[0], overlap: Boolean(overlap.rowCount)};
}

async function getTimeEntries({taskId, taskType, userId, dateRange}) {
  const clauses = [];
  const params = [];
  if (taskId != null) { params.push(taskId); clauses.push(`task_id=$${params.length}::bigint`); }
  if (taskType != null) { params.push(taskType); clauses.push(`task_type=$${params.length}`); }
  if (userId != null) { params.push(userId); clauses.push(`user_id=$${params.length}::bigint`); }
  if (dateRange?.from != null) { params.push(dateRange.from); clauses.push(`start_time >= $${params.length}`); }
  if (dateRange?.to != null) { params.push(dateRange.to); clauses.push(`start_time < $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT e.*,u.name user_name FROM finance_time_tracking_entries e LEFT JOIN users u ON u.id=e.user_id
     ${where} ORDER BY e.start_time DESC`,
    params
  );
  const totalDuration = result.rows.reduce((s, r) => s + Number(r.duration_minutes || 0), 0);
  return {entries: result.rows, totalDurationMinutes: totalDuration};
}

async function getTimeSummary({userId, periodKey}) {
  if (!userId) throw fail(400, "TIME_ENTRY_FIELDS_REQUIRED", "A user ID is required.");
  const params = [userId];
  let periodClause = "";
  if (periodKey) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(periodKey));
    if (match) {
      params.push(`${match[1]}-${match[2]}-01`);
      periodClause = `AND start_time >= $${params.length}::timestamptz AND start_time < ($${params.length}::timestamptz + INTERVAL '1 month')`;
    }
  }
  const result = await pool.query(
    `SELECT task_type,SUM(duration_minutes) AS total_minutes,COUNT(*) AS task_count FROM finance_time_tracking_entries
     WHERE user_id=$1::bigint ${periodClause} GROUP BY task_type ORDER BY task_type`,
    params
  );
  return result.rows.map(row => ({
    taskType: row.task_type,
    totalMinutes: Number(row.total_minutes),
    taskCount: Number(row.task_count)
  }));
}

module.exports = {
  updateProgress,
  getProgressHistory,
  reopenTask,
  logTime,
  getTimeEntries,
  getTimeSummary
};