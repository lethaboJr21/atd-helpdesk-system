
const express = require("express");
// REQUESTER_CREATOR_ATTRIBUTION_CONTRACT: requester_id identifies the beneficiary while created_by_user_id identifies the authenticated creator.
const fs = require("fs");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { sendTicketCreatedLifecycle } = require("../services/ticketLifecycleEmail");
const { sendMailSafe } = require("../services/email");
const { createTicketAssignmentNotifications, createTicketCreatedNotification } = require("../services/notificationService");
const {
  optionalAttachments,
  saveUploadedFiles,
  cleanupFiles,
  listAttachments,
  getAttachment,
  absoluteFromStored,
} = require("../services/ticketAttachments");
const { getPersonalizedModules } = require("../services/personalization");
const { getSlaPolicy, calculateSla } = require("../services/slaPolicy");
const ticketGovernance = require("../services/ticketGovernance");
const pdmTicketIntake = require("../services/pdmTicketIntake");
const ticketExperience = require("../services/ticketExperienceGovernance");
const { normaliseWorkspaceCode } = require("../services/workspaceCodeRegistry");
const { scopeTo } = require("../services/workspaceQueryService");
const { resolveUserWorkspace } = require("../middleware/financeAccess");
const financeItSurveyService = require("../services/financeItSurveyService");
const pdmSupportAccess = require("../services/pdmSupportAccess");
const lineTicketIntake = require("../services/lineTicketIntake");
const catalogueLinkService = require("../services/catalogueLinkService");

const router = express.Router();
router.use(auth);

const OPERATIONS_ROLES = new Set(["agent", "operator", "manager", "admin", "superadmin"]);
const STATUS_MAP = new Map([["open","Open"],["assigned","Assigned"],["pending","Pending"],["investigating","Investigating"],["waiting approval","Waiting Approval"],["resolved","Resolved"],["closed","Closed"],["escalated","Escalated"]]);
const PRIORITY_MAP = new Map([["low","Low"],["medium","Medium"],["high","High"],["critical","Critical"],["urgent","Critical"]]);
const TYPE_PREFIX = { incident:"INC", request:"REQ", service_request:"REQ", asset_request:"REQ", change:"CHG", project:"PRJ" };

// Imported Freshservice tickets can reference people and teams that never had an
// ATD Helpdesk record, so fall back to the name captured on the ticket itself.
const TICKET_SELECT = `
 SELECT t.*,
 COALESCE(requester.name,t.external_requester_name) requester_name,
 COALESCE(requester.email,t.external_requester_email) requester_email,
 requester.job_title requester_job_title, requester.department requester_department, requester.status requester_account_status,
 creator.name created_by_name, creator.email created_by_email,
 COALESCE(assignee.name,t.external_assignee_name) assigned_to_name,
 assignee.email assigned_to_email,
 COALESCE(g.name,t.external_group_name) assigned_group_name
 FROM tickets t
 LEFT JOIN users requester ON requester.id=t.requester_id
 LEFT JOIN users creator ON creator.id=t.created_by_user_id
 LEFT JOIN users assignee ON assignee.id=t.assigned_to_user_id
 LEFT JOIN support_groups g ON g.id=t.assigned_group_id`;

// Two years of imported history shares the table with live work, so anything
// still open must sort ahead of resolved and closed tickets.
const ACTIVE_FIRST = `CASE WHEN t.status IN ('Resolved','Closed') THEN 1 ELSE 0 END`;

function text(value, max=10000){ return String(value ?? "").trim().slice(0,max); }
function id(value){ if(value===undefined)return undefined; if(value===null||value==="")return null; const n=Number(value); return Number.isInteger(n)&&n>0?n:null; }
function priority(value){ return PRIORITY_MAP.get(text(value,50).toLowerCase())||null; }
function status(value){ return STATUS_MAP.get(text(value,50).toLowerCase())||null; }
function operations(user){ return OPERATIONS_ROLES.has(text(user?.role,50).toLowerCase()); }
function age(value){ const created=new Date(value).getTime(); if(!Number.isFinite(created))return "N/A"; const m=Math.max(0,Math.floor((Date.now()-created)/60000)); if(m<60)return `${m}m`; const h=Math.floor(m/60); return h<24?`${h}h ${m%60}m`:`${Math.floor(h/24)}d ${h%24}h`; }
function decorate(ticket){ const active=!['Resolved','Closed'].includes(ticket.status); const now=Date.now(); const createdAt=new Date(ticket.created_at).getTime(); const isNew=Number.isFinite(createdAt)&&now-createdAt>=0&&now-createdAt<24*60*60*1000; return {...ticket,is_new:isNew,new_expires_at:isNew?new Date(createdAt+24*60*60*1000).toISOString():null,age:age(ticket.created_at),overdue:Boolean(ticket.due_at&&new Date(ticket.due_at).getTime()<now&&active),response_overdue:Boolean(ticket.response_due_at&&!ticket.first_responded_at&&new Date(ticket.response_due_at).getTime()<now&&active),sla:{policyKey:ticket.sla_policy_key||null,policyVersion:ticket.sla_policy_version||null,responseDueAt:ticket.response_due_at||null,resolutionDueAt:ticket.due_at||null,responseMinutes:ticket.sla_response_minutes||null,resolutionMinutes:ticket.sla_resolution_minutes||null,responseBreached:Boolean(ticket.response_due_at&&!ticket.first_responded_at&&new Date(ticket.response_due_at).getTime()<now),resolutionBreached:Boolean(ticket.due_at&&new Date(ticket.due_at).getTime()<now&&active)}}; }
function prefix(typeValue,title,workspace){ const normalized=text(typeValue,50).toLowerCase().replace(/[\s-]+/g,"_"); if(TYPE_PREFIX[normalized])return TYPE_PREFIX[normalized]; const context=`${title} ${workspace}`.toLowerCase(); if(context.includes("change"))return "CHG"; if(context.includes("request")||context.includes("asset"))return "REQ"; return "INC"; }
async function isPdmSupportTicketUser(user,ticket,database=pool){
  return normaliseWorkspaceCode(ticket?.workspace)==="PDM"&&
    await pdmSupportAccess.isSupportMember(database,user?.id);
}
async function canView(user,ticket,database=pool){
  if(operations(user)||Number(ticket.requester_id)===Number(user?.id)||Number(ticket.created_by_user_id)===Number(user?.id))return true;
  if(await isPdmSupportTicketUser(user,ticket,database))return true;
  if(normaliseWorkspaceCode(ticket.workspace)==='FIN'&&Number(ticket.assigned_to_user_id)===Number(user?.id)){try{const f=await database.query("SELECT 1 FROM finance_employee_responsibilities WHERE user_id=$1 AND active=TRUE LIMIT 1",[user.id]);if(f.rowCount)return true;}catch(error){if(error.code!=="42P01")throw error;}}
  try{const r=await database.query(`SELECT 1 FROM ticket_participants WHERE ticket_id=$1 AND user_id=$2 AND is_active=TRUE AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`,[ticket.id,user?.id]);return Boolean(r.rowCount);}catch(error){if(error.code==="42P01")return false;throw error;}
}
async function canContribute(user,ticket,database=pool){
  if(operations(user)||Number(ticket.requester_id)===Number(user?.id)||await isPdmSupportTicketUser(user,ticket,database))return true;
  try{
    const result=await database.query(`SELECT 1 FROM ticket_participants WHERE ticket_id=$1 AND user_id=$2 AND access_scope='reply_only' AND is_active=TRUE AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`,[ticket.id,user?.id]);
    return Boolean(result.rowCount);
  }catch(error){
    if(error.code==="42P01")return false;
    throw error;
  }
}
async function allowTicketOperations(req,res,next){
  if(operations(req.user))return next();
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({code:"TICKET_NOT_FOUND",error:"Ticket not found."});
    if(!await isPdmSupportTicketUser(req.user,ticket))return res.status(403).json({code:"TICKET_OPERATION_FORBIDDEN",error:"Ticket handling requires an authorised support role or membership in the ticket's workspace support group."});
    req.pdmSupportLimited=true;
    req.pdmSupportGroupId=await pdmSupportAccess.supportGroupId(pool);
    return next();
  }catch(error){return next(error);}
}
function parseDetails(value){
  if(value==null||value==="")return {};
  if(typeof value==="object"&&!Array.isArray(value))return value;
  try{ const parsed=JSON.parse(String(value)); return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}; }
  catch{ return {}; }
}
function level(value,allowed){ const normalized=text(value,50); return allowed.includes(normalized)?normalized:null; }
function initialStatus(ticketType,details){
  if(ticketType!=="change")return "Open";
  const changeType=text(details.changeType||details.change_type,40);
  if(["Major","Emergency"].includes(changeType))return "Waiting Approval";
  return "Open";
}

