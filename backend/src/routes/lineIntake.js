const crypto = require("crypto");
const express = require("express");

const pool = require("../db/pool");
const { sendMailSafe } = require("../services/email");
const { getSlaPolicy, calculateSla } = require("../services/slaPolicy");
const ticketGovernance = require("../services/ticketGovernance");
const pdmTicketIntake = require("../services/pdmTicketIntake");
const lineTicketIntake = require("../services/lineTicketIntake");
const catalogueLinkService = require("../services/catalogueLinkService");
const {
  createTicketAssignmentNotifications,
  createTicketCreatedNotification,
} = require("../services/notificationService");
const { sendTicketCreatedLifecycle } = require("../services/ticketLifecycleEmail");

const router = express.Router();
const STATIONS = new Set([
  "MES",
  "PLC-RSB assembly",
  "PLC-SRS - Finished RSB Electronic Storage with Robot lift",
  "Qmuzik App on the line",
  "Blowmoulding station",
  "RSB",
  "Thermoforming",
  "Checking Fixtures",
  "Jigs tools",
  "Other",
]);
const PORTAL_BASE = String(
  process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk"
).replace(/\/$/, "");

const clean = (value, limit = 500) => String(value ?? "").trim().slice(0, limit);
const positiveId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function personNameMatches(personName, firstName, lastName) {
  const nameParts = clean(personName).toLowerCase().split(/\s+/).filter(Boolean);
  return nameParts.includes(clean(firstName).toLowerCase()) &&
    nameParts.includes(clean(lastName).toLowerCase());
}

async function findOperator(database, { firstName, lastName, employeeNumber }) {
  const result = await database.query(
    `SELECT id,name,employee_number,department,job_title,email
     FROM users
     WHERE LOWER(BTRIM(employee_number))=LOWER(BTRIM($1))
       AND approved=TRUE
       AND status='active'
       AND archived_at IS NULL
       AND deactivated_at IS NULL
       AND COALESCE(account_type,'person')='person'
     LIMIT 1`,
    [clean(employeeNumber, 80)]
  );
  const person = result.rows[0];
  if (!person ||
      clean(person.department).toLowerCase() !== "production" ||
      !clean(person.job_title).toLowerCase().includes("operator") ||
      clean(person.job_title).toLowerCase().includes("supervisor") ||
      !personNameMatches(person.name, firstName, lastName)) {
    return null;
  }
  return person;
}

async function findSupervisor(database, supervisorId) {
  const result = await database.query(
    `SELECT id,name,email,employee_number
     FROM users
     WHERE id=$1
       AND approved=TRUE
       AND status='active'
       AND archived_at IS NULL
       AND deactivated_at IS NULL
       AND COALESCE(account_type,'person')='person'
       AND LOWER(BTRIM(department))='production'
       AND LOWER(COALESCE(job_title,'')) LIKE '%supervisor%'
     LIMIT 1`,
    [supervisorId]
  );
  return result.rows[0] || null;
}

async function findCatalogueItem(database, workspace, itemId) {
  const result = await database.query(
    `SELECT item.id,item.catalogue_type,item.category,item.sub_category,
            item.item_name,item.default_priority,item.priority_locked,
            item.default_group_id
     FROM workspace_catalogue_items item
     JOIN service_workspaces service ON service.id=item.workspace_id
     WHERE item.id=$1
       AND UPPER(service.code)=$2
       AND item.is_active=TRUE
       AND item.archived_at IS NULL
       AND (
         ($2='PDM' AND item.catalogue_type='incident')
         OR
         ($2='IT' AND item.catalogue_type IN ('incident','service_request')
          AND item.category ILIKE 'Network%'
          AND item.default_priority IN ('Low','Medium'))
       )
     LIMIT 1`,
    [itemId, workspace]
  );
  return result.rows[0] || null;
}

