const express = require("express");
const fs = require("fs");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { sendTicketAssignmentEmail } = require("../services/email");
const { createTicketAssignmentNotifications } = require("../services/notificationService");
const {
  optionalAttachments,
  saveUploadedFiles,
  cleanupFiles,
  listAttachments,
  getAttachment,
  absoluteFromStored,
} = require("../services/ticketAttachments");
const { getPersonalizedModules } = require("../services/personalization");

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
function decorate(ticket){ return {...ticket,age:age(ticket.created_at),overdue:Boolean(ticket.due_at&&new Date(ticket.due_at)<new Date()&&!['Resolved','Closed'].includes(ticket.status))}; }
function prefix(typeValue,title,workspace){ const normalized=text(typeValue,50).toLowerCase().replace(/[\s-]+/g,"_"); if(TYPE_PREFIX[normalized])return TYPE_PREFIX[normalized]; const context=`${title} ${workspace}`.toLowerCase(); if(context.includes("change"))return "CHG"; if(context.includes("request")||context.includes("asset"))return "REQ"; return "INC"; }
function canView(user,ticket){ return operations(user)||Number(ticket.requester_id)===Number(user?.id); }
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
async function notify(ticket){ try{ await createTicketAssignmentNotifications({ticket,assignedGroupId:ticket.assigned_group_id,assignedToUserId:ticket.assigned_to_user_id}); }catch(error){console.error("Ticket notification failed:",error.message);} try{ const result=await pool.query(`SELECT DISTINCT u.email FROM users u WHERE u.approved=TRUE AND u.status='active' AND u.archived_at IS NULL AND COALESCE(u.account_type,'person')='person' AND (u.id=$1 OR EXISTS(SELECT 1 FROM support_group_members gm WHERE gm.user_id=u.id AND gm.group_id=$2))`,[ticket.assigned_to_user_id,ticket.assigned_group_id]); await sendTicketAssignmentEmail({recipients:result.rows.map(r=>r.email).filter(Boolean),ticket,groupName:ticket.assigned_group_name}); }catch(error){console.error("Ticket email failed:",error.message);} }

router.get("/employee-view",async(req,res)=>{ try{const result=await pool.query(`${TICKET_SELECT} WHERE t.requester_id=$1 ORDER BY ${ACTIVE_FIRST},CASE WHEN t.due_at<NOW() AND t.status NOT IN ('Resolved','Closed') THEN 0 ELSE 1 END,t.created_at DESC LIMIT 200`,[req.user.id]);return res.json(result.rows.map(decorate));}catch(error){console.error(error);return res.status(500).json({error:"Failed to fetch your tickets."});}});
router.get("/my-modules",async(req,res)=>{
  try{
    const payload=await getPersonalizedModules(req.user.id);
    return res.json(payload);
  }catch(error){
    console.error("Personalized modules failed:",error);
    return res.status(500).json({error:"Failed to load personalized modules."});
  }
});
router.get("/my-tickets",async(req,res)=>{const condition=req.user.role==='user'?`t.requester_id=$1`:`(t.requester_id=$1 OR t.assigned_to_user_id=$1 OR t.assigned_group_id IN(SELECT group_id FROM support_group_members WHERE user_id=$1))`;try{const result=await pool.query(`${TICKET_SELECT} WHERE ${condition} ORDER BY ${ACTIVE_FIRST},CASE WHEN t.due_at<NOW() AND t.status NOT IN ('Resolved','Closed') THEN 0 ELSE 1 END,t.created_at DESC LIMIT 200`,[req.user.id]);return res.json(result.rows.map(decorate));}catch(error){return res.status(500).json({error:"Failed to fetch your tickets."});}});

