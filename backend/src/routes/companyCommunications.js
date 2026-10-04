const express = require("express");
const crypto = require("crypto");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { sendMailSafe } = require("../services/email");
const communicationAttachments = require("../services/companyCommunicationAttachments");
const {
  COMPANY_DOMAIN,
  PORTAL_URL,
  createIdempotencyKey,
  normalizeAudience,
  getEligibleRecipients,
  getCampaign,
  queueCampaign,
} = require("../services/companyCommunications");

const router = express.Router();

router.use(auth);

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


async function canAccessCampaign(request,campaignId){
 if (["admin","superadmin"].includes(request.user.role)) return true;
 const result=await pool.query(`SELECT 1 FROM company_communication_deliveries WHERE campaign_id=$1 AND user_id=$2 LIMIT 1`,[campaignId,request.user.id]);
 return result.rowCount>0;
}

router.get("/feed/mine",async(request,response)=>{try{const result=await pool.query(`SELECT c.id,c.name,c.subject,c.html_body,c.text_body,c.allow_comments,c.published_at,c.sent_at,c.created_at,EXISTS(SELECT 1 FROM company_communication_reads r WHERE r.campaign_id=c.id AND r.user_id=$1) AS is_read,(SELECT COUNT(*)::integer FROM company_communication_attachments a WHERE a.campaign_id=c.id) AS attachment_count FROM company_communication_campaigns c WHERE c.status IN ('sent','partially_sent') AND (EXISTS(SELECT 1 FROM company_communication_deliveries d WHERE d.campaign_id=c.id AND d.user_id=$1) OR $2=ANY(ARRAY['admin','superadmin'])) ORDER BY COALESCE(c.published_at,c.sent_at,c.created_at) DESC LIMIT 30`,[request.user.id,request.user.role]);return response.json(result.rows);}catch(error){if(error.code==="42P01"||error.code==="42703")return response.status(503).json({error:"Run the pending Company Communications migrations first."});return response.status(500).json({error:"Failed to load company announcements."});}});
router.post("/:id/read",async(request,response)=>{try{if(!(await canAccessCampaign(request,request.params.id)))return response.status(403).json({error:"You are not authorised for this announcement."});await pool.query(`INSERT INTO company_communication_reads(campaign_id,user_id) VALUES($1,$2) ON CONFLICT(campaign_id,user_id) DO UPDATE SET read_at=NOW()`,[request.params.id,request.user.id]);return response.json({read:true,readAt:new Date().toISOString()});}catch(error){return response.status(500).json({error:"Failed to record announcement read state."});}});
router.get("/:id/comments",async(request,response)=>{try{if(!(await canAccessCampaign(request,request.params.id)))return response.status(403).json({error:"You are not authorised for this announcement."});const result=await pool.query(`SELECT x.id,x.body,x.is_hidden,x.created_at,x.updated_at,u.id AS author_user_id,u.name AS author_name,u.email AS author_email,u.job_title AS author_position FROM company_communication_comments x LEFT JOIN users u ON u.id=x.author_user_id WHERE x.campaign_id=$1 AND (x.is_hidden=FALSE OR $2=ANY(ARRAY['admin','superadmin'])) ORDER BY x.created_at,x.id`,[request.params.id,request.user.role]);return response.json(result.rows);}catch(error){return response.status(500).json({error:"Failed to load announcement comments."});}});
router.post("/:id/comments",async(request,response)=>{try{if(!(await canAccessCampaign(request,request.params.id)))return response.status(403).json({error:"You are not authorised for this announcement."});const body=cleanText(request.body.body,4000);if(!body)return response.status(400).json({error:"Comment text is required."});const campaign=await getCampaign(request.params.id);if(!campaign?.allow_comments)return response.status(403).json({error:"Comments are unavailable for this announcement."});const result=await pool.query(`INSERT INTO company_communication_comments(campaign_id,author_user_id,body) VALUES($1,$2,$3) RETURNING *`,[request.params.id,request.user.id,body]);return response.status(201).json({...result.rows[0],author_name:request.user.name||request.user.email});}catch(error){return response.status(500).json({error:"Failed to add announcement comment."});}});
router.patch("/:id/comments/:commentId",async(request,response)=>{try{const body=cleanText(request.body.body,4000);if(!body)return response.status(400).json({error:"Comment text is required."});const result=await pool.query(`UPDATE company_communication_comments SET body=$1,updated_at=NOW() WHERE id=$2 AND campaign_id=$3 AND author_user_id=$4 AND is_hidden=FALSE RETURNING *`,[body,request.params.commentId,request.params.id,request.user.id]);if(!result.rows[0])return response.status(404).json({error:"Editable comment not found."});return response.json(result.rows[0]);}catch(error){return response.status(500).json({error:"Failed to edit announcement comment."});}});
router.patch("/:id/comments/:commentId/hide",allowRoles("admin","superadmin"),async(request,response)=>{try{const result=await pool.query(`UPDATE company_communication_comments SET is_hidden=TRUE,hidden_by=$1,hidden_at=NOW(),updated_at=NOW() WHERE id=$2 AND campaign_id=$3 RETURNING *`,[request.user.id,request.params.commentId,request.params.id]);if(!result.rows[0])return response.status(404).json({error:"Comment not found."});await writeAudit(request,"company_communication_comment_hidden",{campaignId:Number(request.params.id),commentId:Number(request.params.commentId)});return response.json(result.rows[0]);}catch(error){return response.status(500).json({error:"Failed to moderate announcement comment."});}});

