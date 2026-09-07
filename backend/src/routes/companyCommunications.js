const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { sendMailSafe } = require("../services/email");
const {
  COMPANY_DOMAIN,
  PORTAL_URL,
  createIdempotencyKey,
  normalizeAudience,
  getEligibleRecipients,
  getCampaign,
  sendCampaign,
} = require("../services/companyCommunications");

const router = express.Router();

router.use(auth, allowRoles("admin", "superadmin"));

function cleanText(value, maximumLength = 20000) {
  return String(value || "")
    .trim()
    .slice(0, maximumLength);
}

function normalizeEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAllowedTestRecipient(email, requestUser) {
  const normalizedUserEmail = normalizeEmail(requestUser?.email);
  return email === normalizedUserEmail || email.endsWith(`@${COMPANY_DOMAIN}`);
}

function serializeCampaign(row) {
  if (!row) return null;

  return {
    ...row,
    audience_values: Array.isArray(row.audience_values)
      ? row.audience_values
      : [],
  };
}

async function writeAudit(request, action, value, database = pool) {
  await database.query(
    `
      INSERT INTO administration_audit_log (
        actor_user_id,
        action,
        new_value,
        details
      )
      VALUES ($1, $2, $3::jsonb, $4::jsonb)
    `,
    [
      request.user.id,
      action,
      JSON.stringify(value || {}),
      JSON.stringify({ source: "company_communications" }),
    ]
  );
}

router.get("/", async (_request, response) => {
  try {
    const result = await pool.query(
      `
        SELECT
          campaign.*,
          COUNT(delivery.id)::integer AS delivery_count,
          COUNT(delivery.id) FILTER (
            WHERE delivery.status = 'sent'
          )::integer AS sent_count,
          COUNT(delivery.id) FILTER (
            WHERE delivery.status = 'skipped'
          )::integer AS skipped_count,
          COUNT(delivery.id) FILTER (
            WHERE delivery.status = 'failed'
          )::integer AS failed_count
        FROM company_communication_campaigns campaign
        LEFT JOIN company_communication_deliveries delivery
          ON delivery.campaign_id = campaign.id
        GROUP BY campaign.id
        ORDER BY campaign.created_at DESC
        LIMIT 100
      `
    );

    return response.json(result.rows.map(serializeCampaign));
  } catch (error) {
    if (error.code === "42P01") {
      return response.status(503).json({
        error: "Run the company communications migration first.",
      });
    }

    console.error("Load company communications failed:", error);
    return response.status(500).json({
      error: "Failed to load company communications.",
    });
  }
});

router.post("/preview", async (request, response) => {
  try {
    const selectedAudience = normalizeAudience(request.body.audience);
    const recipients = await getEligibleRecipients(selectedAudience);
    const departments = Array.from(
      new Set(recipients.map((item) => item.department).filter(Boolean))
    ).sort();

    return response.json({
      audience: selectedAudience,
      count: recipients.length,
      departments,
      recipients: recipients.slice(0, 100).map((recipient) => ({
        name: recipient.name,
        email: recipient.email,
        department: recipient.department,
      })),
    });
  } catch (error) {
    console.error("Preview company recipients failed:", error);
    return response.status(500).json({
      error: "Failed to preview eligible recipients.",
    });
  }
});