router.get("/team-leaders", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT id,name,email,employee_number,job_title,plant_code,station_code,shift_code
      FROM users WHERE approved=TRUE AND status='active' AND archived_at IS NULL AND deactivated_at IS NULL
      AND COALESCE(account_type,'person')='person' AND LOWER(BTRIM(department))='production' ORDER BY name`);
    return res.json(result.rows);
  } catch (error) {
    console.error("Line intake team-leader list failed:", error);
    return res.status(500).json({code:"LINE_TEAM_LEADERS_UNAVAILABLE",error:"Production employees could not be loaded for Team Leader selection."});
  }
});
router.post("/team-leader-assignment", async (req,res) => {
  const operatorId=positiveId(req.body?.operatorId), teamLeaderId=positiveId(req.body?.teamLeaderId);
  if(!operatorId||!teamLeaderId||operatorId===teamLeaderId)return res.status(400).json({code:"LINE_TEAM_ASSIGNMENT_INVALID",error:"Choose a different active Production employee as Team Leader."});
  const client=await pool.connect();try{await client.query("BEGIN");
    const people=await client.query(`SELECT id,name,email,employee_number,job_title,department FROM users WHERE id=ANY($1::int[]) AND approved=TRUE AND status='active' AND archived_at IS NULL AND deactivated_at IS NULL AND COALESCE(account_type,'person')='person' AND LOWER(BTRIM(department))='production'`,[[operatorId,teamLeaderId]]);
    if(people.rowCount!==2)throw failure(400,"LINE_TEAM_ASSIGNMENT_INELIGIBLE","Both operator and Team Leader must be active Production employees.");
    await client.query("UPDATE production_operator_team_assignments SET is_active=FALSE,effective_to=NOW(),updated_at=NOW() WHERE operator_user_id=$1 AND is_active=TRUE",[operatorId]);
    const r=await client.query(`INSERT INTO production_operator_team_assignments(operator_user_id,team_leader_user_id,plant_code,line_code,station_code,shift_code,assigned_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$1) RETURNING *`,[operatorId,teamLeaderId,clean(req.body?.plantCode,80)||null,clean(req.body?.lineCode,120)||null,clean(req.body?.stationCode,160)||null,clean(req.body?.shiftCode,80)||null]);
    await client.query("COMMIT");return res.status(201).json(r.rows[0]);
  }catch(error){await client.query("ROLLBACK").catch(()=>{});return res.status(error.status||500).json({code:error.code||"LINE_TEAM_ASSIGNMENT_FAILED",error:error.status?error.message:"Team Leader assignment could not be saved."});}finally{client.release();}
});
router.get("/supervisors", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,name
       FROM users
       WHERE approved=TRUE
         AND status='active'
         AND archived_at IS NULL
         AND deactivated_at IS NULL
         AND COALESCE(account_type,'person')='person'
         AND LOWER(BTRIM(department))='production'
         AND LOWER(COALESCE(job_title,'')) LIKE '%supervisor%'
       ORDER BY name`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Line intake supervisor list failed:", error);
    return res.status(500).json({ code: "LINE_SUPERVISORS_UNAVAILABLE", error: "Production supervisors could not be loaded." });
  }
});

router.post("/register", async (req, res) => {
  const firstName = clean(req.body?.firstName, 80);
  const lastName = clean(req.body?.lastName, 80);
  const employeeNumber = clean(req.body?.employeeNumber, 80);
  if (!firstName || !lastName || !employeeNumber) {
    return res.status(400).json({ code: "GUEST_IDENTITY_REQUIRED", error: "Enter your first name, surname, and work ID." });
  }
  try {
    const operator = await findOperator(pool, { firstName, lastName, employeeNumber });
    if (!operator) {
      return res.status(403).json({ code: "GUEST_ROSTER_MATCH_FAILED", error: "We could not verify an active Production operator with those details. Ask your supervisor for help." });
    }
    const assignment = await pool.query(`SELECT a.team_leader_user_id,l.name team_leader_name,a.plant_code,a.line_code,a.station_code,a.shift_code FROM production_operator_team_assignments a JOIN users l ON l.id=a.team_leader_user_id WHERE a.operator_user_id=$1 AND a.is_active=TRUE AND a.effective_to IS NULL LIMIT 1`,[operator.id]);
    return res.json({ verified:true, id:operator.id, name:operator.name, employeeNumber:operator.employee_number, currentTeamLeader:assignment.rows[0]||null });
  } catch (error) {
    console.error("Line guest registration failed:", error);
    return res.status(500).json({ code: "GUEST_REGISTRATION_FAILED", error: "Guest registration could not be completed." });
  }
});