async function getTicket(ticketId,database=pool){ const result=await database.query(`${TICKET_SELECT} WHERE t.id=$1 LIMIT 1`,[ticketId]); return result.rows[0]||null; }
async function history(database,ticketId,actorId,action,oldValue,newValue){ try{ await database.query(`INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value) VALUES($1,$2,$3,$4,$5)`,[ticketId,actorId||null,action,oldValue==null?null:String(oldValue),newValue==null?null:String(newValue)]); }catch(error){ if(error.code!=="42P01")console.error("Ticket history write failed:",error); } }
function assignmentLabel(ticket){
  if(!ticket)return "Unassigned";
  const agent=ticket.assigned_to_name||(ticket.assigned_to_user_id?`User #${ticket.assigned_to_user_id}`:"Unassigned");
  const group=ticket.assigned_group_name||(ticket.assigned_group_id?`Group #${ticket.assigned_group_id}`:"No group");
  return `${agent} Â· ${group}`;
}
function emitTicketChange(req,changeType,ticket){
  const io=req.app.get("io");
  if(io){
    io.emit("it-dashboard:metrics-updated",{changeType,ticketId:ticket?.id,workspace:ticket?.workspace,timestamp:Date.now()});
  }
}
async function logAssignmentChange(database,ticketId,actorId,before,after){
  const from=assignmentLabel(before);
  const to=assignmentLabel(after);
  if(from===to)return;
  await history(database,ticketId,actorId,"assigned",from,to);
}
async function logStatusChange(database,ticketId,actorId,fromStatus,toStatus,action="status_changed"){
  if(!toStatus||fromStatus===toStatus)return;
  await history(database,ticketId,actorId,action,fromStatus||null,toStatus);
}
async function defaultGroup(database){ const configured=id(process.env.DEFAULT_HELPDESK_GROUP_ID); if(configured){ const found=await database.query(`SELECT id FROM support_groups WHERE id=$1 AND COALESCE(is_active,TRUE)=TRUE`,[configured]); if(found.rows[0])return configured; } const result=await database.query(`SELECT id FROM support_groups WHERE COALESCE(is_active,TRUE)=TRUE ORDER BY COALESCE(is_default_triage,FALSE) DESC, CASE WHEN LOWER(name) IN ('service desk','helpdesk','it helpdesk','infrastructure team') THEN 0 ELSE 1 END,name LIMIT 1`); return result.rows[0]?.id||null; }
async function validRequester(database,userId){ const result=await database.query(`SELECT id,name,email FROM users WHERE id=$1 AND approved=TRUE AND status='active' AND archived_at IS NULL AND COALESCE(account_type,'person')='person' LIMIT 1`,[userId]); return result.rows[0]||null; }
async function validateAssignment(database,groupId,assigneeId){
 if(groupId){ const result=await database.query(`SELECT id FROM support_groups WHERE id=$1 AND COALESCE(is_active,TRUE)=TRUE`,[groupId]); if(!result.rows[0])throw Object.assign(new Error("The selected support group is unavailable."),{status:400}); }
 if(assigneeId){ if(!groupId)throw Object.assign(new Error("Select a support group before choosing an agent."),{status:400}); const result=await database.query(`SELECT u.id FROM users u JOIN support_group_members gm ON gm.user_id=u.id AND gm.group_id=$2 WHERE u.id=$1 AND u.approved=TRUE AND u.status='active' AND u.archived_at IS NULL AND COALESCE(u.account_type,'person')='person' AND COALESCE(u.microsoft_account_enabled,TRUE)=TRUE AND u.role IN ('agent','operator','manager','admin','superadmin') LIMIT 1`,[assigneeId,groupId]); if(!result.rows[0])throw Object.assign(new Error("The selected agent is not an eligible member of this support group."),{status:400}); }
}
async function notify(ticket){ try{ await createTicketAssignmentNotifications({ticket,assignedGroupId:ticket.assigned_group_id,assignedToUserId:ticket.assigned_to_user_id}); }catch(error){console.error("Ticket notification failed:",error.message);} }
router.get("/sla-policy",async(req,res)=>{
  try{const policy=await getSlaPolicy();return res.json(policy);}catch(error){console.error("SLA policy fetch failed:",error);return res.status(500).json({error:"SLA policy could not be loaded."});}
});
router.get("/employee-view",async(req,res)=>{ try{const result=await pool.query(`${TICKET_SELECT} WHERE (t.requester_id=$1 OR t.created_by_user_id=$1) ORDER BY ${ACTIVE_FIRST},CASE WHEN t.due_at<NOW() AND t.status NOT IN ('Resolved','Closed') THEN 0 ELSE 1 END,t.created_at DESC,t.id DESC LIMIT 200`,[req.user.id]);return res.json(result.rows.map(decorate));}catch(error){console.error(error);return res.status(500).json({error:"Failed to fetch your tickets."});}});
router.get("/participant-view",async(req,res)=>{try{const result=await pool.query(`${TICKET_SELECT} JOIN ticket_participants participant_scope ON participant_scope.ticket_id=t.id WHERE participant_scope.user_id=$1 AND participant_scope.is_active=TRUE AND participant_scope.revoked_at IS NULL AND (participant_scope.expires_at IS NULL OR participant_scope.expires_at>NOW()) AND t.requester_id<>$1 ORDER BY ${ACTIVE_FIRST},t.updated_at DESC LIMIT 200`,[req.user.id]);return res.json(result.rows.map(row=>({...decorate(row),participation:true})));}catch(error){if(error.code==="42P01")return res.status(503).json({code:"PARTICIPATION_SCHEMA_PENDING",error:"Ticket participation requires the pending migration."});return res.status(500).json({error:"Failed to fetch participated tickets."});}});
router.get("/my-modules",async(req,res)=>{
  try{
    const payload=await getPersonalizedModules(req.user.id);
    return res.json(payload);
  }catch(error){
    console.error("Personalized modules failed:",error);
    return res.status(500).json({error:"Failed to load personalized modules."});
  }
});
router.get("/my-tickets",async(req,res)=>{const condition=req.user.role==='user'?`(t.requester_id=$1 OR t.created_by_user_id=$1)`:`(t.requester_id=$1 OR t.assigned_to_user_id=$1 OR t.assigned_group_id IN(SELECT group_id FROM support_group_members WHERE user_id=$1))`;try{const result=await pool.query(`${TICKET_SELECT} WHERE ${condition} ORDER BY ${ACTIVE_FIRST},CASE WHEN t.due_at<NOW() AND t.status NOT IN ('Resolved','Closed') THEN 0 ELSE 1 END,t.created_at DESC,t.id DESC LIMIT 200`,[req.user.id]);return res.json(result.rows.map(decorate));}catch(error){return res.status(500).json({error:"Failed to fetch your tickets."});}});

