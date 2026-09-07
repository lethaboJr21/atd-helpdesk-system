const cron = require("node-cron");
const crypto = require("crypto");

const pool = require("../db/pool");
const { sendMailSafe } = require("./email");

const COMPANY_DOMAIN = String(
  process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za"
)
  .trim()
  .toLowerCase();

const PORTAL_URL = String(
  process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk"
).replace(/\/$/, "");

const CAMPAIGN_TIMEZONE = "Africa/Johannesburg";
const ALLOWED_AUDIENCE_TYPES = new Set(["all", "departments", "users"]);
const SENDABLE_STATUSES = ["draft", "scheduled", "failed", "skipped"];

let schedulerProcessing = false;

function cleanText(value, maximumLength = 20000) {
  return String(value || "")
    .trim()
    .slice(0, maximumLength);
}

function createIdempotencyKey(value) {
  return cleanText(value, 200) || crypto.randomUUID();
}

function normalizeAudience(input = {}) {
  const requestedType = cleanText(input.type, 40).toLowerCase();
  const type = ALLOWED_AUDIENCE_TYPES.has(requestedType)
    ? requestedType
    : "all";

  const values = Array.from(
    new Set(
      (Array.isArray(input.values) ? input.values : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  return { type, values };
}

async function getEligibleRecipients(audienceInput, database = pool) {
  const selectedAudience = normalizeAudience(audienceInput);
  const queryValues = [`%@${COMPANY_DOMAIN}`];
  const conditions = [
    "u.approved = TRUE",
    "u.status = 'active'",
    "u.archived_at IS NULL",
    "u.deactivated_at IS NULL",
    "COALESCE(u.account_type, 'person') = 'person'",
    "COALESCE(u.microsoft_account_enabled, TRUE) = TRUE",
    "LOWER(u.email) LIKE $1",
  ];

  if (selectedAudience.type === "departments") {
    queryValues.push(selectedAudience.values);
    conditions.push(`u.department = ANY($${queryValues.length}::text[])`);
  }

  if (selectedAudience.type === "users") {
    const userIds = selectedAudience.values
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0);

    if (userIds.length === 0) {
      return [];
    }

    queryValues.push(userIds);
    conditions.push(`u.id = ANY($${queryValues.length}::integer[])`);
  }

  const result = await database.query(
    `
      SELECT
        u.id,
        u.name,
        LOWER(u.email) AS email,
        u.department
      FROM users u
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        u.department NULLS LAST,
        u.name,
        u.email
    `,
    queryValues
  );

  return result.rows;
}

function renderCampaign(campaign, recipient) {
  const signInUrl = `${PORTAL_URL}/login`;
  const recipientName = cleanText(recipient.name, 200) || "ATD colleague";

  return {
    html: campaign.html_body
      .replaceAll("{{name}}", recipientName)
      .replaceAll("{{signInUrl}}", signInUrl),
    text: campaign.text_body
      .replaceAll("{{name}}", recipientName)
      .replaceAll("{{signInUrl}}", signInUrl),
    signInUrl,
  };
}

async function getCampaign(campaignId, database = pool) {
  const result = await database.query(
    `
      SELECT *
      FROM company_communication_campaigns
      WHERE id = $1
      LIMIT 1
    `,
    [campaignId]
  );

  return result.rows[0] || null;
}

function determineFinalStatus({ sent, skipped, failed }) {
  if (sent > 0 && (skipped > 0 || failed > 0)) return "partially_sent";
  if (sent > 0) return "sent";
  if (skipped > 0 && failed === 0) return "skipped";
  return "failed";
}

async function claimCampaign(campaignId, actorId, database) {
  const result = await database.query(
    `
      UPDATE company_communication_campaigns
      SET
        status = 'sending',
        updated_by = COALESCE($2, updated_by),
        updated_at = NOW(),
        last_error = NULL
      WHERE id = $1
        AND status = ANY($3::text[])
      RETURNING *
    `,
    [campaignId, actorId, SENDABLE_STATUSES]
  );

  return result.rows[0] || null;
}

async function sendCampaign(campaignId, actorId = null) {
  const client = await pool.connect();
  let campaign;
  let recipients;

  try {
    await client.query("BEGIN");

    campaign = await claimCampaign(campaignId, actorId, client);

    if (!campaign) {
      const existingCampaign = await getCampaign(campaignId, client);

      if (!existingCampaign) {
        const error = new Error("Campaign not found.");
        error.status = 404;
        throw error;
      }

      const error = new Error(
        `Campaign cannot be sent from status '${existingCampaign.status}'.`
      );
      error.status = 409;
      throw error;
    }

    recipients = await getEligibleRecipients(
      {
        type: campaign.audience_type,
        values: campaign.audience_values,
      },
      client
    );

    if (recipients.length === 0) {
      await client.query(
        `
          UPDATE company_communication_campaigns
          SET
            status = 'failed',
            last_error = 'No eligible recipients were found.',
            updated_at = NOW()
          WHERE id = $1
        `,
        [campaign.id]
      );

      await client.query("COMMIT");

      return {
        campaignId: Number(campaign.id),
        recipients: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        status: "failed",
        reason: "No eligible recipients were found.",
      };
    }

    for (const recipient of recipients) {
      await client.query(
        `
          INSERT INTO company_communication_deliveries (
            campaign_id,
            user_id,
            intended_email
          )
          VALUES ($1, $2, LOWER($3))
          ON CONFLICT (campaign_id, intended_email)
          DO NOTHING
        `,
        [campaign.id, recipient.id, recipient.email]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const body = renderCampaign(campaign, recipient);
    const result = await sendMailSafe({
      to: recipient.email,
      subject: campaign.subject,
      html: body.html,
      text: body.text,
      category: "welcome",
    });

    const deliveryStatus = result.sent
      ? "sent"
      : result.skipped
        ? "skipped"
        : "failed";

    if (deliveryStatus === "sent") sent += 1;
    if (deliveryStatus === "skipped") skipped += 1;
    if (deliveryStatus === "failed") failed += 1;

    await pool.query(
      `
        UPDATE company_communication_deliveries
        SET
          status = $3,
          provider = $4,
          detail = $5::jsonb,
          attempted_at = NOW()
        WHERE campaign_id = $1
          AND LOWER(intended_email) = LOWER($2)
      `,
      [
        campaign.id,
        recipient.email,
        deliveryStatus,
        result.provider || null,
        JSON.stringify(result),
      ]
    );
  }

  const finalStatus = determineFinalStatus({ sent, skipped, failed });
  const lastError = failed > 0
    ? `${failed} delivery attempt(s) failed.`
    : null;

  await pool.query(
    `
      UPDATE company_communication_campaigns
      SET
        status = $2,
        sent_at = CASE
          WHEN $2 IN ('sent', 'partially_sent') THEN NOW()
          ELSE sent_at
        END,
        last_error = $3,
        updated_at = NOW()
      WHERE id = $1
    `,
    [campaign.id, finalStatus, lastError]
  );

  return {
    campaignId: Number(campaign.id),
    recipients: recipients.length,
    sent,
    skipped,
    failed,
    status: finalStatus,
  };
}

async function processDueCampaigns() {
  if (schedulerProcessing) return;

  schedulerProcessing = true;

  try {
    const result = await pool.query(
      `
        SELECT id
        FROM company_communication_campaigns
        WHERE status = 'scheduled'
          AND scheduled_at <= NOW()
        ORDER BY scheduled_at, id
        LIMIT 5
      `
    );

    for (const row of result.rows) {
      await sendCampaign(row.id).catch((error) => {
        console.error("Scheduled company communication failed:", error.message);
      });
    }
  } finally {
    schedulerProcessing = false;
  }
}

function startCompanyCommunicationsScheduler() {
  return cron.schedule("* * * * *", processDueCampaigns, {
    timezone: CAMPAIGN_TIMEZONE,
  });
}

module.exports = {
  COMPANY_DOMAIN,
  PORTAL_URL,
  createIdempotencyKey,
  normalizeAudience,
  getEligibleRecipients,
  getCampaign,
  sendCampaign,
  processDueCampaigns,
  startCompanyCommunicationsScheduler,
};
