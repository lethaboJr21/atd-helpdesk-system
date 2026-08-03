const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const router = express.Router();
router.use(auth, allowRoles("admin", "superadmin"));

const FEATURES = [
  "employee_dashboard",
  "my_tickets",
  "my_assets",
  "report_incident",
  "request_service",
  "request_asset",
  "request_change",
  "knowledge",
  "notifications",
  "operations_dashboard",
  "ticket_workspace",
  "asset_register",
  "production_operations",
  "user_management",
  "group_management",
  "admin_settings",
];

function getRoleBaseline(role) {
  const operational = [
    "agent",
    "operator",
    "manager",
    "admin",
    "superadmin",
  ].includes(role);

  const administrator = [
    "manager",
    "admin",
    "superadmin",
  ].includes(role);

  return {
    employee_dashboard: true,
    my_tickets: true,
    my_assets: true,
    report_incident: true,
    request_service: true,
    request_asset: true,
    request_change: true,
    knowledge: true,
    notifications: true,
    operations_dashboard: operational,
    ticket_workspace: operational,
    asset_register: operational,
    production_operations: operational,
    user_management: administrator,
    group_management: administrator,
    admin_settings: administrator,
  };
}

function getEffectiveFeatures(baseline, overrides) {
  return Object.fromEntries(
    FEATURES.map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(overrides, key)
        ? Boolean(overrides[key]) && Boolean(baseline[key])
        : Boolean(baseline[key]),
    ])
  );
}

async function loadTarget(id, database = pool) {
  const result = await database.query(
    `SELECT
       id,
       name,
       email,
       role,
       status,
       approved,
       account_type,
       archived_at,
       deactivated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] || null;
}

function canManage(request, target) {
  if (!target) {
    return { status: 404, error: "User not found." };
  }

  if (
    target.role === "superadmin" &&
    request.user.role !== "superadmin"
  ) {
    return {
      status: 403,
      error:
        "Only a superadministrator can modify a superadministrator.",
    };
  }

  return null;
}

function normalizeEmailPreferences(row) {
  return {
    enabled: row?.email_enabled !== false,
    assignment: row?.assignment_emails !== false,
    ticket_update: row?.ticket_update_emails !== false,
    reminder: row?.reminder_emails !== false,
    escalation: row?.escalation_emails !== false,
    administrative: row?.administrative_emails !== false,
  };
}

router.get("/audit", async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 500);
  try {
    const result = await pool.query(
      `SELECT
         a.id, a.action, a.old_value, a.new_value, a.details, a.created_at,
         actor.name AS actor_name, actor.email AS actor_email,
         target.name AS target_name, target.email AS target_email
       FROM administration_audit_log a
       LEFT JOIN users actor ON actor.id = a.actor_user_id
       LEFT JOIN users target ON target.id = a.target_user_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return response.json(result.rows);
  } catch (error) {
    if (error.code === "42P01") {
      return response.json([]);
    }
    console.error("Fetch admin audit failed:", error);
    return response.status(500).json({ error: "Failed to fetch audit activity" });
  }
});

