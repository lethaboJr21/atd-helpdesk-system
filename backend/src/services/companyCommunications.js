const cron = require("node-cron");
const crypto = require("crypto");

const pool = require("../db/pool");
const { sendMailSafe } = require("./email");
const communicationAttachments = require("./companyCommunicationAttachments");

const COMPANY_DOMAIN = String(
  process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za"
)
  .trim()
  .toLowerCase();

const PORTAL_URL = String(
  process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk"
).replace(/\/$/, "");

const CAMPAIGN_TIMEZONE = "Africa/Johannesburg";
const ALLOWED_AUDIENCE_TYPES = new Set(["all", "departments", "users", "combined"]);
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

function uniqueText(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
}

function integerIds(values) {
  return uniqueText(values)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function normalizeAudience(input = {}) {
  const requestedType = String(input.type || "all").trim().toLowerCase();

  if (requestedType !== "combined") {
    const type = ALLOWED_AUDIENCE_TYPES.has(requestedType) ? requestedType : "all";
    const values = uniqueText(input.values);
    return {
      type,
      values,
      include: {
        wholeCompany: type === "all",
        departments: type === "departments" ? values : [],
        roles: [],
        positions: [],
        users: type === "users" ? values : [],
        supportGroups: [],
        workspaces: [],
        headsOfDepartment: false,
      },
      exclude: {
        roles: [],
        departments: [],
        positions: [],
        users: [],
        supportGroups: [],
        workspaces: [],
        headsOfDepartment: false,
      },
      externalEmails: [],
    };
  }

  const include = input.include && typeof input.include === "object" ? input.include : {};
  const exclude = input.exclude && typeof input.exclude === "object" ? input.exclude : {};

  return {
    type: "combined",
    values: [],
    include: {
      wholeCompany: include.wholeCompany === true,
      departments: uniqueText(include.departments),
      roles: uniqueText(include.roles).map((value) => value.toLowerCase()),
      positions: uniqueText(include.positions),
      users: uniqueText(include.users),
      supportGroups: uniqueText(include.supportGroups),
      workspaces: uniqueText(include.workspaces),
      headsOfDepartment: include.headsOfDepartment === true,
    },
    exclude: {
      roles: uniqueText(exclude.roles).map((value) => value.toLowerCase()),
      departments: uniqueText(exclude.departments),
      positions: uniqueText(exclude.positions),
      users: uniqueText(exclude.users),
      supportGroups: uniqueText(exclude.supportGroups),
      workspaces: uniqueText(exclude.workspaces),
      headsOfDepartment: exclude.headsOfDepartment === true,
    },
    externalEmails: uniqueText(input.externalEmails)
      .map((value) => value.toLowerCase())
      .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      .slice(0, 100),
  };
}

async function getEligibleRecipients(input, database = pool) {
  const audience = normalizeAudience(input);
  const values = [`%@${COMPANY_DOMAIN}`];
  const includeConditions = [];
  const excludeConditions = [];

  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  const eligibleInternalAccount = `
    u.approved = TRUE
    AND u.status = 'active'
    AND u.archived_at IS NULL
    AND u.deactivated_at IS NULL
    AND COALESCE(u.account_type, 'person') = 'person'
    AND COALESCE(u.microsoft_account_enabled, TRUE) = TRUE
    AND LOWER(u.email) LIKE $1
  `;

  if (audience.type === "all") includeConditions.push("TRUE");

  if (audience.type === "departments" && audience.values.length) {
    includeConditions.push(`u.department = ANY(${addValue(audience.values)}::text[])`);
  }

  if (audience.type === "users") {
    const ids = integerIds(audience.values);
    if (ids.length) includeConditions.push(`u.id = ANY(${addValue(ids)}::integer[])`);
  }

  if (audience.type === "combined") {
    if (audience.include.wholeCompany) includeConditions.push("TRUE");

    if (audience.include.departments.length) {
      includeConditions.push(`u.department = ANY(${addValue(audience.include.departments)}::text[])`);
    }

    if (audience.include.roles.length) {
      includeConditions.push(`LOWER(u.role) = ANY(${addValue(audience.include.roles)}::text[])`);
    }

    if (audience.include.positions.length) {
      includeConditions.push(`u.job_title = ANY(${addValue(audience.include.positions)}::text[])`);
    }

    const userIds = integerIds(audience.include.users);
    if (userIds.length) {
      includeConditions.push(`u.id = ANY(${addValue(userIds)}::integer[])`);
    }

    const groupIds = integerIds(audience.include.supportGroups);
    if (groupIds.length) {
      includeConditions.push(`EXISTS (
        SELECT 1
        FROM support_group_members included_group
        WHERE included_group.user_id = u.id
          AND included_group.group_id = ANY(${addValue(groupIds)}::integer[])
      )`);
    }

    const workspaceIds = integerIds(audience.include.workspaces);
    if (workspaceIds.length) {
      includeConditions.push(`EXISTS (
        SELECT 1
        FROM workspace_members included_workspace
        WHERE included_workspace.user_id = u.id
          AND included_workspace.is_active = TRUE
          AND included_workspace.workspace_id = ANY(${addValue(workspaceIds)}::integer[])
      )`);
    }

    if (audience.include.headsOfDepartment) {
      throw httpError(
        409,
        "HOD audience selection is unavailable until an authoritative HOD entitlement is configured.",
        "COMMUNICATION_HOD_MAPPING_REQUIRED"
      );
    }

    if (audience.exclude.roles.length) {
      excludeConditions.push(`NOT (LOWER(u.role) = ANY(${addValue(audience.exclude.roles)}::text[]))`);
    }

    if (audience.exclude.departments.length) {
      excludeConditions.push(`NOT (u.department = ANY(${addValue(audience.exclude.departments)}::text[]))`);
    }

    if (audience.exclude.positions.length) {
      excludeConditions.push(`NOT (u.job_title = ANY(${addValue(audience.exclude.positions)}::text[]))`);
    }

    const excludedUserIds = integerIds(audience.exclude.users);
    if (excludedUserIds.length) {
      excludeConditions.push(`NOT (u.id = ANY(${addValue(excludedUserIds)}::integer[]))`);
    }

    const excludedGroupIds = integerIds(audience.exclude.supportGroups);
    if (excludedGroupIds.length) {
      excludeConditions.push(`NOT EXISTS (
        SELECT 1
        FROM support_group_members excluded_group
        WHERE excluded_group.user_id = u.id
          AND excluded_group.group_id = ANY(${addValue(excludedGroupIds)}::integer[])
      )`);
    }

    const excludedWorkspaceIds = integerIds(audience.exclude.workspaces);
    if (excludedWorkspaceIds.length) {
      excludeConditions.push(`NOT EXISTS (
        SELECT 1
        FROM workspace_members excluded_workspace
        WHERE excluded_workspace.user_id = u.id
          AND excluded_workspace.is_active = TRUE
          AND excluded_workspace.workspace_id = ANY(${addValue(excludedWorkspaceIds)}::integer[])
      )`);
    }

    if (audience.exclude.headsOfDepartment) {
      throw httpError(
        409,
        "HOD exclusions are unavailable until an authoritative HOD entitlement is configured.",
        "COMMUNICATION_HOD_MAPPING_REQUIRED"
      );
    }
  }

  const internalRecipients = includeConditions.length
    ? (await database.query(
        `SELECT
           u.id,
           u.name,
           LOWER(u.email) AS email,
           u.department,
           u.job_title,
           u.role
         FROM users u
         WHERE ${eligibleInternalAccount}
           AND (${includeConditions.join(" OR ")})
           ${excludeConditions.length ? `AND ${excludeConditions.join(" AND ")}` : ""}
         ORDER BY u.department NULLS LAST, u.name, u.email`,
        values
      )).rows.map((recipient) => ({ ...recipient, external: false }))
    : [];

  const recipientsByEmail = new Map(
    internalRecipients.map((recipient) => [recipient.email, recipient])
  );

  for (const email of audience.externalEmails) {
    if (!recipientsByEmail.has(email)) {
      recipientsByEmail.set(email, {
        id: null,
        name: "External recipient",
        email,
        department: null,
        job_title: null,
        role: null,
        external: true,
      });
    }
  }

  return Array.from(recipientsByEmail.values());
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

async function claimDelivery(campaignId) {
  const result = await pool.query(
    `
      WITH candidate AS (
        SELECT id
        FROM company_communication_deliveries
        WHERE campaign_id = $1
          AND (
            status IN ('pending','failed','skipped')
            OR (status = 'processing' AND processing_started_at < NOW() - INTERVAL '10 minutes')
          )
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE company_communication_deliveries delivery
      SET status = 'processing', processing_started_at = NOW(),
          attempt_count = attempt_count + 1, last_error = NULL
      FROM candidate
      WHERE delivery.id = candidate.id
      RETURNING delivery.*
    `,
    [campaignId]
  );
  return result.rows[0] || null;
}
function deliveryEvidence(result, intendedEmail) {
  const environmentRedirected = Boolean(process.env.EMAIL_REDIRECT_ALL);
  const governanceMode = environmentRedirected
    ? "testing"
    : result.governanceMode || result.governance_mode || "configured";
  return {
    ...result,
    intendedEmail,
    effectiveRecipients: result.effectiveRecipients || result.effective_recipients || null,
    governanceMode,
    environmentRedirected,
  };
}
async function sendCampaign(campaignId, actorId = null, options = {}) {
  const client = await pool.connect();
  let campaign;
  let recipients;
  let attachments = [];
  try {
    await client.query("BEGIN");
    campaign = options.preclaimed
      ? await getCampaign(campaignId, client)
      : await claimCampaign(campaignId, actorId, client);
    if (!campaign || (options.preclaimed && campaign.status !== "sending")) {
      const existingCampaign = campaign || await getCampaign(campaignId, client);
      if (!existingCampaign) {
        const error = new Error("Campaign not found.");
        error.status = 404;
        throw error;
      }
      const error = new Error(`Campaign cannot be sent from status '${existingCampaign.status}'.`);
      error.status = 409;
      throw error;
    }
    attachments = await communicationAttachments.emailAttachments(client, campaign.id);
    recipients = await getEligibleRecipients(
      campaign.audience_definition && typeof campaign.audience_definition === "object"
        ? campaign.audience_definition
        : { type: campaign.audience_type, values: campaign.audience_values },
      client
    );
    if (recipients.length === 0) {
      await client.query(
        `UPDATE company_communication_campaigns
         SET status='failed',last_error='No eligible recipients were found.',updated_at=NOW()
         WHERE id=$1`,
        [campaign.id]
      );
      await client.query("COMMIT");
      return { campaignId:Number(campaign.id),recipients:0,sent:0,skipped:0,failed:0,status:"failed",reason:"No eligible recipients were found." };
    }
    for (const recipient of recipients) {
      await client.query(
        `INSERT INTO company_communication_deliveries(campaign_id,user_id,intended_email)
         VALUES($1,$2,LOWER($3))
         ON CONFLICT(campaign_id,intended_email) DO NOTHING`,
        [campaign.id,recipient.id,recipient.email]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const recipientByEmail = new Map(recipients.map((recipient) => [recipient.email.toLowerCase(),recipient]));
  while (true) {
    const delivery = await claimDelivery(campaign.id);
    if (!delivery) break;
    const recipient = recipientByEmail.get(String(delivery.intended_email).toLowerCase()) || {
      id: delivery.user_id,
      email: delivery.intended_email,
      name: "ATD colleague",
    };
    try {
      const body = renderCampaign(campaign, recipient);
      const rawResult = await sendMailSafe({
        to: recipient.email,
        subject: campaign.subject,
        html: body.html,
        text: body.text,
        category: "welcome",
        attachments,
      });
      const result = deliveryEvidence(rawResult,recipient.email);
      const deliveryStatus = result.sent ? "sent" : result.skipped ? "skipped" : "failed";
      await pool.query(
        `UPDATE company_communication_deliveries
         SET status=$2,provider=$3,detail=$4::jsonb,attempted_at=NOW(),completed_at=NOW(),
             effective_email=$5,governance_mode=$6,environment_redirected=$7,last_error=$8
         WHERE id=$1 AND status='processing'`,
        [delivery.id,deliveryStatus,result.provider || null,JSON.stringify(result),
         Array.isArray(result.effectiveRecipients) ? result.effectiveRecipients.join(",") : null,
         result.governanceMode,result.environmentRedirected,
         result.error?.message || (deliveryStatus === "failed" ? result.reason || "Delivery failed." : null)]
      );
    } catch (error) {
      await pool.query(
        `UPDATE company_communication_deliveries
         SET status='failed',completed_at=NOW(),last_error=$2,
             detail=jsonb_build_object('error',$2,'retryable',true)
         WHERE id=$1 AND status='processing'`,
        [delivery.id,error.message]
      );
    }
  }

  const totals = (await pool.query(
    `SELECT COUNT(*)::integer AS recipients,
            COUNT(*) FILTER(WHERE status='sent')::integer AS sent,
            COUNT(*) FILTER(WHERE status='skipped')::integer AS skipped,
            COUNT(*) FILTER(WHERE status='failed')::integer AS failed,
            COUNT(*) FILTER(WHERE status='processing')::integer AS processing,
            COUNT(*) FILTER(WHERE status='pending')::integer AS pending
     FROM company_communication_deliveries WHERE campaign_id=$1`,
    [campaign.id]
  )).rows[0];
  const finalStatus = determineFinalStatus(totals);
  const lastError = totals.failed > 0 ? `${totals.failed} delivery attempt(s) failed.` : null;
  await pool.query(
    `UPDATE company_communication_campaigns
     SET status=$2,
         sent_at=CASE WHEN $2 IN('sent','partially_sent') THEN NOW() ELSE sent_at END,
         published_at=CASE WHEN $2 IN('sent','partially_sent') THEN COALESCE(published_at,NOW()) ELSE published_at END,
         last_error=$3,updated_at=NOW()
     WHERE id=$1 AND status='sending'`,
    [campaign.id,finalStatus,lastError]
  );
  return { campaignId:Number(campaign.id),...totals,status:finalStatus,attachmentCount:attachments.length };
}
async function queueCampaign(campaignId,actorId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const campaign = await claimCampaign(campaignId,actorId,client);
    if (!campaign) {
      const existing = await getCampaign(campaignId,client);
      const error = new Error(existing ? `Campaign cannot be sent from status '${existing.status}'.` : "Campaign not found.");
      error.status = existing ? 409 : 404;
      throw error;
    }
    await client.query("COMMIT");
    setImmediate(() => sendCampaign(campaign.id,actorId,{preclaimed:true}).catch((error) => {
      console.error("Queued company communication failed:",error.message);
    }));
    return { accepted:true,campaignId:Number(campaign.id),status:"sending",message:"Campaign delivery accepted and is processing in the background." };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
  claimCampaign,
  sendCampaign,
  queueCampaign,
  processDueCampaigns,
  startCompanyCommunicationsScheduler,
};
