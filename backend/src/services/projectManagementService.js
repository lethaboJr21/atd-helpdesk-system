const pool = require("../db/pool");

const PROJECT_ROLES = new Set(["owner", "project_manager", "contributor", "viewer"]);
const ASSIGNABLE_ROLES = new Set(["project_manager", "contributor", "viewer"]);
const TASK_STATUSES = new Set(["not_started", "in_progress", "blocked", "done"]);
const TASK_TYPES = new Set(["task", "deliverable"]);
const PRIORITIES = new Set(["Low", "Medium", "High", "Critical"]);
const PROJECT_STATUSES = new Set(["planning", "active", "on_hold", "completed", "archived"]);

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

function assertProjectWritable(project) {
  if (project.status === "archived") {
    throw httpError(409, "Archived projects are read-only.", "PROJECT_ARCHIVED");
  }
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function positiveId(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw httpError(400, `${label} must be a valid ID.`, "PROJECT_ID_INVALID");
  }
  return parsed;
}

function dateValue(value, label, required = false) {
  const date = clean(value, 10);
  if (!date) {
    if (required) throw httpError(400, `${label} is required.`, "PROJECT_DATE_REQUIRED");
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw httpError(400, `${label} must be a valid calendar date.`, "PROJECT_DATE_INVALID");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw httpError(400, `${label} must be a valid calendar date.`, "PROJECT_DATE_INVALID");
  }
  return date;
}

function validateProject(input = {}) {
  input = input || {};
  const name = clean(input.name, 180);
  const description = clean(input.description, 5000);
  const startDate = dateValue(input.startDate, "Project start date");
  const dueDate = dateValue(input.dueDate, "Project due date");
  if (name.length < 2) {
    throw httpError(400, "Project name is required.", "PROJECT_NAME_REQUIRED");
  }
  if (startDate && dueDate && startDate > dueDate) {
    throw httpError(400, "Project due date cannot be before its start date.", "PROJECT_DATE_ORDER_INVALID");
  }
  return { name, description, startDate, dueDate };
}

function validateTask(input = {}) {
  input = input || {};
  const title = clean(input.title, 240);
  const description = clean(input.description, 5000);
  const taskType = clean(input.taskType || "task", 20);
  const ownerUserId = positiveId(input.ownerUserId, "Deliverable owner");
  const dueDate = dateValue(input.dueDate, "Due date", true);
  const priority = clean(input.priority || "Medium", 12);
  if (title.length < 2) {
    throw httpError(400, "Task or deliverable title is required.", "PROJECT_TASK_TITLE_REQUIRED");
  }
  if (!TASK_TYPES.has(taskType)) {
    throw httpError(400, "Choose a valid task type.", "PROJECT_TASK_TYPE_INVALID");
  }
  if (!PRIORITIES.has(priority)) {
    throw httpError(400, "Choose a valid priority.", "PROJECT_TASK_PRIORITY_INVALID");
  }
  return { title, description, taskType, ownerUserId, dueDate, priority };
}

function validateAnnouncement(input = {}) {
  input = input || {};
  const title = clean(input.title, 180);
  const body = clean(input.body, 5000);
  if (title.length < 2 || !body) {
    throw httpError(400, "Announcement title and message are required.", "PROJECT_ANNOUNCEMENT_REQUIRED");
  }
  return { title, body };
}

async function getProjectAccess(projectId, user, database = pool) {
  const projectResult = await database.query(
    "SELECT * FROM projects WHERE id=$1",
    [projectId]
  );
  const project = projectResult.rows[0];
  if (!project) throw httpError(404, "Project not found.", "PROJECT_NOT_FOUND");

  const memberResult = await database.query(
    `SELECT member_role FROM project_members
     WHERE project_id=$1 AND user_id=$2 AND is_active=TRUE
     LIMIT 1`,
    [projectId, user.id]
  );
  const role = memberResult.rows[0]?.member_role;
  if (!role || !PROJECT_ROLES.has(role)) {
    throw httpError(403, "Project membership is required to view this workspace.", "PROJECT_ACCESS_DENIED");
  }
  return {
    project,
    role,
    canManage: role === "owner" || role === "project_manager",
  };
}