router.use(allowRoles("admin", "superadmin"));

function serializeCampaign(row) {
  if (!row) return null;

  return {
    ...row,
    audience_values: Array.isArray(row.audience_values)
      ? row.audience_values
      : [],
    audience_definition: row.audience_definition && typeof row.audience_definition === "object"
      ? row.audience_definition
      : null,
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
          )::integer AS failed_count,
          COUNT(delivery.id) FILTER (
            WHERE delivery.status = 'processing'
          )::integer AS processing_count,
          COUNT(delivery.id) FILTER (
            WHERE delivery.status = 'pending'
          )::integer AS pending_count
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

router.get("/audience-options", async (request, response) => {
  try {
    const [usersResult, groupsResult, workspacesResult] = await Promise.all([
      pool.query(`SELECT id, name, email, department, job_title, role FROM users WHERE approved=TRUE AND status='active' AND archived_at IS NULL AND deactivated_at IS NULL AND COALESCE(account_type,'person')='person' ORDER BY department NULLS LAST, name`),
      pool.query(`SELECT id, name FROM support_groups WHERE COALESCE(is_active, TRUE)=TRUE ORDER BY name`),
      pool.query(`SELECT id, name FROM service_workspaces WHERE status='active' ORDER BY name`),
    ]);
    const departments = [...new Set(usersResult.rows.map((item) => item.department).filter(Boolean))].sort();
    const positions = [...new Set(usersResult.rows.map((item) => item.job_title).filter(Boolean))].sort();
    return response.json({ users: usersResult.rows, departments, positions, supportGroups: groupsResult.rows, workspaces: workspacesResult.rows, hodAvailable: false, canUseExternalRecipients: request.user.role === "superadmin" });
  } catch (error) {
    console.error("Load communication audience options failed:", error);
    return response.status(500).json({ error: "Failed to load communication audience options." });
  }
});

router.post("/preview", async (request, response) => {
  try {
    const selectedAudience = normalizeAudience(request.body.audience);
    if (selectedAudience.externalEmails.length && request.user.role !== "superadmin") {
      return response.status(403).json({ error: "Additional external recipients require Superadministrator permission." });
    }
    const recipients = await getEligibleRecipients(selectedAudience);
    const internal = recipients.filter((item) => !item.external);
    const external = recipients.filter((item) => item.external);
    const departments = [...new Set(internal.map((item) => item.department).filter(Boolean))].sort();
    const positions = [...new Set(internal.map((item) => item.job_title).filter(Boolean))].sort();
    const roles = [...new Set(internal.map((item) => item.role).filter(Boolean))].sort();
    const evidence = crypto.createHash("sha256").update(JSON.stringify({ audience: selectedAudience, emails: recipients.map((item) => item.email).sort() })).digest("hex");
    return response.json({ audience: selectedAudience, count: recipients.length, internalCount: internal.length, externalCount: external.length, departments, positions, roles, evidence, generatedAt: new Date().toISOString(), recipients: recipients.slice(0,100).map((recipient)=>({id:recipient.id,name:recipient.name,email:recipient.email,department:recipient.department,position:recipient.job_title,role:recipient.role,external:Boolean(recipient.external)})) });
  } catch (error) {
    console.error("Preview company recipients failed:", error);
    return response.status(error.status || 500).json({ error: error.message || "Failed to preview eligible recipients.", code: error.code || null });
  }
});

router.post("/", communicationAttachments.optionalAttachments, async (request, response) => {
  if (typeof request.body.audience === "string") request.body.audience = JSON.parse(request.body.audience);
  const name = cleanText(request.body.name, 200);
  const subject = cleanText(request.body.subject, 300);
  const htmlBody = cleanText(request.body.htmlBody);
  const textBody = cleanText(request.body.textBody);
  const selectedAudience = normalizeAudience(request.body.audience);

  if (selectedAudience.externalEmails.length && request.user.role !== "superadmin") {
    return response.status(403).json({ error: "Additional external recipients require Superadministrator permission." });
  }

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
          audience_definition,
          allow_comments,
          idempotency_key,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $10)
        RETURNING *
      `,
      [
        name,
        subject,
        htmlBody,
        textBody,
        selectedAudience.type,
        JSON.stringify(selectedAudience.values),
        JSON.stringify(selectedAudience),
        String(request.body.allowComments)==="true" || request.body.allowComments===true,
        createIdempotencyKey(request.body.idempotencyKey),
        request.user.id,
      ]
    );

    const attachments = await communicationAttachments.saveUploadedFiles(client, result.rows[0].id, request.user.id, request.files || []);

    await writeAudit(
      request,
      "company_communication_created",
      {
        campaignId: result.rows[0].id,
        name,
        audience: selectedAudience,
        attachmentCount: attachments.length,
      },
      client
    );

    await client.query("COMMIT");
    return response.status(201).json({ ...serializeCampaign(result.rows[0]), attachments });
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


router.get("/:id/attachments", async (request,response)=>{try{return response.json(await communicationAttachments.list(pool,request.params.id));}catch(error){if(error.code==="42P01")return response.status(503).json({error:"Run the communication attachment migration first."});return response.status(500).json({error:"Failed to list communication attachments."});}});
router.get("/:id/attachments/:attachmentId/download", async (request,response)=>{try{const item=await communicationAttachments.get(pool,request.params.attachmentId);if(!item||Number(item.campaign_id)!==Number(request.params.id))return response.status(404).json({error:"Attachment not found."});response.setHeader("Content-Type",item.content_type||"application/octet-stream");response.setHeader("Content-Disposition",`attachment; filename="${communicationAttachments.safeName(item.original_name)}"`);response.setHeader("X-Content-Type-Options","nosniff");return communicationAttachments.fs.createReadStream(communicationAttachments.confined(item.stored_path)).pipe(response);}catch(error){return response.status(error.status||500).json({error:error.message||"Unable to download attachment."});}});
router.delete("/:id/attachments/:attachmentId", async (request,response)=>{try{const campaign=await getCampaign(request.params.id);if(!campaign)return response.status(404).json({error:"Campaign not found."});if(!["draft","failed","skipped"].includes(campaign.status))return response.status(409).json({error:"Attachments may only be removed from an editable draft."});const item=await communicationAttachments.get(pool,request.params.attachmentId);if(!item||Number(item.campaign_id)!==Number(campaign.id))return response.status(404).json({error:"Attachment not found."});await communicationAttachments.remove(pool,item.id);await writeAudit(request,"company_communication_attachment_removed",{campaignId:Number(campaign.id),attachmentId:Number(item.id),originalName:item.original_name});return response.json({removed:true});}catch(error){return response.status(error.status||500).json({error:error.message||"Unable to remove attachment."});}});

router.get("/:id/deliveries", async (request, response) => {
  try {
    const result = await pool.query(`
      SELECT delivery.id, delivery.intended_email, delivery.effective_email,
             delivery.status, delivery.provider, delivery.attempt_count,
             delivery.governance_mode, delivery.environment_redirected,
             delivery.processing_started_at, delivery.completed_at,
             delivery.attempted_at, delivery.created_at, delivery.last_error, delivery.detail,
             user_account.name AS recipient_name, user_account.department,
             user_account.job_title AS position
      FROM company_communication_deliveries delivery
      LEFT JOIN users user_account ON user_account.id = delivery.user_id
      WHERE delivery.campaign_id = $1
      ORDER BY user_account.department NULLS LAST, user_account.name, delivery.intended_email
      LIMIT 5000
    `, [request.params.id]);
    return response.json(result.rows);
  } catch (error) {
    console.error("Load communication deliveries failed:", error);
    return response.status(500).json({ error: "Failed to load delivery details." });
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
  if (request.body.approved !== true) {
    return response.status(400).json({ error: "Approve the communication in the confirmation dialog before scheduling." });
  }

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
  if (request.body.approved !== true) {
    return response.status(400).json({ error: "Approve the communication in the confirmation dialog before sending." });
  }

try {
    const result = await queueCampaign(request.params.id, request.user.id);
    await writeAudit(request, "company_communication_delivery_accepted", result);
    return response.status(202).json(result);
  } catch (error) {
    console.error("Send company communication failed:", error);
    return response.status(error.status || 500).json({
      error: error.message || "Failed to send communication.",
    });
  }
});

module.exports = router;
