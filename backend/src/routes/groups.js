const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const router = express.Router();
router.use(auth);

const OPERATIONS_ROLES = ["agent", "operator", "manager", "admin", "superadmin"];
const ADMIN_ROLES = ["manager", "admin", "superadmin"];

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

const ELIGIBLE_AGENT_WHERE = `
  u.approved = TRUE
  AND u.status = 'active'
  AND u.archived_at IS NULL
  AND COALESCE(u.account_type, 'person') = 'person'
  AND COALESCE(u.microsoft_account_enabled, TRUE) = TRUE
  AND u.role IN ('agent','operator','manager','admin','superadmin')
`;

async function groupExists(database, groupId) {
  const result = await database.query(
    "SELECT id FROM support_groups WHERE id = $1 LIMIT 1",
    [groupId]
  );
  return Boolean(result.rows[0]);
}

async function eligibleAgent(database, userId) {
  const result = await database.query(
    `SELECT u.id, u.name, u.email, u.role
     FROM users u
     WHERE u.id = $1 AND ${ELIGIBLE_AGENT_WHERE}
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

router.get("/catalogue", async (_request, response) => {
  try {
    const result = await pool.query(`
      SELECT
        g.id,
        g.name,
        g.description,
        g.is_default_triage,
        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'job_title', u.job_title,
              'department', u.department
            ) ORDER BY u.name
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS members
      FROM support_groups g
      LEFT JOIN support_group_members gm ON gm.group_id = g.id
      LEFT JOIN users u ON u.id = gm.user_id AND ${ELIGIBLE_AGENT_WHERE}
      WHERE COALESCE(g.is_active, TRUE) = TRUE
      GROUP BY g.id, g.name, g.description, g.is_default_triage
      ORDER BY g.is_default_triage DESC, g.name
    `);
    return response.json(result.rows);
  } catch (error) {
    console.error("Fetch support-group catalogue failed:", error);
    return response.status(500).json({ error: "Failed to fetch support groups." });
  }
});

router.get("/eligible-agents", allowRoles(...ADMIN_ROLES), async (_request, response) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.job_title, u.department,
        COALESCE(json_agg(json_build_object('id', g.id, 'name', g.name))
          FILTER (WHERE g.id IS NOT NULL), '[]'::json) AS groups
      FROM users u
      LEFT JOIN support_group_members gm ON gm.user_id = u.id
      LEFT JOIN support_groups g ON g.id = gm.group_id
      WHERE ${ELIGIBLE_AGENT_WHERE}
      GROUP BY u.id
      ORDER BY u.name, u.email
    `);
    return response.json(result.rows);
  } catch (error) {
    console.error("Fetch eligible agents failed:", error);
    return response.status(500).json({ error: "Failed to fetch eligible agents." });
  }
});

router.get("/", allowRoles(...OPERATIONS_ROLES), async (_request, response) => {
  try {
    const result = await pool.query(`
      SELECT
        g.id, g.name, g.description, g.is_active, g.is_default_triage,
        g.notification_email, g.manager_user_id, g.escalation_user_id,
        manager.name AS manager_name,
        escalation.name AS escalation_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id, 'name', u.name, 'email', u.email, 'role', u.role,
              'job_title', u.job_title, 'department', u.department
            ) ORDER BY u.name, u.email
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS members
      FROM support_groups g
      LEFT JOIN support_group_members gm ON gm.group_id = g.id
      LEFT JOIN users u ON u.id = gm.user_id AND ${ELIGIBLE_AGENT_WHERE}
      LEFT JOIN users manager ON manager.id = g.manager_user_id
      LEFT JOIN users escalation ON escalation.id = g.escalation_user_id
      GROUP BY g.id, manager.name, escalation.name
      ORDER BY g.is_default_triage DESC, g.name
    `);
    return response.json(result.rows);
  } catch (error) {
    console.error("Fetch support groups failed:", error);
    return response.status(500).json({ error: "Failed to fetch support groups." });
  }
});