async function writeEvent(database, projectId, actorUserId, eventType, entityType, entityId, details = {}) {
  await database.query(
    `INSERT INTO project_activity_events(
       project_id, actor_user_id, event_type, entity_type, entity_id, details
     ) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
    [projectId, actorUserId || null, eventType, entityType, entityId || null, JSON.stringify(details)]
  );
}

async function listProjects(user) {
  const result = await pool.query(
    `SELECT p.id, p.name, p.description, p.status, p.visibility,
            p.start_date, p.due_date, p.created_at, p.updated_at,
            pm.member_role,
            COUNT(t.id)::int AS task_count,
            COUNT(t.id) FILTER (WHERE t.status='done')::int AS completed_count,
            COUNT(t.id) FILTER (WHERE t.status='blocked')::int AS blocked_count,
            COUNT(t.id) FILTER (WHERE t.status<>'done' AND t.due_date<CURRENT_DATE)::int AS overdue_count
     FROM projects p
     JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1 AND pm.is_active=TRUE
     LEFT JOIN project_tasks t ON t.project_id=p.id
     GROUP BY p.id, pm.member_role
     ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 ELSE 2 END,
              p.updated_at DESC`,
    [user.id]
  );
  return result.rows;
}

async function createProject(input, user) {
  const projectInput = validateProject(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO projects(name, description, start_date, due_date, created_by_user_id)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [projectInput.name, projectInput.description, projectInput.startDate, projectInput.dueDate, user.id]
    );
    const project = result.rows[0];
    await client.query(
      `INSERT INTO project_members(project_id,user_id,member_role,added_by_user_id)
       VALUES($1,$2,'owner',$2)`,
      [project.id, user.id]
    );
    await writeEvent(client, project.id, user.id, "project.created", "project", project.id, {
      name: project.name,
    });
    await client.query("COMMIT");
    return project;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateProjectStatus(projectId, status, user) {
  projectId = positiveId(projectId, "Project ID");
  status = clean(status, 20);
  if (!PROJECT_STATUSES.has(status)) {
    throw httpError(400, "Choose a valid project status.", "PROJECT_STATUS_INVALID");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await getProjectAccess(projectId, user, client);
    if (!access.canManage) {
      throw httpError(403, "Project owner or manager access is required to change project status.", "PROJECT_STATUS_UPDATE_DENIED");
    }
    if (access.project.status === "archived" && status !== "archived") {
      throw httpError(409, "Archived projects cannot be reactivated.", "PROJECT_ARCHIVED");
    }
    const result = await client.query(
      `UPDATE projects SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,
      [projectId, status]
    );
    if (access.project.status !== status) {
      await writeEvent(client, projectId, user.id, "project.status_changed", "project", projectId, {
        from: access.project.status,
        to: status,
      });
    }
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getProjectWorkspace(projectId, user) {
  projectId = positiveId(projectId, "Project ID");
  const access = await getProjectAccess(projectId, user);
  const [tasksResult, membersResult, announcementsResult, activityResult] = await Promise.all([
    pool.query(
      `SELECT t.*, owner.name AS owner_name, creator.name AS created_by_name,
              updater.name AS updated_by_name
       FROM project_tasks t
       JOIN users owner ON owner.id=t.owner_user_id
       JOIN users creator ON creator.id=t.created_by_user_id
       LEFT JOIN users updater ON updater.id=t.updated_by_user_id
       WHERE t.project_id=$1
       ORDER BY CASE t.status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1
                              WHEN 'not_started' THEN 2 ELSE 3 END,
                t.due_date ASC, t.updated_at DESC`,
      [projectId]
    ),
    pool.query(
      `SELECT pm.user_id, pm.member_role, pm.created_at,
              u.name, u.email, u.department, u.job_title
       FROM project_members pm JOIN users u ON u.id=pm.user_id
       WHERE pm.project_id=$1 AND pm.is_active=TRUE
       ORDER BY CASE pm.member_role WHEN 'owner' THEN 0 WHEN 'project_manager' THEN 1
                                    WHEN 'contributor' THEN 2 ELSE 3 END, u.name`,
      [projectId]
    ),
    pool.query(
      `SELECT a.*, u.name AS author_name
       FROM project_announcements a JOIN users u ON u.id=a.author_user_id
       WHERE a.project_id=$1
       ORDER BY a.created_at DESC LIMIT 50`,
      [projectId]
    ),
    pool.query(
      `SELECT e.id, e.event_type, e.entity_type, e.entity_id, e.details, e.created_at,
              u.name AS actor_name
       FROM project_activity_events e
       LEFT JOIN users u ON u.id=e.actor_user_id
       WHERE e.project_id=$1
       ORDER BY e.created_at DESC LIMIT 100`,
      [projectId]
    ),
  ]);
  const tasks = tasksResult.rows;
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "done").length;
  const metrics = {
    total,
    completed,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    overdue: tasks.filter((task) => task.status !== "done" && String(task.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10)).length,
    averageProgress: total
      ? Math.round(tasks.reduce((sum, task) => sum + Number(task.progress_percent || 0), 0) / total)
      : 0,
    completionPercent: total ? Math.round((completed / total) * 100) : 0,
  };
  return {
    project: access.project,
    access: {
      role: access.role,
      canManage: access.canManage,
      currentUserId: Number(user.id),
    },
    metrics,
    tasks,
    members: membersResult.rows,
    announcements: announcementsResult.rows,
    activity: activityResult.rows,
  };
}