router.get("/catalogue", async (req, res) => {
  const workspace = clean(req.query.workspace, 20).toUpperCase();
  if (!["IT", "PDM"].includes(workspace)) {
    return res.status(400).json({ code: "LINE_WORKSPACE_INVALID", error: "Choose IT or PDM." });
  }
  try {
    const result = await pool.query(
      `SELECT item.id,item.catalogue_type,item.category,item.sub_category,
              item.item_name,item.default_priority
       FROM workspace_catalogue_items item
       JOIN service_workspaces service ON service.id=item.workspace_id
       WHERE UPPER(service.code)=$1
         AND item.is_active=TRUE
         AND item.archived_at IS NULL
         AND (
           ($1='PDM' AND item.catalogue_type='incident')
           OR
           ($1='IT' AND item.catalogue_type IN ('incident','service_request')
            AND item.category ILIKE 'Network%'
            AND item.default_priority IN ('Low','Medium'))
         )
       ORDER BY item.display_order,item.category,item.sub_category,item.item_name`,
      [workspace]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Line intake catalogue failed:", error);
    return res.status(500).json({ code: "LINE_CATALOGUE_UNAVAILABLE", error: "The station issue catalogue could not be loaded." });
  }
});

router.post("/staged-tickets", async (req, res) => {
  const firstName = clean(req.body?.firstName, 80);
  const lastName = clean(req.body?.lastName, 80);
  const employeeNumber = clean(req.body?.employeeNumber, 80);
  const supervisorId = positiveId(req.body?.supervisorId);
  const teamLeaderId = positiveId(req.body?.teamLeaderId);
  const station = clean(req.body?.station, 160);
  const workspace = clean(req.body?.workspace, 20).toUpperCase();
  const catalogueItemId = positiveId(req.body?.catalogueItemId);
  if (!firstName || !lastName || !employeeNumber || !teamLeaderId || !supervisorId ||
      !STATIONS.has(station) || !["IT", "PDM"].includes(workspace) || !catalogueItemId) {
    return res.status(400).json({ code: "LINE_STAGE_FIELDS_INVALID", error: "Complete the operator, Team Leader, supervisor, station, workspace, and issue selections." });
  }

  try {
    const operator = await findOperator(pool, { firstName, lastName, employeeNumber });
    if (!operator) {
      return res.status(403).json({ code: "GUEST_ROSTER_MATCH_FAILED", error: "We could not verify an active Production operator with those details. Register again or ask your supervisor for help." });
    }
    const teamLeaderResult = await pool.query(`SELECT id,name,email,employee_number,job_title,plant_code,station_code,shift_code FROM users WHERE id=$1 AND approved=TRUE AND status='active' AND archived_at IS NULL AND deactivated_at IS NULL AND COALESCE(account_type,'person')='person' AND LOWER(BTRIM(department))='production' LIMIT 1`,[teamLeaderId]);
    const teamLeader=teamLeaderResult.rows[0];
    if(!teamLeader)return res.status(400).json({code:"LINE_TEAM_LEADER_INELIGIBLE",error:"Choose an active Production employee as Team Leader."});
    await pool.query("UPDATE production_operator_team_assignments SET is_active=FALSE,effective_to=NOW(),updated_at=NOW() WHERE operator_user_id=$1 AND is_active=TRUE AND team_leader_user_id<>$2",[operator.id,teamLeader.id]);
    await pool.query(`INSERT INTO production_operator_team_assignments(operator_user_id,team_leader_user_id,station_code,assigned_by_user_id) VALUES($1,$2,$3,$1) ON CONFLICT DO NOTHING`,[operator.id,teamLeader.id,station]);
    const supervisor = await findSupervisor(pool, supervisorId);
    if (!supervisor?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supervisor.email)) {
      return res.status(400).json({ code: "LINE_SUPERVISOR_EMAIL_UNAVAILABLE", error: "The selected supervisor does not have an active email address. Choose another supervisor or ask IT for help." });
    }
    const item = await findCatalogueItem(pool, workspace, catalogueItemId);
    if (!item) {
      return res.status(400).json({ code: "LINE_CATALOGUE_ITEM_INVALID", error: "Choose an active issue from the selected workspace catalogue." });
    }
    await pool.query(
      `UPDATE line_ticket_staging
       SET status='expired',approval_token_hash=NULL,updated_at=NOW()
       WHERE requester_user_id=$1
         AND status='pending_approval'
         AND expires_at<=NOW()`,
      [operator.id]
    );
    const pending = await pool.query(
      `SELECT id FROM line_ticket_staging
       WHERE requester_user_id=$1
         AND status='pending_approval'
         AND expires_at>NOW()
       LIMIT 1`,
      [operator.id]
    );
    if (pending.rowCount) {
      return res.status(409).json({ code: "LINE_APPROVAL_ALREADY_PENDING", error: "A ticket for this operator is already waiting for supervisor approval." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const title = `${item.category} / ${item.sub_category} / ${item.item_name}`.slice(0, 180);
    const description = `Station: ${station}\nReported by: ${operator.name} (${operator.employee_number})\nIssue: ${title}\n\nSupervisor approval is required before this ticket is opened.`;
    const staged = await pool.query(
      `INSERT INTO line_ticket_staging(
         requester_user_id,supervisor_user_id,team_leader_user_id,team_leader_snapshot,station,workspace,
         catalogue_item_id,ticket_type,title,description,priority,
         category,sub_category,item_category,approval_token_hash,expires_at
       )
       VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW()+INTERVAL '30 minutes')
       RETURNING id`,
      [
        operator.id,supervisor.id,teamLeader.id,JSON.stringify({id:teamLeader.id,name:teamLeader.name,email:teamLeader.email,employeeNumber:teamLeader.employee_number}),station,workspace,item.id,item.catalogue_type,
        title,description,item.default_priority,item.category,item.sub_category,
        item.item_name,tokenHash,
      ]
    );

    const approvalUrl = `${PORTAL_BASE}/guest-line-assistance/approve#${rawToken}`;
    let email;
    try {
      email = await sendMailSafe({
        to: supervisor.email,
        category: "ticket_update",
        bypassUserPreferences: true,
        subject: `Supervisor approval needed: ${station} line issue`,
        text: `${operator.name} (${operator.employee_number}) needs approval for a ${workspace} ticket at ${station}.\n\nIssue: ${title}\n\nOpen this one-time link within 30 minutes, then enter your work ID to confirm:\n${approvalUrl}`,
        html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>Line issue approval required</h2><p>${escapeHtml(operator.name)} needs approval for a <strong>${escapeHtml(workspace)}</strong> ticket at <strong>${escapeHtml(station)}</strong>.</p><p>${escapeHtml(title)}</p><p>Open the one-time link within 30 minutes, then enter your work ID to confirm.</p><p><a href="${approvalUrl}" style="background:#172b57;color:white;padding:10px 16px;text-decoration:none;border-radius:8px">Review staged ticket</a></p></div>`,
      });
    } catch (emailError) {
      await pool.query(
        `UPDATE line_ticket_staging
         SET status='delivery_failed',approval_token_hash=NULL,updated_at=NOW()
         WHERE id=$1`,
        [staged.rows[0].id]
      );
      console.error("Line ticket approval email failed:", emailError);
      return res.status(503).json({ code: "LINE_APPROVAL_EMAIL_FAILED", error: "The supervisor approval email could not be sent. No ticket was opened; please contact your supervisor." });
    }
    if (!email?.sent) {
      await pool.query(
        `UPDATE line_ticket_staging
         SET status='delivery_failed',approval_token_hash=NULL,updated_at=NOW()
         WHERE id=$1`,
        [staged.rows[0].id]
      );
      console.error("Line ticket approval email was not sent:", email?.reason || "Email service reported no delivery.");
      return res.status(503).json({ code: "LINE_APPROVAL_EMAIL_FAILED", error: "The supervisor approval email could not be sent. No ticket was opened; please contact your supervisor." });
    }
    return res.status(202).json({
      status: "pending_approval",
      message: `A confirmation link was sent to ${supervisor.name}. The ticket will open only after supervisor verification.`,
    });
  } catch (error) {
    console.error("Line ticket staging failed:", error);
    if (error.code === "23505") {
      return res.status(409).json({ code: "LINE_APPROVAL_ALREADY_PENDING", error: "A ticket for this operator is already waiting for supervisor approval." });
    }
    return res.status(error.status || 500).json({
      code: error.code || "LINE_TICKET_STAGING_FAILED",
      error: error.status ? error.message : "The line ticket could not be staged.",
    });
  }
});

router.post("/approve", async (req, res) => {
  const token = clean(req.body?.token, 64).toLowerCase();
  const supervisorEmployeeNumber = clean(req.body?.supervisorEmployeeNumber, 80);
  if (!/^[a-f0-9]{64}$/.test(token) || !supervisorEmployeeNumber) {
    return res.status(400).json({ code: "LINE_APPROVAL_INPUT_INVALID", error: "Open the approval link and enter your work ID." });
  }

  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const stagedResult = await client.query(
      `SELECT stage.*
       FROM line_ticket_staging stage
       WHERE stage.approval_token_hash=$1
         AND stage.status='pending_approval'
         AND stage.expires_at>NOW()
       FOR UPDATE OF stage`,
      [tokenHash]
    );
    const staged = stagedResult.rows[0];
    if (!staged) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(410).json({ code: "LINE_APPROVAL_LINK_INVALID", error: "This approval link is invalid, expired, or has already been used." });
    }

    await client.query("SELECT set_config('app.workspace',$1,true)", [staged.workspace]);
    const requesterResult = await client.query(
      `SELECT id,name,employee_number,email
       FROM users
       WHERE id=$1
         AND approved=TRUE
         AND status='active'
         AND archived_at IS NULL
         AND deactivated_at IS NULL
         AND COALESCE(account_type,'person')='person'
       LIMIT 1`,
      [staged.requester_user_id]
    );
    const requester = requesterResult.rows[0];
    if (!requester) {
      throw failure(409, "LINE_OPERATOR_INACTIVE", "The operator account is no longer active. Ask the operator to register again.");
    }

    const supervisor = await findSupervisor(client, staged.supervisor_user_id);
    if (!supervisor ||
        clean(supervisor.employee_number).toLowerCase() !== supervisorEmployeeNumber.toLowerCase()) {
      const attempts = Number(staged.approval_attempts || 0) + 1;
      if (attempts >= 5) {
        await client.query(
          `UPDATE line_ticket_staging
           SET approval_attempts=$2,status='expired',approval_token_hash=NULL,updated_at=NOW()
           WHERE id=$1`,
          [staged.id, attempts]
        );
      } else {
        await client.query(
          `UPDATE line_ticket_staging
           SET approval_attempts=$2,updated_at=NOW()
           WHERE id=$1`,
          [staged.id, attempts]
        );
      }
      await client.query("COMMIT");
      transactionOpen = false;
      return res.status(attempts >= 5 ? 410 : 403).json({
        code: attempts >= 5 ? "LINE_APPROVAL_ATTEMPTS_EXHAUSTED" : "LINE_SUPERVISOR_VERIFICATION_FAILED",
        error: attempts >= 5
          ? "This approval link has been locked after too many incorrect attempts. Ask the operator to submit the issue again."
          : "The work ID does not match the supervisor selected for this ticket.",
      });
    }
    if (Number(staged.requester_user_id) === Number(supervisor.id)) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(409).json({ code: "LINE_APPROVAL_SELF_REVIEW", error: "A supervisor cannot approve their own staged ticket." });
    }
    await client.query("SELECT set_config('app.user_id',$1,true)", [String(supervisor.id)]);
    const item = await findCatalogueItem(client, staged.workspace, staged.catalogue_item_id);
    if (!item || item.catalogue_type !== staged.ticket_type ||
        item.category !== staged.category ||
        item.sub_category !== staged.sub_category ||
        item.item_name !== staged.item_category ||
        (item.priority_locked && item.default_priority !== staged.priority)) {
      throw failure(409, "LINE_CATALOGUE_CHANGED", "The selected catalogue item is no longer available. Ask the operator to submit the issue again.");
    }
    const catalogueLink = await catalogueLinkService.resolve(client, { itemId: staged.catalogue_item_id, itemName: staged.item_category });

    const details = {
      catalogItemId: item.id,
      catalogItemName: item.item_name,
      station: staged.station,
      source: "Supervisor-approved line intake",
    };
    const lineIntake = await lineTicketIntake.authorizeLineTicketIntake(client, {
      actorId: staged.requester_user_id,
      workspace: staged.workspace,
      ticketType: staged.ticket_type,
      details,
      category: staged.category,
      subCategory: staged.sub_category,
      itemCategory: staged.item_category,
    });
    const pdmIntake = await pdmTicketIntake.authorizePdmTicketIntake(client, {
      actorId: supervisor.id,
      requesterId: staged.requester_user_id,
      workspace: staged.workspace,
      ticketType: staged.ticket_type,
      details,
      priority: staged.priority,
      category: staged.category,
      subCategory: staged.sub_category,
      itemCategory: staged.item_category,
      supervisorApproval: true,
    });
    const ticketPriority = ticketGovernance.requesterPriority(
      { role: "user" },
      staged.priority,
      { allowHigh: pdmIntake.allowHigh }
    );
    let groupId = pdmIntake.isPdm ? pdmIntake.defaultGroupId : null;
    if (!groupId && lineIntake.isLineReporter && staged.workspace === "IT") {
      const groupResult = await client.query(
        `SELECT id FROM support_groups
         WHERE COALESCE(is_active,TRUE)=TRUE
         ORDER BY COALESCE(is_default_triage,FALSE) DESC,
           CASE WHEN LOWER(name) IN ('service desk','helpdesk','it helpdesk','infrastructure team') THEN 0 ELSE 1 END,
           name
         LIMIT 1`
      );
      groupId = groupResult.rows[0]?.id || null;
    }
    if (!groupId) {
      throw failure(409, "LINE_SUPPORT_GROUP_UNAVAILABLE", "The governed support group for this issue is unavailable.");
    }

    const slaPolicy = await getSlaPolicy(client);
    const sla = calculateSla(slaPolicy, ticketPriority, new Date(), {
      workspace: staged.workspace,
      ticketType: staged.ticket_type,
      category: staged.category,
      subCategory: staged.sub_category,
      itemCategory: staged.item_category,
      title: staged.title,
    });
    const sequence = await client.query(
      `SELECT nextval(pg_get_serial_sequence('tickets','id')) next_id`
    );
    const ticketId = Number(sequence.rows[0].next_id);
    const prefix = staged.ticket_type === "service_request" ? "REQ" : "INC";
    const ticketRef = `${prefix}-${String(ticketId).padStart(5, "0")}`;
    const requestDetails = {
      ...details,
      supervisorApprovedBy: supervisor.id,
      supervisorApprovedAt: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO tickets(
         id,ticket_ref,title,description,requester_id,created_by_user_id,
         priority,status,workspace,assigned_group_id,assigned_to_user_id,
         ticket_type,category,sub_category,item_category,source,request_details,
          response_due_at,due_at,sla_policy_key,sla_policy_version,sla_calculated_at,
          sla_response_minutes,sla_resolution_minutes,catalogue_item_id,catalogue_item_name,catalogue_snapshot,catalogue_other_route
        )
        VALUES($1,$2,$3,$4,$5,$6,$7,'Open',$8,$9,NULL,$10,$11,$12,$13,
          'Line Assistance',$14::jsonb,$15,$16,$17,$18,NOW(),$19,$20,$21,$22,$23::jsonb,$24)`,
      [
        ticketId,ticketRef,staged.title,staged.description,staged.requester_user_id,
        supervisor.id,ticketPriority,staged.workspace,groupId,staged.ticket_type,
        staged.category,staged.sub_category,staged.item_category,
        JSON.stringify(requestDetails),sla.responseDueAt,sla.resolutionDueAt,
        sla.policyKey,sla.policyVersion,sla.responseMinutes,sla.resolutionMinutes,
        item.id,item.item_name,
        catalogueLink&&catalogueLink.snapshot?JSON.stringify(catalogueLink.snapshot):"{}",catalogueLink?Boolean(catalogueLink.otherRoute):false,
      ]
    );
    await client.query(
      `INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value,workspace)
       VALUES($1,$2,'created',NULL,'Open',$3)`,
      [ticketId, supervisor.id, staged.workspace]
    );
    await client.query(
      `INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value,workspace)
       VALUES($1,$2,'supervisor_approved',NULL,$3,$4)`,
      [ticketId, supervisor.id, `Staged line report #${staged.id}`, staged.workspace]
    );
    await client.query(
      `UPDATE line_ticket_staging
       SET status='approved',approval_token_hash=NULL,approved_at=NOW(),
           opened_ticket_id=$2,updated_at=NOW()
       WHERE id=$1`,
      [staged.id, ticketId]
    );
    const ticketResult = await client.query(
      `SELECT ticket.*,requester.name requester_name,requester.email requester_email,
              support_group.name assigned_group_name
       FROM tickets ticket
       LEFT JOIN users requester ON requester.id=ticket.requester_id
       LEFT JOIN support_groups support_group ON support_group.id=ticket.assigned_group_id
       WHERE ticket.id=$1`,
      [ticketId]
    );
    const ticket = ticketResult.rows[0];
    if (!ticket) {
      throw failure(500, "LINE_TICKET_READBACK_FAILED", "The approved ticket could not be verified after creation.");
    }
    await client.query("COMMIT");
    transactionOpen = false;

    setImmediate(async () => {
      const outcomes = await Promise.allSettled([
        createTicketAssignmentNotifications({
          ticket,
          assignedGroupId: ticket.assigned_group_id,
          assignedToUserId: ticket.assigned_to_user_id,
        }),
        createTicketCreatedNotification({
          ticket,
          requesterUserId: staged.requester_user_id,
          attachmentCount: 0,
        }),
        sendTicketCreatedLifecycle({
          ticket,
          requester,
          attachmentCount: 0,
        }),
      ]);
      outcomes.filter((outcome) => outcome.status === "rejected")
        .forEach((outcome) => console.error("Approved line ticket notification failed:", outcome.reason));
    });
    return res.status(201).json({
      status: "open",
      ticketId,
      ticketRef,
      message: "Supervisor verified. The line ticket is now open and routed to its support group.",
    });
  } catch (error) {
    if (transactionOpen && client) await client.query("ROLLBACK").catch(() => {});
    console.error("Line ticket approval failed:", error);
    return res.status(error.status || 500).json({
      code: error.code || "LINE_APPROVAL_FAILED",
      error: error.status ? error.message : "The approved line ticket could not be opened.",
    });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