// Freshservice-style inbox query: filter + paginate on the server, return real
// queue counts for the full authorised set (not just the current page).
router.get("/",async(req,res)=>{
  const values=[];
  const conditions=[];
  const add=(sql,value)=>{values.push(value);conditions.push(sql.replace(/\?/g,`$${values.length}`));};

  if(req.user.role==="user")add("t.requester_id=?",req.user.id);
  else if(["agent","operator"].includes(req.user.role)){
    values.push(req.user.id);
    const i=values.length;
    conditions.push(`(t.assigned_to_user_id=$${i} OR t.assigned_to_user_id IS NULL OR t.assigned_group_id IN(SELECT group_id FROM support_group_members WHERE user_id=$${i}))`);
  }

  if(req.query.search){
    values.push(`%${text(req.query.search,200)}%`);
    const i=values.length;
    conditions.push(`(t.ticket_ref ILIKE $${i} OR t.external_id ILIKE $${i} OR t.title ILIKE $${i} OR t.description ILIKE $${i} OR t.category ILIKE $${i} OR requester.name ILIKE $${i} OR t.external_requester_name ILIKE $${i} OR t.external_requester_email ILIKE $${i} OR assignee.name ILIKE $${i} OR t.external_assignee_name ILIKE $${i} OR g.name ILIKE $${i} OR t.external_group_name ILIKE $${i})`);
  }
  const legacyView=String(req.query.view||"").toLowerCase();
  const assignmentScope=String(
    req.query.assignmentScope||req.query.assignee||req.query.scope||(legacyView==="mine"?"mine":"all")
  ).trim().toLowerCase();
  const allowedAssignmentScopes=new Set(["all","mine","unassigned","my-groups"]);
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
  }

  const baseWhere=conditions.length?`WHERE ${conditions.join(" AND ")}`:"";
  const baseValues=[...values];

  const requestedStatuses=String(req.query.statuses||req.query.status||"all")
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

  const listWhere=listConditions.length?`WHERE ${listConditions.join(" AND ")}`:"";

  const requestedLimit=Number(req.query.per_page||req.query.limit);
  const perPage=Number.isFinite(requestedLimit)?Math.min(Math.max(Math.trunc(requestedLimit),1),200):50;
  const page=Math.max(Math.trunc(Number(req.query.page)||1),1);
  const offset=(page-1)*perPage;
  const orderBy=`${ACTIVE_FIRST},CASE WHEN t.due_at<NOW() AND t.status NOT IN ('Resolved','Closed') THEN 0 ELSE 1 END,CASE t.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,t.created_at DESC`;

  try{
    const [countResult,rows,countsResult]=await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM tickets t LEFT JOIN users requester ON requester.id=t.requester_id LEFT JOIN users assignee ON assignee.id=t.assigned_to_user_id LEFT JOIN support_groups g ON g.id=t.assigned_group_id ${listWhere}`,listValues),
      pool.query(`${TICKET_SELECT} ${listWhere} ORDER BY ${orderBy} LIMIT $${listValues.length+1} OFFSET $${listValues.length+2}`,[...listValues,perPage,offset]),
      pool.query(
        `SELECT
           COUNT(*)::int AS all_count,
           COUNT(*) FILTER (WHERE t.status NOT IN ('Resolved','Closed'))::int AS unresolved,
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
        baseValues
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
router.get("/:id/history",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
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
router.get("/:id/comments",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
    const ops=operations(req.user);
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
    if(!canView(req.user,ticket))return res.status(403).json({error:"You may only comment on tickets you can view."});
    const ops=operations(req.user);
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

router.get("/:id",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
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
  const ticketPriority=priority(req.body.priority)||"Medium";
  const workspace=text(req.body.workspace||"IT",100);
  const ticketType=text(req.body.ticketType,50).toLowerCase().replace(/[\s-]+/g,"_")||null;
  const category=text(req.body.category,120)||null;
  const subCategory=text(req.body.subCategory||req.body.sub_category,120)||null;
  const itemCategory=text(req.body.itemCategory||req.body.item_category,120)||null;
  const impact=level(req.body.impact,["Low","Medium","High"]);
  const urgency=level(req.body.urgency,["Low","Medium","High"]);
  const source=text(req.body.source,50)||"Portal";
  const details=parseDetails(req.body.requestDetails||req.body.request_details);
  let groupId=id(req.body.assignedGroupId);
  let assigneeId=id(req.body.assignedToUserId);
  let requesterId=req.user.id;

  if(!title){ cleanupFiles(files); return res.status(400).json({error:"A ticket title is required."}); }
  if(!description){ cleanupFiles(files); return res.status(400).json({error:"A ticket description is required."}); }

  const requestedFor=id(req.body.requesterId||req.body.requestedForUserId);
  if(requestedFor&&requestedFor!==req.user.id){
    if(!operations(req.user)){ cleanupFiles(files); return res.status(403).json({error:"You are not authorised to create a ticket for another person."}); }
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
    const requester=await validRequester(client,requesterId);
    if(!requester){
      await client.query("ROLLBACK"); open=false; cleanupFiles(files);
      return res.status(400).json({error:"The selected requester is not an active person account."});
    }
    if(!groupId)groupId=await defaultGroup(client);
    await validateAssignment(client,groupId,assigneeId);
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
         impact,urgency,source,request_details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)`,
      [
        nextId,reference,title,description,requesterId,req.user.id,ticketPriority,openStatus,workspace,
        groupId,assigneeId,ticketType,category,subCategory,itemCategory,
        impact,urgency,source,JSON.stringify(details),
      ]
    );

    const attachments=await saveUploadedFiles(client,nextId,req.user.id,files);
    if(attachments.length){
      await history(client,nextId,req.user.id,"attachment_added",null,`${attachments.length} file(s)`);
    }
    await history(client,nextId,req.user.id,"created",null,openStatus);
    if(openStatus==="Waiting Approval"){
      await history(client,nextId,req.user.id,"approval_required",null,details.changeType||"Change");
    }

    await client.query("COMMIT");
    open=false;
    const ticket=await getTicket(nextId);
    setImmediate(()=>notify(ticket));
    return res.status(201).json({...decorate(ticket),attachments});
  }catch(error){
    if(open)await client.query("ROLLBACK").catch(()=>{});
    cleanupFiles(files);
    console.error("Create ticket failed:",error);
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to create ticket."});
  }finally{
    client.release();
  }
});

router.get("/:id/attachments",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});
    return res.json(await listAttachments(pool,ticket.id));
  }catch(error){
    return res.status(500).json({error:"Failed to list attachments."});
  }
});

router.get("/:id/attachments/:attachmentId/download",async(req,res)=>{
  try{
    const ticket=await getTicket(req.params.id);
    if(!ticket)return res.status(404).json({error:"Ticket not found."});
    if(!canView(req.user,ticket))return res.status(403).json({error:"You may only download attachments from your own tickets."});

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
    if(!canView(req.user,ticket)){ cleanupFiles(files); return res.status(403).json({error:"You may only attach files to your own tickets."}); }
    if(!files.length)return res.status(400).json({error:"Choose at least one file to upload."});

    const saved=await saveUploadedFiles(pool,ticket.id,req.user.id,files);
    await history(pool,ticket.id,req.user.id,"attachment_added",null,`${saved.length} file(s)`);
    return res.status(201).json(saved);
  }catch(error){
    cleanupFiles(files);
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to upload attachments."});
  }
});

router.put("/:id",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
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
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to update ticket."});
  }
});
router.post("/:id/assign",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    const groupId=req.body.assignedGroupId===undefined?existing.assigned_group_id:id(req.body.assignedGroupId);
    const assigneeId=id(req.body.assignedToUserId);
    if(!groupId&&!assigneeId)return res.status(400).json({error:"Select a support group or eligible agent."});
    await validateAssignment(pool,groupId,assigneeId);
    await pool.query(`UPDATE tickets SET assigned_group_id=$1,assigned_to_user_id=$2,status='Assigned',resolved_at=NULL,closed_at=NULL,updated_at=NOW() WHERE id=$3`,[groupId,assigneeId,req.params.id]);
    const ticket=await getTicket(req.params.id);
    await logAssignmentChange(pool,req.params.id,req.user.id,existing,ticket);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status);
    setImmediate(()=>notify(ticket));
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
    if(!operational&&Number(existing.requester_id)!==Number(req.user.id)){
      return res.status(403).json({error:"You may only assign agents on your own tickets."});
    }
    if(["Resolved","Closed"].includes(existing.status)){
      return res.status(400).json({error:"This ticket is already resolved. Ask IT to reopen it before reassigning."});
    }
    const assigneeId=id(req.body.assignedToUserId);
    let groupId=existing.assigned_group_id;
    if(assigneeId){
      const membership=await pool.query(
        `SELECT gm.group_id FROM support_group_members gm
          JOIN support_groups g ON g.id=gm.group_id AND COALESCE(g.is_active,TRUE)=TRUE
         WHERE gm.user_id=$1 ORDER BY gm.group_id`,
        [assigneeId]
      );
      const groupIds=membership.rows.map((row)=>Number(row.group_id));
      if(groupIds.length&&!groupIds.includes(Number(groupId)))groupId=groupIds[0];
      if(!groupId&&groupIds.length)groupId=groupIds[0];
    }
    if(!groupId)groupId=await defaultGroup(pool);
    await validateAssignment(pool,groupId,assigneeId);
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
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to assign agent."});
  }
});
router.patch("/:id/status",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
  const next=status(req.body.status);
  if(!next)return res.status(400).json({error:"Invalid ticket status."});
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
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(500).json({error:"Failed to update ticket status."});
  }
});
router.patch("/:id/resolve",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    await pool.query(`UPDATE tickets SET status='Resolved',resolved_at=COALESCE(resolved_at,NOW()),closed_at=NULL,updated_at=NOW() WHERE id=$1`,[req.params.id]);
    const ticket=await getTicket(req.params.id);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status,"resolve");
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(500).json({error:"Failed to resolve ticket."});
  }
});
router.patch("/:id/close",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    await pool.query(`UPDATE tickets SET status='Closed',resolved_at=COALESCE(resolved_at,NOW()),closed_at=NOW(),updated_at=NOW() WHERE id=$1`,[req.params.id]);
    const ticket=await getTicket(req.params.id);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status,"closed");
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(500).json({error:"Failed to close ticket."});
  }
});

module.exports = router;