async function listMemberCandidates(projectId, search, user) {
  projectId = positiveId(projectId, "Project ID");
  const access = await getProjectAccess(projectId, user);
  if (!access.canManage) {
    throw httpError(403, "Project owner or manager access is required to manage members.", "PROJECT_MEMBER_MANAGEMENT_DENIED");
  }
  const query = clean(search, 120);
  if (query.length < 2) return [];
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.department, u.job_title
     FROM users u
     WHERE u.approved=TRUE AND u.status='active'
       AND u.archived_at IS NULL AND u.deactivated_at IS NULL
       AND u.account_type='person' AND COALESCE(u.microsoft_account_enabled,TRUE)=TRUE
       AND (u.name ILIKE $2 OR u.email ILIKE $2)
       AND NOT EXISTS (
         SELECT 1 FROM project_members pm
         WHERE pm.project_id=$1 AND pm.user_id=u.id AND pm.is_active=TRUE
       )
     ORDER BY u.name LIMIT 20`,
    [projectId, `%${query}%`]
  );
  return result.rows;
}

async function addProjectMember(projectId, input, user) {
  projectId = positiveId(projectId, "Project ID");
  const userId = positiveId(input.userId, "User ID");
  const role = clean(input.role, 24);
  if (!ASSIGNABLE_ROLES.has(role)) {
    throw httpError(400, "Choose project manager, contributor, or viewer.", "PROJECT_MEMBER_ROLE_INVALID");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await getProjectAccess(projectId, user, client);
    if (!access.canManage) {
      throw httpError(403, "Project owner or manager access is required to manage members.", "PROJECT_MEMBER_MANAGEMENT_DENIED");
    }
    assertProjectWritable(access.project);
    const candidate = await client.query(
      `SELECT id, name, email FROM users
       WHERE id=$1 AND approved=TRUE AND status='active'
         AND archived_at IS NULL AND deactivated_at IS NULL
         AND account_type='person' AND COALESCE(microsoft_account_enabled,TRUE)=TRUE`,
      [userId]
    );
    if (!candidate.rows[0]) {
      throw httpError(404, "An active employee account was not found.", "PROJECT_MEMBER_CANDIDATE_NOT_FOUND");
    }
    const result = await client.query(
      `INSERT INTO project_members(project_id,user_id,member_role,added_by_user_id,is_active,updated_at)
       VALUES($1,$2,$3,$4,TRUE,NOW())
       ON CONFLICT(project_id,user_id) DO UPDATE
         SET member_role=EXCLUDED.member_role,is_active=TRUE,added_by_user_id=EXCLUDED.added_by_user_id,updated_at=NOW()
       RETURNING *`,
      [projectId, userId, role, user.id]
    );
    await writeEvent(client, projectId, user.id, "member.added", "member", userId, {
      memberName: candidate.rows[0].name,
      role,
    });
    await client.query("COMMIT");
    return { ...result.rows[0], ...candidate.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function removeProjectMember(projectId, userId, user) {
  projectId = positiveId(projectId, "Project ID");
  userId = positiveId(userId, "User ID");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await getProjectAccess(projectId, user, client);
    if (!access.canManage) {
      throw httpError(403, "Project owner or manager access is required to manage members.", "PROJECT_MEMBER_MANAGEMENT_DENIED");
    }
    assertProjectWritable(access.project);
    const current = await client.query(
      "SELECT member_role FROM project_members WHERE project_id=$1 AND user_id=$2 AND is_active=TRUE FOR UPDATE",
      [projectId, userId]
    );
    if (!current.rows[0]) throw httpError(404, "Active project member not found.", "PROJECT_MEMBER_NOT_FOUND");
    if (current.rows[0].member_role === "owner") {
      throw httpError(409, "The project owner cannot be removed.", "PROJECT_OWNER_REQUIRED");
    }
    await client.query(
      `UPDATE project_members SET is_active=FALSE,updated_at=NOW()
       WHERE project_id=$1 AND user_id=$2`,
      [projectId, userId]
    );
    await writeEvent(client, projectId, user.id, "member.removed", "member", userId, {
      previousRole: current.rows[0].member_role,
    });
    await client.query("COMMIT");
    return { projectId, userId, removed: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createTask(projectId, input, user) {
  projectId = positiveId(projectId, "Project ID");
  const task = validateTask(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await getProjectAccess(projectId, user, client);
    if (!access.canManage) {
      throw httpError(403, "Project owner or manager access is required to allocate tasks.", "PROJECT_TASK_CREATE_DENIED");
    }
    assertProjectWritable(access.project);
    const owner = await client.query(
      `SELECT 1 FROM project_members
       WHERE project_id=$1 AND user_id=$2 AND is_active=TRUE
         AND member_role IN ('owner','project_manager','contributor')`,
      [projectId, task.ownerUserId]
    );
    if (!owner.rows[0]) {
      throw httpError(400, "The accountable owner must be an active project member who can contribute.", "PROJECT_TASK_OWNER_INVALID");
    }
    const result = await client.query(
      `INSERT INTO project_tasks(
         project_id,title,description,task_type,owner_user_id,due_date,priority,created_by_user_id
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [projectId, task.title, task.description, task.taskType, task.ownerUserId, task.dueDate, task.priority, user.id]
    );
    await writeEvent(client, projectId, user.id, "task.created", task.taskType, result.rows[0].id, {
      title: task.title,
      ownerUserId: task.ownerUserId,
      dueDate: task.dueDate,
    });
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateTask(projectId, taskId, input, user) {
  input = input || {};
  projectId = positiveId(projectId, "Project ID");
  taskId = positiveId(taskId, "Task ID");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await getProjectAccess(projectId, user, client);
    assertProjectWritable(access.project);
    const currentResult = await client.query(
      "SELECT * FROM project_tasks WHERE id=$1 AND project_id=$2 FOR UPDATE",
      [taskId, projectId]
    );
    const current = currentResult.rows[0];
    if (!current) throw httpError(404, "Project task not found.", "PROJECT_TASK_NOT_FOUND");
    const isOwner = Number(current.owner_user_id) === Number(user.id);
    if (!access.canManage && !isOwner) {
      throw httpError(403, "Only project managers or the accountable owner can update this task.", "PROJECT_TASK_UPDATE_DENIED");
    }
    const next = { ...current };
    if (input.status !== undefined) {
      const status = clean(input.status, 20);
      if (!TASK_STATUSES.has(status)) throw httpError(400, "Choose a valid task status.", "PROJECT_TASK_STATUS_INVALID");
      next.status = status;
    }
    if (input.progressPercent !== undefined) {
      const progress = Number(input.progressPercent);
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
        throw httpError(400, "Progress must be a whole number from 0 to 100.", "PROJECT_TASK_PROGRESS_INVALID");
      }
      next.progress_percent = progress;
    }
    if (access.canManage) {
      if (input.title !== undefined) {
        next.title = clean(input.title, 240);
        if (next.title.length < 2) throw httpError(400, "Task title is required.", "PROJECT_TASK_TITLE_REQUIRED");
      }
      if (input.description !== undefined) next.description = clean(input.description, 5000);
      if (input.taskType !== undefined) {
        next.task_type = clean(input.taskType, 20);
        if (!TASK_TYPES.has(next.task_type)) throw httpError(400, "Choose a valid task type.", "PROJECT_TASK_TYPE_INVALID");
      }
      if (input.ownerUserId !== undefined) {
        next.owner_user_id = positiveId(input.ownerUserId, "Deliverable owner");
        const owner = await client.query(
          `SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2
           AND is_active=TRUE AND member_role IN ('owner','project_manager','contributor')`,
          [projectId, next.owner_user_id]
        );
        if (!owner.rows[0]) throw httpError(400, "The accountable owner must be an active contributing project member.", "PROJECT_TASK_OWNER_INVALID");
      }
      if (input.dueDate !== undefined) next.due_date = dateValue(input.dueDate, "Due date", true);
      if (input.priority !== undefined) {
        next.priority = clean(input.priority, 12);
        if (!PRIORITIES.has(next.priority)) throw httpError(400, "Choose a valid priority.", "PROJECT_TASK_PRIORITY_INVALID");
      }
    } else if (["title", "description", "taskType", "ownerUserId", "dueDate", "priority"].some((key) => input[key] !== undefined)) {
      throw httpError(403, "Only project managers can change task ownership or planning details.", "PROJECT_TASK_PLAN_UPDATE_DENIED");
    }
    if (next.status === "done") next.progress_percent = 100;
    else if (next.progress_percent === 100) next.progress_percent = 99;

    const result = await client.query(
      `UPDATE project_tasks SET
         title=$3,description=$4,task_type=$5,owner_user_id=$6,due_date=$7,priority=$8,
         status=$9,progress_percent=$10,updated_by_user_id=$11,updated_at=NOW(),
         completed_at=CASE WHEN $9='done' THEN COALESCE(completed_at,NOW()) ELSE NULL END
       WHERE id=$1 AND project_id=$2 RETURNING *`,
      [
        taskId, projectId, next.title, next.description, next.task_type, next.owner_user_id,
        next.due_date, next.priority, next.status, next.progress_percent, user.id,
      ]
    );
    await writeEvent(client, projectId, user.id, "task.updated", current.task_type, taskId, {
      before: {
        status: current.status,
        progressPercent: current.progress_percent,
        ownerUserId: current.owner_user_id,
        dueDate: String(current.due_date).slice(0, 10),
      },
      after: {
        status: result.rows[0].status,
        progressPercent: result.rows[0].progress_percent,
        ownerUserId: result.rows[0].owner_user_id,
        dueDate: String(result.rows[0].due_date).slice(0, 10),
      },
    });
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createAnnouncement(projectId, input, user) {
  projectId = positiveId(projectId, "Project ID");
  const announcement = validateAnnouncement(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await getProjectAccess(projectId, user, client);
    if (!access.canManage) {
      throw httpError(403, "Project owner or manager access is required to publish announcements.", "PROJECT_ANNOUNCEMENT_CREATE_DENIED");
    }
    assertProjectWritable(access.project);
    const result = await client.query(
      `INSERT INTO project_announcements(project_id,title,body,author_user_id)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [projectId, announcement.title, announcement.body, user.id]
    );
    await writeEvent(client, projectId, user.id, "announcement.published", "announcement", result.rows[0].id, {
      title: announcement.title,
      audience: "members",
    });
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  validateProject,
  validateTask,
  validateAnnouncement,
  getProjectAccess,
  listProjects,
  createProject,
  updateProjectStatus,
  getProjectWorkspace,
  listMemberCandidates,
  addProjectMember,
  removeProjectMember,
  createTask,
  updateTask,
  createAnnouncement,
};
