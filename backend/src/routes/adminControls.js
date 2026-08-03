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
  "workspace_management", // BATCH1_WORKSPACE_AVAILABLE_FEATURE
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
    workspace_management: administrator, // BATCH1_WORKSPACE_ROLE_BASELINE
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