// Freshservice-style inbox query: filter + paginate on the server, return real
// queue counts for the full authorised set (not just the current page).
router.get("/",async(req,res)=>{
  const values=[];
  const conditions=["t.archived_at IS NULL"];
  const add=(sql,value)=>{values.push(value);conditions.push(sql.replace(/\?/g,`$${values.length}`));};

  if(req.user.role==="user")add("t.requester_id=?",req.user.id);
  else if(["agent","operator"].includes(req.user.role)){
    values.push(req.user.id);
    const i=values.length;
    conditions.push(`(t.assigned_to_user_id=$${i} OR t.assigned_to_user_id IS NULL OR t.assigned_group_id IN(SELECT group_id FROM support_group_members WHERE user_id=$${i}))`);
  }

  if(req.query.search){
    const search=text(req.query.search,300);
    const scope=String(req.query.searchScope||"everything").trim().toLowerCase();
    const allowedScopes=new Set(["everything","reference","subject","description","requester","department","assignee","support-group","category","status","priority","conversation"]);
    if(!allowedScopes.has(scope))return res.status(400).json({error:"Invalid search scope."});
    values.push(`%${search}%`);
    const i=values.length;
    const scoped={
      reference:`(t.ticket_ref ILIKE $${i} OR t.external_id ILIKE $${i})`,
      subject:`t.title ILIKE $${i}`,
      description:`t.description ILIKE $${i}`,
      requester:`(requester.name ILIKE $${i} OR requester.email ILIKE $${i} OR t.external_requester_name ILIKE $${i} OR t.external_requester_email ILIKE $${i})`,
      department:`requester.department ILIKE $${i}`,
      assignee:`(assignee.name ILIKE $${i} OR assignee.email ILIKE $${i} OR t.external_assignee_name ILIKE $${i})`,
      "support-group":`(g.name ILIKE $${i} OR t.external_group_name ILIKE $${i})`,
      category:`(t.category ILIKE $${i} OR t.sub_category ILIKE $${i} OR t.item_category ILIKE $${i} OR t.workspace ILIKE $${i})`,
      status:`t.status ILIKE $${i}`,
      priority:`t.priority ILIKE $${i}`,
      conversation:`EXISTS(SELECT 1 FROM ticket_comments search_comment WHERE search_comment.ticket_id=t.id AND search_comment.body ILIKE $${i} AND (search_comment.is_internal=FALSE OR $${i+1}=TRUE))`,
    };
    if(scope==="conversation"){
      values.push(operations(req.user));
      conditions.push(scoped.conversation);
    }else if(scope!=="everything")conditions.push(scoped[scope]);
    else{
      values.push(operations(req.user));
      const internalIndex=values.length;
      conditions.push(`(t.ticket_ref ILIKE $${i} OR t.external_id ILIKE $${i} OR t.title ILIKE $${i} OR t.description ILIKE $${i} OR t.category ILIKE $${i} OR t.sub_category ILIKE $${i} OR t.item_category ILIKE $${i} OR t.workspace ILIKE $${i} OR t.status ILIKE $${i} OR t.priority ILIKE $${i} OR requester.name ILIKE $${i} OR requester.email ILIKE $${i} OR requester.department ILIKE $${i} OR t.external_requester_name ILIKE $${i} OR t.external_requester_email ILIKE $${i} OR assignee.name ILIKE $${i} OR assignee.email ILIKE $${i} OR t.external_assignee_name ILIKE $${i} OR g.name ILIKE $${i} OR t.external_group_name ILIKE $${i} OR EXISTS(SELECT 1 FROM ticket_comments search_comment WHERE search_comment.ticket_id=t.id AND search_comment.body ILIKE $${i} AND (search_comment.is_internal=FALSE OR $${internalIndex}=TRUE)))`);
    }
  }
  const legacyView = String(req.query.view || "")
    .trim()
    .toLowerCase();

  const legacyStatusKey = String(req.query.status || "")
    .trim()
    .toLowerCase()
    .replace(/[ _]+/g, "-");

  const legacyAssignmentAliases = new Map([
    ["assigned-to-me", "mine"],
    ["my-groups", "my-groups"],
    ["my-support-groups", "my-groups"],
  ]);

  const legacyAssignmentScope =
    legacyAssignmentAliases.get(legacyStatusKey) || null;

  const assignmentScope = String(
    req.query.assignmentScope ||
      req.query.assignment ||
      req.query.assignee ||
      req.query.scope ||
      legacyAssignmentScope ||
      (legacyView === "mine" ? "mine" : "all")
  )
    .trim()
    .toLowerCase();


  const allowedAssignmentScopes = new Set([
    "all",
    "mine",
    "unassigned",
    "my-groups",
    "mine-or-groups",
  ]);
  if(!allowedAssignmentScopes.has(assignmentScope)){
    return res.status(400).json({error:"Invalid assignment filter."});
  }
  if(assignmentScope!=="all"&&!operations(req.user)){
    return res.status(403).json({error:"Assignment filters are available to Helpdesk operations users only."});
  }
  if(assignmentScope==="mine"){
    add("t.assigned_to_user_id=?",req.user.id);
  }else if(assignmentScope==="unassigned"){
    conditions.push("t.assigned_to_user_id IS NULL");
  }else if(assignmentScope==="my-groups"){
    values.push(req.user.id);
    const i=values.length;
    conditions.push(`t.assigned_group_id IN(
      SELECT gm.group_id
      FROM support_group_members gm
      JOIN support_groups sg ON sg.id=gm.group_id AND COALESCE(sg.is_active,TRUE)=TRUE
      WHERE gm.user_id=$${i}
    )`);
  }else if(assignmentScope==="mine-or-groups"){
    values.push(req.user.id);
    const i=values.length;
    conditions.push(`(t.assigned_to_user_id=$${i} OR t.assigned_group_id IN(
      SELECT gm.group_id
      FROM support_group_members gm
      JOIN support_groups sg ON sg.id=gm.group_id AND COALESCE(sg.is_active,TRUE)=TRUE
      WHERE gm.user_id=$${i}
    ))`);
  }

  // Every queue is limited to one workspace, including administrator queues.
  // Cross-workspace access to an individual ticket is governed separately by
  // requireCrossWorkspaceTicketAccess on detail routes.
  const userWorkspace = resolveUserWorkspace(req);
  const isWorkspaceAdmin = userWorkspace === null;
  const requestedWorkspace = text(req.query.workspace, 100);
  if (requestedWorkspace && requestedWorkspace.toLowerCase() === "all") {
    return res.status(403).json({
      code: "WORKSPACE_SCOPE_DENIED",
      error: "Combined ticket lists are disabled. Select one workspace.",
    });
  }
  const selectedWorkspace = requestedWorkspace || userWorkspace || "IT";
  const requestedCanonical = normaliseWorkspaceCode(selectedWorkspace);
  if (!requestedCanonical) {
    return res.status(400).json({ code: "WORKSPACE_CODE_UNRECOGNISED", error: "Unrecognised workspace filter." });
  }
  if (!isWorkspaceAdmin && requestedCanonical !== userWorkspace) {
    return res.status(403).json({ code: "WORKSPACE_SCOPE_DENIED", error: "You may only view tickets within your assigned workspace." });
  }
  const ws = scopeTo(requestedCanonical, { alias: "t", paramStart: values.length + 1 });
  values.push(...ws.params);
  conditions.push(ws.sql);

  const baseWhere=conditions.length?`WHERE ${conditions.join(" AND ")}`:"";
  const baseValues=[...values];

  const requestedStatuses = String(
    req.query.statuses ||
      (legacyAssignmentScope ? "all" : req.query.status) ||
      "all"
  )
    .split(",")
    .map(value=>value.trim())
    .filter(Boolean);
  const statusKeys=requestedStatuses.map(value=>value.toLowerCase());
  const listValues=[...values];
  const listConditions=[...conditions];
  if(!statusKeys.includes("all")&&requestedStatuses.length){
    if(statusKeys.includes("unresolved")){
      if(requestedStatuses.length!==1){
        return res.status(400).json({error:"Unresolved cannot be combined with individual statuses."});
      }
      listConditions.push(`t.status NOT IN ('Resolved','Closed')`);
    }else{
      const normalizedStatuses=[...new Set(requestedStatuses.map(status))];
      if(normalizedStatuses.some(value=>!value)){
        return res.status(400).json({error:"Invalid status filter."});
      }
      listValues.push(normalizedStatuses);
      listConditions.push(`t.status = ANY($${listValues.length}::text[])`);
    }
  }
  const requestedPriorities=String(req.query.priorities||req.query.priority||"")
    .split(",")
    .map(value=>value.trim())
    .filter(Boolean);
  if(requestedPriorities.length){
    const normalizedPriorities=[...new Set(requestedPriorities.map(priority))];
    if(normalizedPriorities.some(value=>!value)){
      return res.status(400).json({error:"Invalid priority filter."});
    }
    listValues.push(normalizedPriorities);
    listConditions.push(`t.priority = ANY($${listValues.length}::text[])`);
  }

  const addLike=(column,value)=>{const clean=text(value,200);if(clean){listValues.push(`%${clean}%`);listConditions.push(`${column} ILIKE $${listValues.length}`);}};
  addLike("COALESCE(requester.name,t.external_requester_name)",req.query.requester);
  addLike("requester.department",req.query.department);
  addLike("t.source",req.query.source);
  addLike("t.ticket_type",req.query.type);
  if(String(req.query.view||"")==="today")listConditions.push("t.created_at >= CURRENT_DATE");
  if(String(req.query.view||"")==="overdue")listConditions.push("t.due_at < NOW() AND t.status NOT IN ('Resolved','Closed')");
  if(String(req.query.view||"")==="aged-seven")listConditions.push("t.created_at <= NOW()-INTERVAL '7 days' AND t.status NOT IN ('Resolved','Closed')");
  if(String(req.query.view||"")==="aged-overdue")listConditions.push("t.created_at <= NOW()-INTERVAL '7 days' AND t.due_at < NOW() AND t.status NOT IN ('Resolved','Closed')");
  if(String(req.query.view||"")==="high")listConditions.push("t.priority IN ('Critical','High')");


  const listWhere=listConditions.length?`WHERE ${listConditions.join(" AND ")}`:"";

  const requestedLimit=Number(req.query.per_page||req.query.limit);
  const allowedPageSizes=new Set([25,50,100,250,500]);
  const perPage=Number.isFinite(requestedLimit)&&allowedPageSizes.has(Math.trunc(requestedLimit))?Math.trunc(requestedLimit):25;
  const page=Math.max(Math.trunc(Number(req.query.page)||1),1);
  const offset=(page-1)*perPage;
  const sortColumns={created_at:"t.created_at",updated_at:"t.updated_at",requester:"COALESCE(requester.name,t.external_requester_name)",department:"requester.department",status:"t.status",priority:"CASE t.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END",due_at:"t.due_at",assigned_to:"COALESCE(assignee.name,t.external_assignee_name)",reference:"t.ticket_ref"};
  const requestedSort=sortColumns[String(req.query.sort||"")]||sortColumns.created_at;
  const direction=String(req.query.direction||"desc").toLowerCase()==="asc"?"ASC":"DESC";
  const orderBy=`${ACTIVE_FIRST},CASE WHEN t.due_at<NOW() AND t.status NOT IN ('Resolved','Closed') THEN 0 ELSE 1 END,CASE WHEN t.created_at>=CURRENT_DATE THEN 0 ELSE 1 END,${requestedSort} ${direction} NULLS LAST,t.id DESC`;

  // Queue badges are independent of the active list filters.
  const countValues=[...baseValues];
  countValues.push(req.user.id);
  const queueUserIndex=countValues.length;
  const assignedToMePredicate=`t.status NOT IN ('Resolved','Closed') AND t.assigned_to_user_id=$${queueUserIndex}`;
  const myGroupsPredicate=`t.status NOT IN ('Resolved','Closed') AND t.assigned_group_id IN(
    SELECT gm.group_id FROM support_group_members gm
    JOIN support_groups sg ON sg.id=gm.group_id AND COALESCE(sg.is_active,TRUE)=TRUE
    WHERE gm.user_id=$${queueUserIndex}
  )`;
  const myOpenPredicate=`t.status NOT IN ('Resolved','Closed') AND (
    t.assigned_to_user_id=$${queueUserIndex} OR
    t.assigned_group_id IN(SELECT group_id FROM support_group_members WHERE user_id=$${queueUserIndex})
  )`;

  try{
    const [countResult,rows,countsResult]=await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM tickets t LEFT JOIN users requester ON requester.id=t.requester_id LEFT JOIN users assignee ON assignee.id=t.assigned_to_user_id LEFT JOIN support_groups g ON g.id=t.assigned_group_id ${listWhere}`,listValues),
      pool.query(`${TICKET_SELECT} ${listWhere} ORDER BY ${orderBy} LIMIT $${listValues.length+1} OFFSET $${listValues.length+2}`,[...listValues,perPage,offset]),
      pool.query(
        `SELECT
           COUNT(*)::int AS all_count,
           COUNT(*) FILTER (WHERE t.status NOT IN ('Resolved','Closed'))::int AS unresolved,
           COUNT(*) FILTER (WHERE ${assignedToMePredicate})::int AS assigned_to_me,
           COUNT(*) FILTER (WHERE ${myGroupsPredicate})::int AS my_groups,
           COUNT(*) FILTER (WHERE ${myOpenPredicate})::int AS my_open,
           COUNT(*) FILTER (WHERE t.status='Open')::int AS open,
           COUNT(*) FILTER (WHERE t.status='Assigned')::int AS assigned,
           COUNT(*) FILTER (WHERE t.status='Pending')::int AS pending,
           COUNT(*) FILTER (WHERE t.status='Investigating')::int AS investigating,
           COUNT(*) FILTER (WHERE t.status='Waiting Approval')::int AS waiting_approval,
           COUNT(*) FILTER (WHERE t.status='Resolved')::int AS resolved,
           COUNT(*) FILTER (WHERE t.status='Closed')::int AS closed,
           COUNT(*) FILTER (WHERE t.status='Escalated')::int AS escalated
         FROM tickets t
         LEFT JOIN users requester ON requester.id=t.requester_id
         LEFT JOIN users assignee ON assignee.id=t.assigned_to_user_id
         LEFT JOIN support_groups g ON g.id=t.assigned_group_id
         ${baseWhere}`,
        countValues
      ),
    ]);

    const total=countResult.rows[0].total;
    const c=countsResult.rows[0];
    return res.json({
      tickets:rows.rows.map(decorate),
      pagination:{
        page,
        perPage,
        total,
        totalPages:Math.max(1,Math.ceil(total/perPage)),
      },
      counts:{
        All:c.all_count,
        "Assigned to me":c.assigned_to_me,
        "My groups":c.my_groups,
        "My open tickets":c.my_open,
        Unresolved:c.unresolved,
        Open:c.open,
        Assigned:c.assigned,
        Pending:c.pending,
        Investigating:c.investigating,
        "Waiting Approval":c.waiting_approval,
        Resolved:c.resolved,
        Closed:c.closed,
        Escalated:c.escalated,
      },
    });
  }catch(error){
    console.error("Fetch tickets failed:",error);
    return res.status(500).json({error:"Failed to fetch tickets."});
  }
});
router.post("/:id/reopen",async(req,res)=>{
  const reason=text(req.body.reason,1000);
  if(reason.length<10)return res.status(400).json({code:"REOPEN_REASON_REQUIRED",error:"Describe how the issue reappeared using at least 10 characters."});
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const result=await client.query("SELECT * FROM tickets WHERE id=$1 AND archived_at IS NULL FOR UPDATE",[req.params.id]);
    const ticket=result.rows[0];
    if(!ticket)throw Object.assign(new Error("Ticket not found."),{status:404,code:"TICKET_NOT_FOUND"});
    if(Number(ticket.requester_id)!==Number(req.user.id))throw Object.assign(new Error("Only the requester may reopen this ticket."),{status:403,code:"REOPEN_REQUESTER_ONLY"});
    if(!["Resolved","Closed"].includes(ticket.status))throw Object.assign(new Error("Only a Resolved or Closed ticket can be reopened."),{status:409,code:"REOPEN_STATUS_INVALID"});
    const finalAt=new Date(ticket.closed_at||ticket.resolved_at||ticket.updated_at).getTime();
    if(!Number.isFinite(finalAt)||Date.now()-finalAt>7*24*60*60*1000)throw Object.assign(new Error("The 7-day ticket revival window has expired."),{status:409,code:"REOPEN_WINDOW_EXPIRED_7_DAYS"});
    const cycle=Number(ticket.reopen_count||0)+1;
    await client.query(`INSERT INTO ticket_resolution_cycles(ticket_id,cycle_number,prior_status,resolved_at,closed_at,reopened_by_user_id,recurrence_reason)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[ticket.id,cycle,ticket.status,ticket.resolved_at,ticket.closed_at,req.user.id,reason]);
    await client.query(`UPDATE tickets SET status='Open',resolved_at=NULL,closed_at=NULL,reopen_count=$2,latest_reopened_at=NOW(),latest_reopened_by_user_id=$3,latest_reopen_reason=$4,updated_at=NOW() WHERE id=$1`,[ticket.id,cycle,req.user.id,reason]);
    await history(client,ticket.id,req.user.id,"requester_reopened_repeat_issue",ticket.status,JSON.stringify({cycle,reason}));
    await client.query("COMMIT");
    emitTicketChange(req,"reopened",ticket);
    return res.json({message:"Ticket reopened and returned to the active support queue.",ticketId:ticket.id,reopenCount:cycle,repeatIssue:true});
  }catch(error){
    await client.query("ROLLBACK").catch(()=>{});
    return res.status(error.status||500).json({code:error.code||"REOPEN_FAILED",error:error.status?error.message:"Failed to reopen ticket."});
  }finally{client.release();}
});

