const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const {
  clearSettingsCache,
  getEmailGovernance,
  setSetting,
} = require("../services/systemSettings");

const router = express.Router();
router.use(auth, allowRoles("admin", "superadmin"));

const EMAIL_CATEGORY_KEYS = [
  "account_request",
  "account_approval",
  "welcome",
  "ticket_assignment",
  "ticket_update",
  "reminder",
  "escalation",
  "requester_update",
];

function normalizeEmails(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) =>
          String(value || "").trim().toLowerCase()
        )
        .filter((value) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        )
    )
  );
}

function normalizeCategories(input) {
  const supplied =
    input && typeof input === "object" ? input : {};

  return Object.fromEntries(
    EMAIL_CATEGORY_KEYS.map((key) => [
      key,
      supplied[key] !== false,
    ])
  );
}

router.get("/email", async (_request, response) => {
  try {
    return response.json(await getEmailGovernance());
  } catch (error) {
    console.error("Fetch email settings failed:", error);
    return response.status(500).json({
      error: "Failed to fetch email settings.",
    });
  }
});

router.put("/email", async (request, response) => {
  const mode = String(request.body.mode || "")
    .trim()
    .toLowerCase();

  if (!["live", "testing", "disabled"].includes(mode)) {
    return response.status(400).json({
      error:
        "Email mode must be live, testing or disabled.",
    });
  }

  const testRecipients = normalizeEmails(
    request.body.testRecipients
  );

  if (mode === "testing" && testRecipients.length === 0) {
    return response.status(400).json({
      error:
        "Testing mode requires at least one valid test recipient.",
    });
  }

  const categories = normalizeCategories(
    request.body.categories
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await setSetting("email.mode", mode, {
      updatedBy: request.user.id,
      database: client,
    });

    await setSetting(
      "email.test_recipients",
      testRecipients,
      {
        updatedBy: request.user.id,
        database: client,
      }
    );

    await setSetting("email.categories", categories, {
      updatedBy: request.user.id,
      database: client,
    });

    await client.query(
      `INSERT INTO administration_audit_log (
         actor_user_id,
         action,
         new_value
       )
       VALUES (
         $1,
         'system_email_settings_updated',
         $2::jsonb
       )`,
      [
        request.user.id,
        JSON.stringify({
          mode,
          testRecipients,
          categories,
        }),
      ]
    );

    await client.query("COMMIT");
    clearSettingsCache();

    return response.json(await getEmailGovernance());
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    clearSettingsCache();

    console.error("Update email settings failed:", error);
    return response.status(500).json({
      error: "Failed to update email settings.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