router.post("/", async (request, response) => {
  const name = cleanText(request.body.name, 200);
  const subject = cleanText(request.body.subject, 300);
  const htmlBody = cleanText(request.body.htmlBody);
  const textBody = cleanText(request.body.textBody);
  const selectedAudience = normalizeAudience(request.body.audience);

  if (!name || !subject || !htmlBody || !textBody) {
    return response.status(400).json({
      error: "Name, subject, HTML body and text body are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO company_communication_campaigns (
          name,
          subject,
          html_body,
          text_body,
          audience_type,
          audience_values,
          idempotency_key,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8)
        RETURNING *
      `,
      [
        name,
        subject,
        htmlBody,
        textBody,
        selectedAudience.type,
        JSON.stringify(selectedAudience.values),
        createIdempotencyKey(request.body.idempotencyKey),
        request.user.id,
      ]
    );

    await writeAudit(
      request,
      "company_communication_created",
      {
        campaignId: result.rows[0].id,
        name,
        audience: selectedAudience,
      },
      client
    );

    await client.query("COMMIT");
    return response.status(201).json(serializeCampaign(result.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      return response.status(409).json({
        error: "A campaign with this idempotency key already exists.",
      });
    }

    console.error("Create company communication failed:", error);
    return response.status(500).json({
      error: "Failed to create company communication.",
    });
  } finally {
    client.release();
  }
});

router.post("/:id/test", async (request, response) => {
  try {
    const campaign = await getCampaign(request.params.id);

    if (!campaign) {
      return response.status(404).json({ error: "Campaign not found." });
    }

    const recipient = normalizeEmail(request.body.to || request.user.email);

    if (!isValidEmail(recipient)) {
      return response.status(400).json({ error: "A valid test recipient is required." });
    }

    if (!isAllowedTestRecipient(recipient, request.user)) {
      return response.status(403).json({
        error: `Test messages may only be sent to your account or an @${COMPANY_DOMAIN} address.`,
      });
    }

    const signInUrl = `${PORTAL_URL}/login`;
    const result = await sendMailSafe({
      to: recipient,
      subject: `[CAMPAIGN TEST] ${campaign.subject}`,
      html: campaign.html_body
        .replaceAll("{{name}}", "Test recipient")
        .replaceAll("{{signInUrl}}", signInUrl),
      text: campaign.text_body
        .replaceAll("{{name}}", "Test recipient")
        .replaceAll("{{signInUrl}}", signInUrl),
      category: "welcome",
    });

    await writeAudit(request, "company_communication_tested", {
      campaignId: campaign.id,
      recipient,
      sent: Boolean(result.sent),
      skipped: Boolean(result.skipped),
      provider: result.provider || null,
    });

    return response.json(result);
  } catch (error) {
    console.error("Test company communication failed:", error);
    return response.status(500).json({
      error: "Failed to send the test communication.",
    });
  }
});

router.post("/:id/schedule", async (request, response) => {
  const scheduledAt = new Date(request.body.scheduledAt);

  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return response.status(400).json({
      error: "Choose a valid future schedule date.",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE company_communication_campaigns
        SET
          status = 'scheduled',
          scheduled_at = $2,
          updated_by = $3,
          updated_at = NOW(),
          last_error = NULL
        WHERE id = $1
          AND status IN ('draft', 'failed', 'skipped')
        RETURNING *
      `,
      [request.params.id, scheduledAt.toISOString(), request.user.id]
    );

    if (!result.rows[0]) {
      return response.status(409).json({
        error: "Only draft, failed or skipped campaigns can be scheduled.",
      });
    }

    await writeAudit(request, "company_communication_scheduled", {
      campaignId: Number(request.params.id),
      scheduledAt: scheduledAt.toISOString(),
    });

    return response.json(serializeCampaign(result.rows[0]));
  } catch (error) {
    console.error("Schedule company communication failed:", error);
    return response.status(500).json({
      error: "Failed to schedule communication.",
    });
  }
});

router.post("/:id/cancel", async (request, response) => {
  try {
    const result = await pool.query(
      `
        UPDATE company_communication_campaigns
        SET
          status = 'cancelled',
          cancelled_at = NOW(),
          updated_by = $2,
          updated_at = NOW()
        WHERE id = $1
          AND status IN ('draft', 'scheduled', 'failed', 'skipped')
        RETURNING *
      `,
      [request.params.id, request.user.id]
    );

    if (!result.rows[0]) {
      return response.status(409).json({
        error: "This campaign cannot be cancelled from its current status.",
      });
    }

    await writeAudit(request, "company_communication_cancelled", {
      campaignId: Number(request.params.id),
    });

    return response.json(serializeCampaign(result.rows[0]));
  } catch (error) {
    console.error("Cancel company communication failed:", error);
    return response.status(500).json({ error: "Failed to cancel communication." });
  }
});

router.post("/:id/send", async (request, response) => {
  const confirmation = cleanText(request.body.confirmation, 100);

  if (confirmation !== "SEND COMPANY COMMUNICATION") {
    return response.status(400).json({
      error: "Enter the required confirmation phrase.",
    });
  }

  try {
    const result = await sendCampaign(request.params.id, request.user.id);

    await writeAudit(request, "company_communication_sent", result);
    return response.json(result);
  } catch (error) {
    console.error("Send company communication failed:", error);
    return response.status(error.status || 500).json({
      error: error.message || "Failed to send communication.",
    });
  }
});

module.exports = router;