router.post("/", allowRoles(...ADMIN_ROLES), async (request, response) => {
  const name = cleanText(request.body.name, 120);
  const description = cleanText(request.body.description, 1000) || null;
  if (!name) return response.status(400).json({ error: "Group name is required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (request.body.isDefaultTriage === true) {
      await client.query("UPDATE support_groups SET is_default_triage = FALSE WHERE is_default_triage = TRUE");
    }
    const result = await client.query(`
      INSERT INTO support_groups (
        name, description, is_active, is_default_triage, notification_email,
        manager_user_id, escalation_user_id, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      RETURNING *
    `, [
      name,
      description,
      request.body.isActive !== false,
      request.body.isDefaultTriage === true,
      cleanText(request.body.notificationEmail, 320) || null,
      parseId(request.body.managerUserId),
      parseId(request.body.escalationUserId),
    ]);
    await client.query("COMMIT");
    return response.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return response.status(409).json({ error: "A support group with this name already exists." });
    console.error("Create support group failed:", error);
    return response.status(500).json({ error: "Failed to create support group." });
  } finally {
    client.release();
  }
});

router.put("/:id", allowRoles(...ADMIN_ROLES), async (request, response) => {
  const groupId = parseId(request.params.id);
  const name = cleanText(request.body.name, 120);
  if (!groupId) return response.status(400).json({ error: "Invalid support-group ID." });
  if (!name) return response.status(400).json({ error: "Group name is required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!await groupExists(client, groupId)) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "Support group not found." });
    }
    if (request.body.isDefaultTriage === true) {
      await client.query("UPDATE support_groups SET is_default_triage = FALSE WHERE id <> $1", [groupId]);
    }
    const result = await client.query(`
      UPDATE support_groups SET
        name=$1, description=$2, is_active=$3, is_default_triage=$4,
        notification_email=$5, manager_user_id=$6, escalation_user_id=$7,
        updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [
      name,
      cleanText(request.body.description, 1000) || null,
      request.body.isActive !== false,
      request.body.isDefaultTriage === true,
      cleanText(request.body.notificationEmail, 320) || null,
      parseId(request.body.managerUserId),
      parseId(request.body.escalationUserId),
      groupId,
    ]);
    await client.query("COMMIT");
    return response.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Update support group failed:", error);
    return response.status(500).json({ error: "Failed to update support group." });
  } finally {
    client.release();
  }
});

router.post("/:id/members", allowRoles(...ADMIN_ROLES), async (request, response) => {
  const groupId = parseId(request.params.id);
  const userId = parseId(request.body.userId);
  if (!groupId || !userId) return response.status(400).json({ error: "A valid group and agent are required." });
  try {
    if (!await groupExists(pool, groupId)) return response.status(404).json({ error: "Support group not found." });
    if (!await eligibleAgent(pool, userId)) return response.status(400).json({ error: "The selected account is not an eligible agent." });
    await pool.query(`
      INSERT INTO support_group_members (group_id, user_id)
      VALUES ($1,$2)
      ON CONFLICT (group_id, user_id) DO NOTHING
    `, [groupId, userId]);
    return response.status(201).json({ message: "Agent added to support group." });
  } catch (error) {
    console.error("Add support-group member failed:", error);
    return response.status(500).json({ error: "Failed to add agent to support group." });
  }
});

router.delete("/:id/members/:userId", allowRoles(...ADMIN_ROLES), async (request, response) => {
  const groupId = parseId(request.params.id);
  const userId = parseId(request.params.userId);
  if (!groupId || !userId) return response.status(400).json({ error: "Invalid group or agent ID." });
  try {
    await pool.query("DELETE FROM support_group_members WHERE group_id=$1 AND user_id=$2", [groupId, userId]);
    return response.json({ message: "Agent removed from support group." });
  } catch (error) {
    console.error("Remove support-group member failed:", error);
    return response.status(500).json({ error: "Failed to remove agent from support group." });
  }
});

router.get("/:id/members", async (request, response) => {
  const groupId = parseId(request.params.id);
  if (!groupId) return response.status(400).json({ error: "Invalid support-group ID." });
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.role, u.job_title, u.department
      FROM support_group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1 AND ${ELIGIBLE_AGENT_WHERE}
      ORDER BY u.name
    `, [groupId]);
    return response.json(result.rows);
  } catch (error) {
    console.error("Fetch group members failed:", error);
    return response.status(500).json({ error: "Failed to fetch group members." });
  }
});

module.exports = router;
