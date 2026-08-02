const pool = require("../db/pool");

const CACHE_TTL_MS = 30000;
const cache = new Map();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function getSetting(key, fallback = null, database = pool) {
  const useCache = database === pool;
  const cached = cache.get(key);

  if (useCache && cached && cached.expiresAt > Date.now()) {
    return clone(cached.value);
  }

  const result = await database.query(
    `SELECT setting_value
       FROM system_settings
      WHERE setting_key = $1
      LIMIT 1`,
    [key]
  );

  const value = result.rows[0]?.setting_value ?? fallback;

  if (useCache) {
    cache.set(key, {
      value: clone(value),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return clone(value);
}

async function setSetting(
  key,
  value,
  {
    description = null,
    updatedBy = null,
    database = pool,
  } = {}
) {
  const result = await database.query(
    `INSERT INTO system_settings (
       setting_key,
       setting_value,
       description,
       updated_by,
       updated_at
     )
     VALUES ($1, $2::jsonb, $3, $4, NOW())
     ON CONFLICT (setting_key)
     DO UPDATE SET
       setting_value = EXCLUDED.setting_value,
       description = COALESCE(
         EXCLUDED.description,
         system_settings.description
       ),
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING
       setting_key,
       setting_value,
       description,
       updated_by,
       updated_at`,
    [
      key,
      JSON.stringify(value),
      description,
      updatedBy,
    ]
  );

  cache.delete(key);
  return result.rows[0];
}

async function getEmailGovernance(database = pool) {
  const [mode, testRecipients, categories] = await Promise.all([
    getSetting("email.mode", "live", database),
    getSetting("email.test_recipients", [], database),
    getSetting("email.categories", {}, database),
  ]);

  return {
    mode: ["live", "testing", "disabled"].includes(mode)
      ? mode
      : "disabled",
    testRecipients: Array.isArray(testRecipients)
      ? testRecipients
      : [],
    categories:
      categories && typeof categories === "object"
        ? categories
        : {},
  };
}

async function getUserEmailPreferences(userId, database = pool) {
  const result = await database.query(
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
    [userId]
  );

  return result.rows[0] || {
    email_enabled: true,
    assignment_emails: true,
    ticket_update_emails: true,
    reminder_emails: true,
    escalation_emails: true,
    administrative_emails: true,
  };
}

function clearSettingsCache(key = null) {
  if (key) cache.delete(key);
  else cache.clear();
}

module.exports = {
  getSetting,
  setSetting,
  getEmailGovernance,
  getUserEmailPreferences,
  clearSettingsCache,
};