router.get("/:id/resolution-cycles",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
    const result=await pool.query(`SELECT c.*,u.name AS reopened_by_name FROM ticket_resolution_cycles c LEFT JOIN users u ON u.id=c.reopened_by_user_id WHERE c.ticket_id=$1 ORDER BY c.cycle_number DESC`,[req.params.id]);
    return res.json(result.rows);
  }catch(error){if(error.code==="42P01")return res.status(503).json({code:"REOPEN_SCHEMA_PENDING",error:"Reopen-cycle storage is pending migration."});return res.status(500).json({error:"Failed to load resolution cycles."});}
});

router.get("/:id/history",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
    const result=await pool.query(
      `SELECT th.id, th.ticket_id, th.actor_user_id, th.action, th.old_value, th.new_value, th.created_at,
              u.name AS actor_name, u.email AS actor_email
       FROM ticket_history th
       LEFT JOIN users u ON u.id = th.actor_user_id
       WHERE th.ticket_id = $1
       ORDER BY th.created_at DESC, th.id DESC`,
      [req.params.id]
    );
    return res.json(result.rows);
  }catch(error){
    if(error.code==="42P01")return res.json([]);
    console.error("Fetch ticket history failed:",error);
    return res.status(500).json({error:"Failed to fetch ticket history."});
  }
});
router.post("/:id/history/:historyId/undo",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const ticketResult=await client.query("SELECT * FROM tickets WHERE id=$1 FOR UPDATE",[req.params.id]);
  const ticket=ticketResult.rows[0];
  if(!ticket)throw Object.assign(new Error("Ticket not found."),{status:404,code:"UNDO_TICKET_NOT_FOUND"});
  const historyResult=await client.query("SELECT * FROM ticket_history WHERE id=$1 AND ticket_id=$2 FOR UPDATE",[req.params.historyId,ticket.id]);
  const activity=historyResult.rows[0];
  if(!activity)throw Object.assign(new Error("Activity not found."),{status:404,code:"UNDO_ACTIVITY_NOT_FOUND"});
  if(Number(activity.actor_user_id)!==Number(req.user.id)&&req.user.role!=="superadmin")throw Object.assign(new Error("Only the participant who made this change or a superadministrator may undo it."),{status:403,code:"UNDO_FORBIDDEN"});
  if(Date.now()-new Date(activity.created_at).getTime()>30000)throw Object.assign(new Error("The Undo period has expired."),{status:409,code:"UNDO_EXPIRED"});
  const action=String(activity.action||"").toLowerCase();
  if(!["status_changed","priority_changed"].includes(action))throw Object.assign(new Error("This activity does not have a safe Undo operation."),{status:409,code:"UNDO_NOT_SUPPORTED"});
  const existing=await client.query("SELECT * FROM ticket_activity_undo WHERE history_id=$1 FOR UPDATE",[activity.id]);
  if(existing.rows[0]?.consumed_at)throw Object.assign(new Error("This activity has already been undone."),{status:409,code:"UNDO_ALREADY_USED"});
  const column=action==="status_changed"?"status":"priority";
  if(String(ticket[column]??"")!==String(activity.new_value??""))throw Object.assign(new Error("The ticket changed again, so this activity can no longer be undone safely."),{status:409,code:"UNDO_STATE_CONFLICT"});
  const ledger=existing.rows[0]||(await client.query(`INSERT INTO ticket_activity_undo(ticket_id,history_id,requested_by_user_id,action,expected_value,restore_value,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[ticket.id,activity.id,req.user.id,action,String(activity.new_value??""),activity.old_value,new Date(new Date(activity.created_at).getTime()+30000)])).rows[0];
  if(new Date(ledger.expires_at).getTime()<=Date.now())throw Object.assign(new Error("The Undo period has expired."),{status:409,code:"UNDO_EXPIRED"});
  const allowed=column==="status"?STATUS_MAP:PRIORITY_MAP;
  const restored=allowed.get(String(activity.old_value||"").trim().toLowerCase());
  if(!restored)throw Object.assign(new Error("The previous value is no longer valid."),{status:409,code:"UNDO_RESTORE_INVALID"});
  if(column==="status")await client.query(`UPDATE tickets SET status=$1,resolved_at=CASE WHEN $1 IN ('Resolved','Closed') THEN COALESCE(resolved_at,NOW()) ELSE NULL END,closed_at=CASE WHEN $1='Closed' THEN COALESCE(closed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$2`,[restored,ticket.id]);
  else await client.query("UPDATE tickets SET priority=$1,updated_at=NOW() WHERE id=$2",[restored,ticket.id]);
  await client.query("UPDATE ticket_activity_undo SET consumed_at=NOW(),consumed_by_user_id=$2 WHERE id=$1 AND consumed_at IS NULL",[ledger.id,req.user.id]);
  const undoHistory=(await client.query(`INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value) VALUES($1,$2,'undo_applied',$3,$4) RETURNING *`,[ticket.id,req.user.id,JSON.stringify({historyId:activity.id,action:activity.action,value:activity.new_value}),JSON.stringify({restoredValue:restored})])).rows[0];
  await client.query("COMMIT");
  return res.json({message:`${column==="status"?"Status":"Priority"} change undone.`,ticket:decorate(await getTicket(ticket.id)),activity:undoHistory});
 }catch(error){await client.query("ROLLBACK").catch(()=>{});return res.status(error.status||500).json({code:error.code||"UNDO_ERROR",error:error.status?error.message:"The activity could not be undone."});}
 finally{client.release();}
});
router.get("/:id/comments",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
    const ops=operations(req.user)||await isPdmSupportTicketUser(req.user,ticket);
    const result=await pool.query(
      `SELECT c.id, c.ticket_id, c.author_user_id, c.body, c.is_internal, c.created_at,
              c.author_name, c.author_email, c.origin,
              COALESCE(u.name, c.author_name) AS display_name,
              COALESCE(u.email, c.author_email) AS display_email
         FROM ticket_comments c
         LEFT JOIN users u ON u.id = c.author_user_id
        WHERE c.ticket_id = $1
          AND ($2::boolean OR c.is_internal = FALSE)
        ORDER BY c.created_at ASC, c.id ASC`,
      [ticket.id, ops]
    );
    return res.json(result.rows);
  }catch(error){
    if(error.code==="42P01")return res.json([]);
    console.error("Fetch ticket comments failed:",error);
    return res.status(500).json({error:"Failed to fetch conversation."});
  }
});

router.post("/:id/comments",async(req,res)=>{
  const body=text(req.body.body||req.body.comment);
  if(!body)return res.status(400).json({error:"Write a message before posting."});
  const wantInternal=Boolean(req.body.isInternal||req.body.is_internal);
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only comment on tickets you can view."});
    if(!await canContribute(req.user,ticket))return res.status(403).json({code:"PARTICIPANT_READ_ONLY",error:"This ticket participation is read-only. Reply Only access is required to post a message."});
    const ops=operations(req.user)||await isPdmSupportTicketUser(req.user,ticket);
    const isInternal=ops&&wantInternal;
    const inserted=await pool.query(
      `INSERT INTO ticket_comments (
         ticket_id, author_user_id, body, is_internal, created_at,
         author_name, author_email, origin
       ) VALUES ($1,$2,$3,$4,NOW(),$5,$6,'helpdesk')
       RETURNING id, ticket_id, author_user_id, body, is_internal, created_at,
                 author_name, author_email, origin`,
      [ticket.id, req.user.id, body, isInternal, req.user.name||null, req.user.email||null]
    );
    const row=inserted.rows[0];
    await history(
      pool,
      ticket.id,
      req.user.id,
      isInternal?"internal_note":"comment_added",
      null,
      body.slice(0,120)
    );
    await pool.query(`UPDATE tickets SET updated_at=NOW() WHERE id=$1`,[ticket.id]);
    return res.status(201).json({
      ...row,
      display_name:req.user.name||row.author_name,
      display_email:req.user.email||row.author_email,
    });
  }catch(error){
    if(error.code==="42P01")return res.status(503).json({error:"Conversation storage is not available yet."});
    console.error("Post ticket comment failed:",error);
    return res.status(500).json({error:"Failed to post message."});
  }
});

router.post("/:id/reply-action",allowTicketOperations,async(req,res)=>{
  const body=text(req.body.body || req.body.comment);
  const action=text(req.body.action || "send",30).toLowerCase();
  if(action==="send_close"&&!["manager","superadmin"].includes(req.user.role))return res.status(403).json({error:"Immediate closure requires manager or superadministrator authority."});
  const allowed=new Set(["send","send_resolve","send_close"]);
  if(!body)return res.status(400).json({error:"Write a message before sending."});
  if(!allowed.has(action))return res.status(400).json({error:"Invalid reply action."});
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const ticket=await getTicket(req.params.id,client);
    if(!ticket){await client.query("ROLLBACK");return res.status(404).json({error:"Ticket not found."});}
    const isInternal=Boolean(req.body.isInternal || req.body.is_internal);
    if(isInternal && action!=="send")throw Object.assign(new Error("Internal notes cannot resolve or close a ticket."),{status:400});
    await client.query(`INSERT INTO ticket_comments(ticket_id,author_user_id,body,is_internal,created_at,author_name,author_email,origin) VALUES($1,$2,$3,$4,NOW(),$5,$6,'helpdesk')`,[ticket.id,req.user.id,body,isInternal,req.user.name||null,req.user.email||null]);
    await history(client,ticket.id,req.user.id,isInternal?"internal_note":"comment_added",null,body.slice(0,120));
    let nextStatus=ticket.status;
    let statusAction=null;
    if(action==="send_resolve"){nextStatus="Resolved";statusAction="resolve";}
    if(action==="send_close"){nextStatus="Closed";statusAction="closed";}
    if(statusAction){
      await client.query(`UPDATE tickets SET status=$1,resolved_at=COALESCE(resolved_at,NOW()),closed_at=CASE WHEN $1='Closed' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$2`,[nextStatus,ticket.id]);
      await logStatusChange(client,ticket.id,req.user.id,ticket.status,nextStatus,statusAction);
    }else await client.query(`UPDATE tickets SET updated_at=NOW() WHERE id=$1`,[ticket.id]);
    await client.query("COMMIT");
    let emailResult={sent:false,skipped:true,reason:"Internal notes are portal-only."};
    if(!isInternal){
      const participants=await pool.query(`SELECT email,participant_type FROM ticket_email_participants WHERE ticket_id=$1 AND is_active=TRUE ORDER BY id`,[ticket.id]);
      const selected=Array.isArray(req.body.recipients)?req.body.recipients.map(v=>String(v).toLowerCase()):[];
      const allowed=new Map([[String(ticket.requester_email||"").toLowerCase(),"to"],[String(ticket.assigned_to_email||"").toLowerCase(),"cc"]]);for(const row of participants.rows)allowed.set(String(row.email).toLowerCase(),row.participant_type);
      const chosen=(selected.length?selected:Array.from(allowed.keys())).filter(v=>v&&allowed.has(v));const to=chosen.filter(v=>(allowed.get(v)||"to")==="to");const cc=chosen.filter(v=>!to.includes(v));if(!to.length&&ticket.requester_email)to.push(String(ticket.requester_email).toLowerCase());
      emailResult=await sendMailSafe({to,cc,category:"requester_update",subject:`[${ticket.ticket_ref||`TICKET-${ticket.id}`}] ${ticket.title||"Ticket update"}`,text:body,html:`<div style="font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap">${body.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</div>`});
      await history(pool,ticket.id,req.user.id,"email_recipients_selected",null,JSON.stringify({to,cc,result:{sent:Boolean(emailResult.sent),skipped:Boolean(emailResult.skipped)}}));
    }
    return res.status(201).json({message:nextStatus===ticket.status?"Reply recorded.":`Reply recorded and ticket marked ${nextStatus}.`,email:emailResult,ticket:decorate(await getTicket(ticket.id))});
  }catch(error){await client.query("ROLLBACK").catch(()=>{});return res.status(error.status||500).json({error:error.status?error.message:"Failed to send reply action."});}
  finally{client.release();}
});
router.get("/:id",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
    const attachments=await listAttachments(pool,ticket.id).catch(()=>[]);
    return res.json({...decorate(ticket),attachments});
  }catch(error){
    return res.status(500).json({error:"Failed to fetch the ticket."});
  }
});

router.post("/",optionalAttachments,async(req,res)=>{
  const files=Array.isArray(req.files)?req.files:[];
  const title=text(req.body.title,180);
  const description=text(req.body.description);
  let ticketPriority=priority(req.body.priority)||"Medium";
  const priorityProvided=Boolean(priority(req.body.priority));
  const workspace=text(req.body.workspace||"IT",100);
  const ticketType=text(req.body.ticketType,50).toLowerCase().replace(/[\s-]+/g,"_")||null;
  const category=text(req.body.category,120)||null;
  const subCategory=text(req.body.subCategory||req.body.sub_category,120)||null;
  const itemCategory=text(req.body.itemCategory||req.body.item_category,120)||null;
  let impact=level(req.body.impact,["Low","Medium","High"]);
let urgency=level(req.body.urgency,["Low","Medium","High"]);
  const source=text(req.body.source,50)||"Portal";
  const financeWorkspace=normaliseWorkspaceCode(workspace)==="FIN";
  const financeMetadata=req.body.financeMetadata&&typeof req.body.financeMetadata==="object"&&!Array.isArray(req.body.financeMetadata)
    ?req.body.financeMetadata:{};
  const rawFinanceKpiId=req.body.financeKpiId??financeMetadata.financeKpiId;
  const financeKpiId=id(rawFinanceKpiId);
  const financeFunction=text(req.body.financeFunction||financeMetadata.financeFunction||category,80)||null;
  const details=parseDetails(req.body.requestDetails||req.body.request_details);
  if(financeWorkspace&&Object.keys(financeMetadata).length){
    details.financeMetadata=financeMetadata;
  }
  let catalogue=null;
  try{catalogue=ticketGovernance.catalogueRequirement(ticketType,details,category,subCategory);}catch(error){cleanupFiles(files);return res.status(error.status||400).json({code:error.code,error:error.message});}
  let groupId=id(req.body.assignedGroupId);
  let assigneeId=id(req.body.assignedToUserId);
  let requesterId=req.user.id;

  if(!title){ cleanupFiles(files); return res.status(400).json({error:"A ticket title is required."}); }
  if(!description){ cleanupFiles(files); return res.status(400).json({error:"A ticket description is required."}); }
  if(rawFinanceKpiId!=null&&rawFinanceKpiId!==""&&!financeKpiId){cleanupFiles(files);return res.status(400).json({code:"FINANCE_KPI_ID_INVALID",error:"Select a valid Finance KPI."});}
  const actorWorkspace=resolveUserWorkspace(req);
  if(financeWorkspace&&actorWorkspace&&actorWorkspace!=="FIN"){cleanupFiles(files);return res.status(403).json({code:"FINANCE_WORKSPACE_SCOPE_DENIED",error:"Only authorised Finance users may create Finance tickets."});}
  const workspaceCode=normaliseWorkspaceCode(workspace);
  if(!financeWorkspace&&!groupId&&!assigneeId&&!["IT","PDM"].includes(workspaceCode)){ cleanupFiles(files); return res.status(400).json({code:"SUPPORT_GROUP_REQUIRED",error:"Select a support group or eligible agent."}); }
  if(financeWorkspace)groupId=null;

  const requestedFor=id(req.body.requesterId||req.body.requestedForUserId);
  if(requestedFor&&requestedFor!==req.user.id){
    const beneficiary=await validRequester(pool,requestedFor);
    if(!beneficiary){ cleanupFiles(files); return res.status(400).json({error:"The selected beneficiary is not an active employee account."}); }
    requesterId=requestedFor;
  }

  let openStatus=initialStatus(ticketType,details);
  // A ticket born with a specific agent is Assigned, matching the ops flow.
  if(openStatus==="Open"&&assigneeId)openStatus="Assigned";
  const client=await pool.connect();
  let open=false;
  try{
    await client.query("BEGIN");
    open=true;
    let catalogueLink=null;
    if(catalogue)catalogueLink=await catalogueLinkService.resolve(client,{itemId:catalogue.itemId,itemName:catalogue.itemName});
    const requester=await validRequester(client,requesterId);
    if(!requester){
      await client.query("ROLLBACK"); open=false; cleanupFiles(files);
      return res.status(400).json({error:"The selected requester is not an active person account."});
    }
    const lineIntake=await lineTicketIntake.authorizeLineTicketIntake(client,{
      actorId:req.user.id,
      workspace,
      ticketType,
      details,
      category,
      subCategory,
      itemCategory,
    });
    const pdmIntake=await pdmTicketIntake.authorizePdmTicketIntake(client,{
      actorId:req.user.id,
      requesterId,
      workspace,
      ticketType,
      details,
      priority:ticketPriority,
      category,
      subCategory,
      itemCategory,
    });
    if(pdmIntake.isPdm){
      if(!pdmIntake.defaultGroupId)throw Object.assign(new Error("PDM line tickets require the governed PDM Line Support group."),{status:409,code:"PDM_SUPPORT_GROUP_REQUIRED"});
      if(groupId&&Number(groupId)!==Number(pdmIntake.defaultGroupId)){
        throw Object.assign(new Error("PDM catalogue tickets must remain with the PDM Line Support group."),{status:403,code:"PDM_SUPPORT_GROUP_LOCKED"});
      }
      groupId=pdmIntake.defaultGroupId;
    }else if(lineIntake.isLineReporter&&normaliseWorkspaceCode(workspace)==="IT"){
      const itGroupId=await defaultGroup(client);
      if(!itGroupId)throw Object.assign(new Error("No default IT support group is configured."),{status:409,code:"IT_SUPPORT_GROUP_REQUIRED"});
      if(groupId&&Number(groupId)!==Number(itGroupId)){
        throw Object.assign(new Error("Production line Network tickets must remain with the default IT support group."),{status:403,code:"LINE_IT_SUPPORT_GROUP_LOCKED"});
      }
      groupId=itGroupId;
    }
    if(catalogueLink&&catalogueLink.linked&&!financeWorkspace){
      if(!groupId&&catalogueLink.defaults.groupId)groupId=catalogueLink.defaults.groupId;
      if(!assigneeId&&catalogueLink.defaults.assigneeUserId)assigneeId=catalogueLink.defaults.assigneeUserId;
    }
    if(!financeWorkspace&&!groupId&&!assigneeId){
      if(pdmIntake.isPdm)throw Object.assign(new Error("PDM line tickets require the governed PDM Line Support group."),{status:409,code:"PDM_SUPPORT_GROUP_REQUIRED"});
      groupId=await defaultGroup(client);
    }
    if(!financeWorkspace&&!groupId){
      throw Object.assign(new Error("No eligible support group is available for this ticket."),{status:409,code:"SUPPORT_GROUP_REQUIRED"});
    }
    if(catalogueLink&&catalogueLink.defaults.priority&&!priorityProvided&&!catalogueLink.defaults.priorityLocked){
      ticketPriority=catalogueLink.defaults.priority;
    }
    ticketPriority=ticketGovernance.requesterPriority(req.user,ticketPriority,{allowHigh:pdmIntake.allowHigh});
if(String(req.user?.role||"").toLowerCase()==="user"){const m={Low:["Low","Low"],Medium:["Medium","Medium"],High:["High","High"],Critical:["High","High"]}[ticketPriority]||["Medium","Medium"];impact=m[0];urgency=m[1];}
    if(catalogueLink&&catalogueLink.defaults.priorityLocked&&catalogueLink.defaults.priority){
      ticketPriority=catalogueLink.defaults.priority;
    }
    const slaPolicy=await getSlaPolicy(client);
    const sla=calculateSla(slaPolicy,ticketPriority,new Date(),{
      workspace,
      ticketType,
      category,
      subCategory,
      itemCategory,
      title,
    });
    if(financeWorkspace){
      let linkedKpi=null;
      if(financeKpiId){
        const kpiResult=await client.query(
          `SELECT id,owner_user_id,name
           FROM finance_kpis
           WHERE id=$1 AND status='active'
           LIMIT 1`,
          [financeKpiId]
        );
        linkedKpi=kpiResult.rows[0]||null;
        const expectedOwnerId=assigneeId||requesterId;
        if(!linkedKpi||Number(linkedKpi.owner_user_id)!==Number(expectedOwnerId)){
          throw Object.assign(new Error("The selected KPI is not active or does not belong to the Finance employee assigned to this ticket."),{status:400,code:"FINANCE_KPI_OWNER_MISMATCH"});
        }
      }
      if(assigneeId){
        const eligible=await client.query(`SELECT u.id FROM users u WHERE u.id=$1 AND u.approved=TRUE AND u.status='active' AND u.archived_at IS NULL AND COALESCE(u.account_type,'person')='person' AND LOWER(COALESCE(u.department,''))='finance' LIMIT 1`,[assigneeId]);
        if(!eligible.rows[0])throw Object.assign(new Error("The selected owner is not an active verified Finance employee."),{status:400});
      }
      groupId=null;
    }else{
      const governed=await ticketGovernance.governedAssignment(client,groupId,assigneeId);
      groupId=governed.groupId;
      await validateAssignment(client,groupId,assigneeId);
    }
    const duplicate=await client.query(
      `SELECT id,ticket_ref FROM tickets
        WHERE requester_id=$1 AND LOWER(title)=LOWER($2) AND created_at>NOW()-INTERVAL '30 seconds'
        ORDER BY created_at DESC LIMIT 1`,
      [requesterId,title]
    );
    if(duplicate.rows[0]){
      await client.query("ROLLBACK"); open=false; cleanupFiles(files);
      return res.status(409).json({error:"A similar ticket was just created.",ticket:duplicate.rows[0]});
    }

    const sequence=await client.query(`SELECT nextval(pg_get_serial_sequence('tickets','id')) next_id`);
    const nextId=sequence.rows[0].next_id;
    const reference=`${prefix(req.body.ticketType,title,workspace)}-${String(nextId).padStart(5,"0")}`;

    await client.query(
      `INSERT INTO tickets(
         id,ticket_ref,title,description,requester_id,created_by_user_id,priority,status,workspace,
         assigned_group_id,assigned_to_user_id,ticket_type,category,sub_category,item_category,
         impact,urgency,source,request_details,response_due_at,due_at,sla_policy_key,sla_policy_version,sla_calculated_at,sla_response_minutes,sla_resolution_minutes,catalogue_item_id,catalogue_item_name,catalogue_snapshot,catalogue_other_route
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21,$22,$23,NOW(),$24,$25,$26,$27,$28::jsonb,$29)`,
      [
        nextId,reference,title,description,requesterId,req.user.id,ticketPriority,openStatus,workspace,
        groupId,assigneeId,ticketType,category,subCategory,itemCategory,
        impact,urgency,source,JSON.stringify(details),sla.responseDueAt,sla.resolutionDueAt,sla.policyKey,sla.policyVersion,sla.responseMinutes,sla.resolutionMinutes,catalogueLink?catalogueLink.itemId:null,catalogueLink?catalogueLink.itemName:null,catalogueLink&&catalogueLink.snapshot?JSON.stringify(catalogueLink.snapshot):"{}",catalogueLink?Boolean(catalogueLink.otherRoute):false,
      ]
    );
    if(financeWorkspace){
      await client.query(
        `INSERT INTO finance_ticket_operations(ticket_id,triage_state,finance_function,finance_kpi_id)
         VALUES($1,'actionable',$2,$3)
         ON CONFLICT(ticket_id) DO UPDATE SET
           triage_state='actionable',
           finance_function=EXCLUDED.finance_function,
           finance_kpi_id=EXCLUDED.finance_kpi_id,
           updated_at=NOW()`,
        [nextId,financeFunction||"General Finance Administration",financeKpiId||null]
      );
    }

    const attachments=await saveUploadedFiles(client,nextId,req.user.id,files);
    if(attachments.length){
      await history(client,nextId,req.user.id,"attachment_added",null,`${attachments.length} file(s)`);
    }
    await history(client,nextId,req.user.id,"created",null,openStatus);
    await history(client,nextId,req.user.id,"sla_applied",null,JSON.stringify({
      priority:ticketPriority,
      service:sla.service,
      policyKey:sla.policyKey,
      policyVersion:sla.policyVersion,
      responseOnlyOverride:sla.responseOnlyOverride,
      responseMinutes:sla.responseMinutes,
      resolutionMinutes:sla.resolutionMinutes,
      responseDueAt:sla.responseDueAt.toISOString(),
      resolutionDueAt:sla.resolutionDueAt.toISOString(),
    }));
    if(openStatus==="Waiting Approval"){
      await history(client,nextId,req.user.id,"approval_required",null,details.changeType||"Change");
    }

    await client.query("COMMIT");
    open=false;
    const ticket=await getTicket(nextId);
    setImmediate(async () => {
      await Promise.allSettled([
        notify(ticket),
        createTicketCreatedNotification({ ticket, requesterUserId: requester.id, attachmentCount: attachments.length }),
        sendTicketCreatedLifecycle({ requester, ticket, attachmentCount: attachments.length }),
      ]);
    });
    emitTicketChange(req,"created",ticket);
    return res.status(201).json({...decorate(ticket),attachments,confirmationQueued:true,...(catalogueLink&&catalogueLink.notice?{catalogueNotice:catalogueLink.notice}:{})});
  }catch(error){
    if(open)await client.query("ROLLBACK").catch(()=>{});
    cleanupFiles(files);
    console.error("Create ticket failed:",error);
    return res.status(error.status||500).json({
      ...(error.code?{code:error.code}:{}),
      error:error.status?error.message:"Failed to create ticket.",
    });
  }finally{
    client.release();
  }
});

router.get("/:id/attachments",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
    return res.json(await listAttachments(pool,ticket.id));
  }catch(error){
    return res.status(500).json({error:"Failed to list attachments."});
  }
});

router.get("/:id/attachments/:attachmentId/preview",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only preview attachments from tickets you can view."});
    const attachment=await getAttachment(pool,req.params.attachmentId);
    if(!attachment||Number(attachment.ticket_id)!==Number(ticket.id))return res.status(404).json({error:"Attachment not found."});
    const allowed=new Set(["image/png","image/jpeg","image/webp","application/pdf"]);
    const contentType=String(attachment.content_type||"").trim().toLowerCase();
    if(!allowed.has(contentType))return res.status(415).json({error:"This attachment type is not available for inline preview."});
    const absolutePath=absoluteFromStored(attachment.stored_path);
    if(!fs.existsSync(absolutePath))return res.status(404).json({error:"Attachment file is missing on disk."});
    const safeName=String(attachment.original_name||"attachment").replace(/["\r\n]/g,"");
    res.setHeader("Content-Type",contentType);
    res.setHeader("Content-Disposition",`inline; filename="${safeName}"`);
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Cache-Control","private, max-age=300");
    return fs.createReadStream(absolutePath).pipe(res);
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Unable to preview attachment."});
  }
});

router.get("/:id/attachments/:attachmentId/download",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!await canView(req.user,ticket))return res.status(403).json({error:"You may only download attachments from your own tickets."});

    const attachment=await getAttachment(pool,req.params.attachmentId);
    if(!attachment||Number(attachment.ticket_id)!==Number(ticket.id)){
      return res.status(404).json({error:"Attachment not found."});
    }

    const absolutePath=absoluteFromStored(attachment.stored_path);
    if(!fs.existsSync(absolutePath)){
      return res.status(404).json({error:"Attachment file is missing on disk."});
    }

    res.setHeader("Content-Type",attachment.content_type||"application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(attachment.original_name||"attachment").replace(/"/g,"")}"`
    );
    return fs.createReadStream(absolutePath).pipe(res);
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Unable to download attachment."});
  }
});