router.get("/health", async (_request, response) => {
  const checks = {};
  try {
    await pool.query("SELECT 1");
    checks.database = { status: "healthy" };
  } catch (error) {
    checks.database = { status: "unhealthy", detail: error.message };
  }

  try {
    const sync = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE last_microsoft_sync_at IS NOT NULL)::integer AS synced_users,
         MAX(last_microsoft_sync_at) AS last_sync_at
       FROM users`
    );
    checks.microsoft_directory = {
      status: sync.rows[0].last_sync_at ? "healthy" : "unknown",
      syncedUsers: sync.rows[0].synced_users,
      lastSyncAt: sync.rows[0].last_sync_at,
    };
  } catch (error) {
    checks.microsoft_directory = { status: "unhealthy", detail: error.message };
  }

  try {
    const tickets = await pool.query(
      `SELECT
         COUNT(*)::integer AS total,
         COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed'))::integer AS open
       FROM tickets`
    );
    checks.tickets = {
      status: "healthy",
      total: tickets.rows[0].total,
      open: tickets.rows[0].open,
    };
  } catch (error) {
    checks.tickets = { status: "unhealthy", detail: error.message };
  }

  const unhealthy = Object.values(checks).some((item) => item.status === "unhealthy");
  return response.status(unhealthy ? 503 : 200).json({
    ok: !unhealthy,
    status: unhealthy ? "degraded" : "healthy",
    service: "ATD Helpdesk",
    emailProvider: process.env.EMAIL_PROVIDER || "graph",
    timestamp: new Date().toISOString(),
    checks,
  });
});

router.get("/:id", async (request, response) => {
  try {
    const target = await loadTarget(request.params.id);
    const denied = canManage(request, target);

    if (denied) {
      return response
        .status(denied.status)
        .json({ error: denied.error });
    }

    const [featureResult, emailResult] = await Promise.all([
      pool.query(
        `SELECT feature_key, enabled
         FROM user_feature_entitlements
         WHERE user_id = $1`,
        [target.id]
      ),
      pool.query(
        `SELECT
           email_enabled,
           assignment_emails,
           ticket_update_emails,
           reminder_emails,
           escalation_emails,
           administrative_emails
         FROM user_email_preferences
         WHERE user_id = $1
         LIMIT 1`,
        [target.id]
      ),
    ]);

    const baseline = getRoleBaseline(target.role);
    const overrides = Object.fromEntries(
      featureResult.rows.map((row) => [
        row.feature_key,
        row.enabled,
      ])
    );

    return response.json({
      user: target,
      features: {
        baseline,
        overrides,
        effective: getEffectiveFeatures(
          baseline,
          overrides
        ),
      },
      emailPreferences: normalizeEmailPreferences(
        emailResult.rows[0]
      ),
      availableFeatures: FEATURES,
    });
  } catch (error) {
    console.error("Fetch user controls failed:", error);
    return response.status(500).json({
      error: "Failed to fetch user controls.",
    });
  }
});

router.put("/:id/features", async (request, response) => {
  const supplied =
    request.body.features &&
    typeof request.body.features === "object"
      ? request.body.features
      : null;

  if (!supplied) {
    return response.status(400).json({
      error: "Feature settings are required.",
    });
  }

  const target = await loadTarget(request.params.id);
  const denied = canManage(request, target);

  if (denied) {
    return response
      .status(denied.status)
      .json({ error: denied.error });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const feature of FEATURES) {
      if (
        !Object.prototype.hasOwnProperty.call(
          supplied,
          feature
        )
      ) {
        await client.query(
          `DELETE FROM user_feature_entitlements
           WHERE user_id = $1
             AND feature_key = $2`,
          [target.id, feature]
        );
        continue;
      }

      await client.query(
        `INSERT INTO user_feature_entitlements (
           user_id,
           feature_key,
           enabled,
           updated_by,
           updated_at
         )
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, feature_key)
         DO UPDATE SET
           enabled = EXCLUDED.enabled,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [
          target.id,
          feature,
          Boolean(supplied[feature]),
          request.user.id,
        ]
      );
    }

    await client.query(
      `INSERT INTO administration_audit_log (
         actor_user_id,
         target_user_id,
         action,
         new_value
       )
       VALUES (
         $1,
         $2,
         'user_features_updated',
         $3::jsonb
       )`,
      [
        request.user.id,
        target.id,
        JSON.stringify(supplied),
      ]
    );

    await client.query("COMMIT");

    const baseline = getRoleBaseline(target.role);
    return response.json({
      message: "User feature access updated.",
      features: {
        baseline,
        overrides: supplied,
        effective: getEffectiveFeatures(baseline, supplied),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Update user features failed:", error);
    return response.status(500).json({
      error: "Failed to update user feature access.",
    });
  } finally {
    client.release();
  }
});

router.put(
  "/:id/email-preferences",
  async (request, response) => {
    const target = await loadTarget(request.params.id);
    const denied = canManage(request, target);

    if (denied) {
      return response
        .status(denied.status)
        .json({ error: denied.error });
    }

    const preferences = {
      enabled: request.body.enabled !== false,
      assignment: request.body.assignment !== false,
      ticket_update:
        request.body.ticket_update !== false,
      reminder: request.body.reminder !== false,
      escalation: request.body.escalation !== false,
      administrative:
        request.body.administrative !== false,
    };

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO user_email_preferences (
           user_id,
           email_enabled,
           assignment_emails,
           ticket_update_emails,
           reminder_emails,
           escalation_emails,
           administrative_emails,
           updated_by,
           updated_at
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,NOW()
         )
         ON CONFLICT (user_id)
         DO UPDATE SET
           email_enabled = EXCLUDED.email_enabled,
           assignment_emails = EXCLUDED.assignment_emails,
           ticket_update_emails = EXCLUDED.ticket_update_emails,
           reminder_emails = EXCLUDED.reminder_emails,
           escalation_emails = EXCLUDED.escalation_emails,
           administrative_emails = EXCLUDED.administrative_emails,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         RETURNING *`,
        [
          target.id,
          preferences.enabled,
          preferences.assignment,
          preferences.ticket_update,
          preferences.reminder,
          preferences.escalation,
          preferences.administrative,
          request.user.id,
        ]
      );

      await client.query(
        `INSERT INTO administration_audit_log (
           actor_user_id,
           target_user_id,
           action,
           new_value
         )
         VALUES (
           $1,
           $2,
           'user_email_preferences_updated',
           $3::jsonb
         )`,
        [
          request.user.id,
          target.id,
          JSON.stringify(preferences),
        ]
      );

      await client.query("COMMIT");

      return response.json(
        normalizeEmailPreferences(result.rows[0])
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(
        "Update user email preferences failed:",
        error
      );
      return response.status(500).json({
        error:
          "Failed to update user email preferences.",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