router.post("/:id/attachments",optionalAttachments,async(req,res)=>{
  const files=Array.isArray(req.files)?req.files:[];
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket){ cleanupFiles(files); return res.status(404).json({error:"Ticket not found."}); }
    if(!await canView(req.user,ticket)){ cleanupFiles(files); return res.status(403).json({error:"You may only attach files to tickets you can view."}); }
    if(!await canContribute(req.user,ticket)){ cleanupFiles(files); return res.status(403).json({code:"PARTICIPANT_READ_ONLY",error:"This ticket participation is read-only. Reply Only access is required to upload evidence."}); }
    if(!files.length)return res.status(400).json({error:"Choose at least one file to upload."});

    const saved=await saveUploadedFiles(pool,ticket.id,req.user.id,files);
    await history(pool,ticket.id,req.user.id,"attachment_added",null,`${saved.length} file(s)`);
    return res.status(201).json(saved);
  }catch(error){
    cleanupFiles(files);
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to upload attachments."});
  }
});

router.post("/bulk",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
 const rawIds=Array.isArray(req.body.ticketIds)?req.body.ticketIds:[];
 const ticketIds=[...new Set(rawIds.map(Number).filter(value=>Number.isInteger(value)&&value>0))].slice(0,500);
 const action=text(req.body.action,30).toLowerCase();
 const reason=text(req.body.reason,1000);
 const changes=req.body.changes&&typeof req.body.changes==="object"?req.body.changes:{};
 if(!ticketIds.length)return res.status(400).json({code:"BULK_TICKETS_REQUIRED",error:"Select at least one ticket."});
 if(!["modify","archive","delete","prepare-resolution"].includes(action))return res.status(400).json({code:"BULK_ACTION_INVALID",error:"Unsupported bulk ticket action."});
 if(["archive","delete"].includes(action)&&reason.length<5)return res.status(400).json({code:"BULK_REASON_REQUIRED",error:"Provide a reason of at least 5 characters."});
 if(action==="prepare-resolution"&&reason.length<10)return res.status(400).json({code:"RESOLUTION_SUMMARY_REQUIRED",error:"Provide a resolution summary of at least 10 characters."});
 if(action==="delete"&&req.user.role!=="superadmin")return res.status(403).json({code:"BULK_DELETE_FORBIDDEN",error:"Permanent ticket deletion requires superadministrator authority."});
 const allowedChangeKeys=new Set(["priority","status","workspace","assignedGroupId","assignedToUserId","dueAt"]);
 const supplied=Object.keys(changes).filter(key=>changes[key]!==undefined);
 if(action==="modify"&&(!supplied.length||supplied.some(key=>!allowedChangeKeys.has(key))))return res.status(400).json({code:"BULK_CHANGES_INVALID",error:"Choose one or more supported fields."});
 if(action==="modify"&&changes.status!==undefined&&["Resolved","Closed"].includes(status(changes.status)))return res.status(409).json({code:"BULK_GOVERNED_STATUS_REQUIRED",error:"Resolve and Close must use the governed per-ticket reply workflow."});
 const client=await pool.connect();const results=[];
 try{
  await client.query("BEGIN");
  for(const ticketId of ticketIds){
   const savepoint=`bulk_ticket_${ticketId}`;
   try{
    await client.query(`SAVEPOINT ${savepoint}`);
    const found=await client.query("SELECT * FROM tickets WHERE id=$1 FOR UPDATE",[ticketId]);
    const before=found.rows[0];
    if(!before)throw Object.assign(new Error("Ticket not found."),{code:"TICKET_NOT_FOUND"});
    if(action==="prepare-resolution"){
      if(before.archived_at)throw Object.assign(new Error("Archived tickets cannot be prepared for resolution."),{code:"TICKET_ARCHIVED"});
      if(["Resolved","Closed"].includes(before.status))throw Object.assign(new Error(`Ticket is already ${before.status.toLowerCase()}.`),{code:"TICKET_ALREADY_FINAL"});
      if(before.status==="Waiting Approval")throw Object.assign(new Error("Ticket is awaiting approval."),{code:"TICKET_WAITING_APPROVAL"});
      if(!before.assigned_to_user_id&&!before.assigned_group_id)throw Object.assign(new Error("Ticket has no accountable owner or support group."),{code:"TICKET_OWNER_REQUIRED"});
      if(["agent","operator"].includes(req.user.role)&&Number(before.assigned_to_user_id)!==Number(req.user.id))throw Object.assign(new Error("Agents may prepare only tickets assigned directly to their account."),{code:"AGENT_RESOLUTION_SCOPE"});
      await client.query("UPDATE tickets SET status='Resolved',resolved_at=COALESCE(resolved_at,NOW()),closed_at=NULL,updated_at=NOW() WHERE id=$1",[ticketId]);
      await history(client,ticketId,req.user.id,"bulk_prepared_for_resolution",before.status,JSON.stringify({status:"Resolved",summary:reason,batchSize:ticketIds.length}));
      await logStatusChange(client,ticketId,req.user.id,before.status,"Resolved","resolve");
    }else if(action==="archive"){
      if(["agent","operator"].includes(req.user.role)&&Number(before.assigned_to_user_id)!==Number(req.user.id))throw Object.assign(new Error("Agents may archive only tickets assigned to their own account."),{code:"AGENT_ARCHIVE_SCOPE"});
      if(before.archived_at)throw Object.assign(new Error("Ticket is already archived."),{code:"TICKET_ALREADY_ARCHIVED"});
     await client.query("UPDATE tickets SET archived_at=NOW(),archived_by_user_id=$2,archive_reason=$3,updated_at=NOW() WHERE id=$1",[ticketId,req.user.id,reason]);
     await history(client,ticketId,req.user.id,"bulk_archived",before.status,reason);
    }else if(action==="delete"){
     if(!before.archived_at)throw Object.assign(new Error("Archive the ticket before permanent deletion."),{code:"TICKET_ARCHIVE_REQUIRED"});
     await history(client,ticketId,req.user.id,"bulk_delete_requested",JSON.stringify({ticketRef:before.ticket_ref,status:before.status}),reason);
     await client.query("DELETE FROM tickets WHERE id=$1",[ticketId]);
    }else{
     const groupId=changes.assignedGroupId===undefined?before.assigned_group_id:id(changes.assignedGroupId);
     const assigneeId=changes.assignedToUserId===undefined?before.assigned_to_user_id:id(changes.assignedToUserId);
     await validateAssignment(client,groupId,assigneeId);
     const nextStatus=changes.status===undefined?before.status:status(changes.status);
     const nextPriority=changes.priority===undefined?before.priority:priority(changes.priority);
     if(!nextStatus||!nextPriority)throw Object.assign(new Error("Invalid status or priority."),{code:"BULK_VALUE_INVALID"});
     const nextWorkspace=changes.workspace===undefined?before.workspace:text(changes.workspace,100);
     const nextDueAt=changes.dueAt===undefined?before.due_at:(changes.dueAt||null);
     await client.query(`UPDATE tickets SET priority=$1,status=$2,workspace=$3,assigned_group_id=$4,assigned_to_user_id=$5,due_at=$6,updated_at=NOW(),resolved_at=CASE WHEN $2 IN ('Resolved','Closed') THEN COALESCE(resolved_at,NOW()) ELSE NULL END,closed_at=CASE WHEN $2='Closed' THEN COALESCE(closed_at,NOW()) ELSE NULL END WHERE id=$7`,[nextPriority,nextStatus,nextWorkspace,groupId,assigneeId,nextDueAt,ticketId]);
     const after=await getTicket(ticketId,client);
     await logAssignmentChange(client,ticketId,req.user.id,before,after);
     await logStatusChange(client,ticketId,req.user.id,before.status,after.status);
     if(before.priority!==after.priority)await history(client,ticketId,req.user.id,"priority_changed",before.priority,after.priority);
     await history(client,ticketId,req.user.id,"bulk_modified",JSON.stringify({priority:before.priority,status:before.status,workspace:before.workspace,assignedGroupId:before.assigned_group_id,assignedToUserId:before.assigned_to_user_id,dueAt:before.due_at}),JSON.stringify({changes:supplied,reason:reason||null,batchSize:ticketIds.length}));
    }
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    results.push({ticketId,ok:true,action});
   }catch(error){await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`).catch(()=>{});results.push({ticketId,ok:false,code:error.code||"BULK_TICKET_FAILED",error:error.message||"Ticket action failed."});}
  }
  await client.query("COMMIT");
  const updated=results.filter(item=>item.ok).length;const failed=results.length-updated;
  return res.status(failed&&updated?207:failed?409:200).json({message:`Bulk ${action} completed: ${updated} succeeded, ${failed} failed.`,action,total:results.length,updated,failed,results});
 }catch(error){await client.query("ROLLBACK").catch(()=>{});return res.status(500).json({code:"BULK_TICKET_ERROR",error:"The bulk ticket operation could not be completed."});}
 finally{client.release();}
});

router.put("/:id",allowTicketOperations,async(req,res)=>{
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    const groupId=req.body.assignedGroupId===undefined?existing.assigned_group_id:id(req.body.assignedGroupId);
    const assigneeId=req.body.assignedToUserId===undefined?existing.assigned_to_user_id:id(req.body.assignedToUserId);
    await validateAssignment(pool,groupId,assigneeId);
    const nextStatus=req.body.status===undefined?existing.status:status(req.body.status);
    const nextPriority=req.body.priority===undefined?existing.priority:priority(req.body.priority);
    if(!nextStatus||!nextPriority)return res.status(400).json({error:"Invalid ticket status or priority."});
    const nextTitle=text(req.body.title??existing.title,180);
    const nextDescription=text(req.body.description??existing.description);
    const nextWorkspace=text(req.body.workspace??existing.workspace,100);
    const nextDueAt=req.body.dueAt===undefined?existing.due_at:req.body.dueAt||null;
    if(req.pdmSupportLimited&&(
      normaliseWorkspaceCode(existing.workspace)!=="PDM"||
      normaliseWorkspaceCode(nextWorkspace)!=="PDM"||
      Number(groupId)!==Number(req.pdmSupportGroupId)
    )){
      return res.status(403).json({code:"PDM_SUPPORT_SCOPE_LOCKED",error:"PDM Line Support members may only keep tickets in the PDM workspace and PDM Line Support group."});
    }
    await pool.query(
      `UPDATE tickets SET title=$1,description=$2,priority=$3,status=$4,workspace=$5,assigned_group_id=$6,assigned_to_user_id=$7,due_at=$8,
       resolved_at=CASE WHEN $4 IN ('Resolved','Closed') THEN COALESCE(resolved_at,NOW()) ELSE NULL END,
       closed_at=CASE WHEN $4='Closed' THEN COALESCE(closed_at,NOW()) ELSE NULL END,
       updated_at=NOW() WHERE id=$9`,
      [nextTitle,nextDescription,nextPriority,nextStatus,nextWorkspace,groupId,assigneeId,nextDueAt,req.params.id]
    );
    const ticket=await getTicket(req.params.id);
    await logAssignmentChange(pool,req.params.id,req.user.id,existing,ticket);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status);
    if(existing.priority!==ticket.priority)await history(pool,req.params.id,req.user.id,"priority_changed",existing.priority,ticket.priority);
    const fieldChanges=[];
    if(existing.title!==ticket.title)fieldChanges.push("title");
    if(existing.description!==ticket.description)fieldChanges.push("description");
    if(existing.workspace!==ticket.workspace)fieldChanges.push("workspace");
    const oldDue=existing.due_at?new Date(existing.due_at).toISOString():null;
    const newDue=ticket.due_at?new Date(ticket.due_at).toISOString():null;
    if(oldDue!==newDue)fieldChanges.push("due date");
    if(fieldChanges.length)await history(pool,req.params.id,req.user.id,"updated",null,fieldChanges.join(", "));
    if(Number(existing.assigned_to_user_id)!==Number(ticket.assigned_to_user_id)||Number(existing.assigned_group_id)!==Number(ticket.assigned_group_id)){
      setImmediate(()=>notify(ticket));
    }
    emitTicketChange(req,"updated",ticket);
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to update ticket."});
  }
});
router.post("/:id/assign",allowTicketOperations,async(req,res)=>{
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    const groupId=req.body.assignedGroupId===undefined?existing.assigned_group_id:id(req.body.assignedGroupId);
    const assigneeId=id(req.body.assignedToUserId);
    if(!groupId&&!assigneeId)return res.status(400).json({error:"Select a support group or eligible agent."});
    if(req.pdmSupportLimited&&Number(groupId)!==Number(req.pdmSupportGroupId)){
      return res.status(403).json({code:"PDM_SUPPORT_GROUP_LOCKED",error:"PDM Line Support members may only assign tickets to the PDM Line Support group."});
    }
    await validateAssignment(pool,groupId,assigneeId);
    await pool.query(`UPDATE tickets SET assigned_group_id=$1,assigned_to_user_id=$2,status='Assigned',resolved_at=NULL,closed_at=NULL,updated_at=NOW() WHERE id=$3`,[groupId,assigneeId,req.params.id]);
    const ticket=await getTicket(req.params.id);
    await logAssignmentChange(pool,req.params.id,req.user.id,existing,ticket);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status);
    setImmediate(()=>notify(ticket));
    emitTicketChange(req,"assigned",ticket);
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to assign ticket."});
  }
});
/**
 * Requester-driven assignment â€” employees may pick or change the agent on
 * their own active tickets. The group follows the agent's membership so the
 * assignment always stays valid.
 */
router.post("/:id/assign-agent",async(req,res)=>{
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    const operational=["agent","operator","manager","admin","superadmin"].includes(req.user.role);
    const pdmSupportMember=await isPdmSupportTicketUser(req.user,existing);
    if(!operational&&Number(existing.requester_id)!==Number(req.user.id)&&!pdmSupportMember){
      return res.status(403).json({error:"You may only assign agents on your own tickets."});
    }
    if(["Resolved","Closed"].includes(existing.status)){
      return res.status(400).json({error:"This ticket is already resolved. Ask IT to reopen it before reassigning."});
    }
    const assigneeId =
      id(req.body.assignedToUserId);

    let groupId =
      id(req.body.assignedGroupId);

    if (groupId === undefined) {
      groupId = existing.assigned_group_id;
    }
    if(pdmSupportMember&&Number(groupId)!==Number(await pdmSupportAccess.supportGroupId(pool))){
      return res.status(403).json({code:"PDM_SUPPORT_GROUP_LOCKED",error:"PDM Line Support members may only assign tickets to the PDM Line Support group."});
    }

    if (assigneeId) {
      const governed =
        await ticketGovernance.governedAssignment(
          pool,
          groupId,
          assigneeId
        );

      groupId = governed.groupId;
    } else if (!groupId) {
      groupId = await defaultGroup(pool);
    }

    await validateAssignment(
      pool,
      groupId,
      assigneeId
    );
    await pool.query(
      `UPDATE tickets SET assigned_group_id=$1,assigned_to_user_id=$2,
       status=CASE WHEN $2::bigint IS NOT NULL AND status IN ('Open','Pending') THEN 'Assigned' ELSE status END,
       updated_at=NOW() WHERE id=$3`,
      [groupId,assigneeId,req.params.id]
    );
    const ticket=await getTicket(req.params.id);
    await logAssignmentChange(pool,req.params.id,req.user.id,existing,ticket);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status);
    if(Number(existing.assigned_to_user_id)!==Number(ticket.assigned_to_user_id)||Number(existing.assigned_group_id)!==Number(ticket.assigned_group_id)){
      setImmediate(()=>notify(ticket));
    }
    emitTicketChange(req,"assigned",ticket);
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to assign agent."});
  }
});
router.patch("/:id/status",allowTicketOperations,async(req,res)=>{
  const next=status(req.body.status);
  if(!next)return res.status(400).json({error:"Invalid ticket status."});
  if(["Resolved","Closed"].includes(next))return res.status(409).json({code:"GOVERNED_STATUS_REQUIRED",error:"Resolve and Close must use their governed workflows."});
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    await pool.query(
      `UPDATE tickets SET status=$1,
       resolved_at=CASE WHEN $1 IN ('Resolved','Closed') THEN COALESCE(resolved_at,NOW()) ELSE NULL END,
       closed_at=CASE WHEN $1='Closed' THEN COALESCE(closed_at,NOW()) ELSE NULL END,
       updated_at=NOW() WHERE id=$2`,
      [next,req.params.id]
    );
    const ticket=await getTicket(req.params.id);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status);
    emitTicketChange(req,"status_changed",ticket);
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(500).json({error:"Failed to update ticket status."});
  }
});
router.patch("/:id/resolve",allowTicketOperations,async(req,res)=>{
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    await pool.query(`UPDATE tickets SET status='Resolved',resolved_at=COALESCE(resolved_at,NOW()),closed_at=NULL,updated_at=NOW() WHERE id=$1`,[req.params.id]);
    const ticket=await getTicket(req.params.id);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status,"resolve");
    emitTicketChange(req,"resolved",ticket);
    financeItSurveyService.triggerSurveyOnResolution(req.params.id).catch(()=>{});
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(500).json({error:"Failed to resolve ticket."});
  }
});
router.patch("/:id/close",allowTicketOperations,async(req,res)=>{
  const classification=text(req.body.classification,80);
  const reason=text(req.body.reason,1000);
  const agentClassifications=new Set(["Irrelevant","Not IT Related"]);
  if(reason.length<10)return res.status(400).json({code:"CLOSURE_REASON_REQUIRED",error:"Provide a closure reason of at least 10 characters."});
  if(["agent","operator"].includes(req.user.role)&&!agentClassifications.has(classification))return res.status(403).json({code:"AGENT_CLOSURE_CLASSIFICATION_REQUIRED",error:"Agents may close only Irrelevant or Not IT Related tickets."});
  if(!classification)return res.status(400).json({code:"CLOSURE_CLASSIFICATION_REQUIRED",error:"Select a closure classification."});
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const result=await client.query("SELECT * FROM tickets WHERE id=$1 AND archived_at IS NULL FOR UPDATE",[req.params.id]);
    const existing=result.rows[0];
    if(!existing)throw Object.assign(new Error("Ticket not found."),{status:404});
    if(["agent","operator"].includes(req.user.role)&&Number(existing.assigned_to_user_id)!==Number(req.user.id))throw Object.assign(new Error("Agents may close only tickets assigned directly to their account."),{status:403,code:"AGENT_CLOSURE_SCOPE"});
    await client.query(`UPDATE tickets SET status='Closed',resolved_at=COALESCE(resolved_at,NOW()),closed_at=NOW(),updated_at=NOW() WHERE id=$1`,[req.params.id]);
    await history(client,req.params.id,req.user.id,"governed_closed",existing.status,JSON.stringify({status:"Closed",classification,reason}));
    await logStatusChange(client,req.params.id,req.user.id,existing.status,"Closed","closed");
    await client.query("COMMIT");
    const closedTicket=await getTicket(req.params.id);
    emitTicketChange(req,"closed",closedTicket);
    financeItSurveyService.triggerSurveyOnResolution(req.params.id).catch(()=>{});
    return res.json({...decorate(closedTicket),closure:{classification,reason}});
  }catch(error){await client.query("ROLLBACK").catch(()=>{});return res.status(error.status||500).json({code:error.code||"CLOSE_FAILED",error:error.status?error.message:"Failed to close ticket."});}
  finally{client.release();}
});


router.get("/:id/escalation-targets",allowTicketOperations,async(req,res,next)=>{try{return res.json({targets:await ticketGovernance.escalationTargets(pool,req.params.id)});}catch(error){return res.status(error.status||500).json({code:error.code||"ESCALATION_TARGETS_FAILED",error:error.message});}});
router.post("/:id/escalate",allowTicketOperations,async(req,res)=>{const reason=text(req.body.reason,1000);if(reason.length<10)return res.status(400).json({code:"ESCALATION_REASON_REQUIRED",error:"Provide an escalation reason of at least 10 characters."});const client=await pool.connect();try{await client.query("BEGIN");const escalation=await ticketGovernance.escalate(client,{ticketId:req.params.id,actorId:req.user.id,targetUserId:req.body.targetUserId,targetLevel:req.body.targetLevel,reason,requestedAction:req.body.requestedAction,source:req.body.source||"helpdesk"});await history(client,req.params.id,req.user.id,"governed_escalation",null,JSON.stringify(escalation));await client.query("COMMIT");return res.status(201).json(escalation);}catch(error){await client.query("ROLLBACK").catch(()=>{});return res.status(error.status||500).json({code:error.code||"ESCALATION_FAILED",error:error.message});}finally{client.release();}});
router.patch("/:id/important",allowTicketOperations,async(req,res)=>{try{const important=req.body.important!==false;const result=await pool.query("UPDATE tickets SET is_important=$1,importance_source=$2,important_marked_at=CASE WHEN $1 THEN NOW() ELSE NULL END,important_marked_by_user_id=CASE WHEN $1 THEN $3 ELSE NULL END,updated_at=NOW() WHERE id=$4 AND status NOT IN ('Resolved','Closed') RETURNING *",[important,text(req.body.source||"manual",40),req.user.id,req.params.id]);if(!result.rowCount)return res.status(409).json({code:"IMPORTANT_FINAL_TICKET_DISABLED",error:"Important status cannot be changed on Resolved or Closed tickets."});await history(pool,req.params.id,req.user.id,"important_changed",String(!important),String(important));return res.json(decorate(result.rows[0]));}catch(error){return res.status(500).json({error:"Important status could not be updated."});}});

router.get("/:id/conversation",async(req,res)=>{try{const ticket=await getTicket(req.params.id);if(!ticket)return res.status(404).json({error:"Ticket not found."});if(!await canView(req.user,ticket))return res.status(403).json({error:"Access denied."});const internalNotesVisible=operations(req.user)||await isPdmSupportTicketUser(req.user,ticket);return res.json({ticketId:ticket.id,conversation:await ticketExperience.conversation(pool,ticket.id,internalNotesVisible),internalNotesVisible});}catch(error){return res.status(500).json({error:"Conversation could not be loaded."});}});
router.get("/:id/teams-conversation",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{try{const ticket=await getTicket(req.params.id);if(!ticket)return res.status(404).json({error:"Ticket not found."});const result=await pool.query("SELECT * FROM ticket_teams_conversations WHERE ticket_id=$1",[ticket.id]);return res.json(result.rows[0]||{ticketId:ticket.id,status:"contract_ready",liveActionPerformed:false});}catch(error){return res.status(500).json({error:"Teams conversation contract could not be loaded."});}});
router.post("/:id/teams-conversation/prepare",allowRoles("manager","admin","superadmin"),async(req,res)=>{try{const ticket=await getTicket(req.params.id);if(!ticket)return res.status(404).json({error:"Ticket not found."});if(["Resolved","Closed"].includes(ticket.status))return res.status(409).json({error:"Closed work cannot start a Teams conversation."});const result=await pool.query("INSERT INTO ticket_teams_conversations(ticket_id,status,created_by_user_id) VALUES($1,'pending_authorisation',$2) ON CONFLICT(ticket_id) DO UPDATE SET status='pending_authorisation',updated_at=NOW() RETURNING *",[ticket.id,req.user.id]);await history(pool,ticket.id,req.user.id,"teams_conversation_prepared",null,"pending_authorisation");return res.status(201).json({...result.rows[0],liveActionPerformed:false});}catch(error){return res.status(500).json({error:"Teams conversation preparation failed."});}});
router.get("/:id/survey",async(req,res)=>{try{const ticket=await getTicket(req.params.id);if(!ticket)return res.status(404).json({error:"Ticket not found."});const survey=await ticketExperience.surveyFor(pool,ticket,req.user.id);return res.json(survey);}catch(error){return res.status(error.status||500).json({code:error.code,error:error.message});}});
router.post("/:id/survey",async(req,res)=>{try{const ticket=await getTicket(req.params.id);if(!ticket)return res.status(404).json({error:"Ticket not found."});await ticketExperience.surveyFor(pool,ticket,req.user.id);const rating=Number(req.body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:"Choose a rating from 1 to 5."});const result=await pool.query("UPDATE ticket_satisfaction_surveys SET rating=$1,resolution_confirmed=$2,comments=$3,invitation_status='completed',submitted_at=NOW(),updated_at=NOW() WHERE ticket_id=$4 AND requester_user_id=$5 RETURNING *",[rating,req.body.resolutionConfirmed!==false,text(req.body.comments,2000)||null,ticket.id,req.user.id]);await history(pool,ticket.id,req.user.id,"satisfaction_survey_submitted",null,JSON.stringify({rating,resolutionConfirmed:req.body.resolutionConfirmed!==false}));return res.json(result.rows[0]);}catch(error){return res.status(error.status||500).json({code:error.code,error:error.message});}});
router.get("/:id/change-confirmations",async(req,res)=>{try{const ticket=await getTicket(req.params.id);if(!ticket)return res.status(404).json({error:"Ticket not found."});if(!await canView(req.user,ticket))return res.status(403).json({error:"Access denied."});const result=await pool.query("SELECT * FROM ticket_change_confirmations WHERE ticket_id=$1 ORDER BY created_at DESC LIMIT 100",[ticket.id]);return res.json(result.rows);}catch(error){return res.status(500).json({error:"Change confirmations could not be loaded."});}});
module.exports = router;
