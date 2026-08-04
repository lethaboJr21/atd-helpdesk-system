const express = require("express");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const { sendTicketAssignmentEmail } = require("../services/email");
const { createTicketAssignmentNotifications } = require("../services/notificationService");

const router = express.Router();
router.use(auth);

const OPERATIONS_ROLES = new Set(["agent", "operator", "manager", "admin", "superadmin"]);
const STATUS_MAP = new Map([["open","Open"],["assigned","Assigned"],["pending","Pending"],["investigating","Investigating"],["waiting approval","Waiting Approval"],["resolved","Resolved"],["closed","Closed"],["escalated","Escalated"]]);
const PRIORITY_MAP = new Map([["low","Low"],["medium","Medium"],["high","High"],["critical","Critical"]]);
const TYPE_PREFIX = { incident:"INC", request:"REQ", service_request:"REQ", asset_request:"REQ", change:"CHG" };

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

async function getTicket(ticketId,database=pool){ const result=await database.query(`${TICKET_SELECT} WHERE t.id=$1 LIMIT 1`,[ticketId]); return result.rows[0]||null; }
async function history(database,ticketId,actorId,action,oldValue,newValue){ try{ await database.query(`INSERT INTO ticket_history(ticket_id,actor_user_id,action,old_value,new_value) VALUES($1,$2,$3,$4,$5)`,[ticketId,actorId||null,action,oldValue==null?null:String(oldValue),newValue==null?null:String(newValue)]); }catch(error){ if(error.code!=="42P01")console.error("Ticket history write failed:",error); } }
function assignmentLabel(ticket){
  if(!ticket)return "Unassigned";
  const agent=ticket.assigned_to_name||(ticket.assigned_to_user_id?`User #${ticket.assigned_to_user_id}`:"Unassigned");
  const group=ticket.assigned_group_name||(ticket.assigned_group_id?`Group #${ticket.assigned_group_id}`:"No group");
  return `${agent} · ${group}`;
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

  if(String(req.query.view||"").toLowerCase()==="mine"){
    add("t.assigned_to_user_id=?",req.user.id);
  }

  const baseWhere=conditions.length?`WHERE ${conditions.join(" AND ")}`:"";
  const baseValues=[...values];

  const statusRaw=String(req.query.status||"all").trim();
  const statusKey=statusRaw.toLowerCase();
  const listValues=[...values];
  const listConditions=[...conditions];
  if(statusKey&&statusKey!=="all"){
    if(statusKey==="unresolved"){
      listConditions.push(`t.status NOT IN ('Resolved','Closed')`);
    }else{
      const normalized=status(statusRaw);
      if(!normalized)return res.status(400).json({error:"Invalid status filter."});
      listValues.push(normalized);
      listConditions.push(`t.status=$${listValues.length}`);
    }
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
router.get("/:id",async(req,res)=>{try{const ticket=await getTicket(req.params.id);if(!ticket)return res.status(404).json({error:"Ticket not found."});if(!canView(req.user,ticket))return res.status(403).json({error:"You may only view tickets requested by your account."});return res.json(decorate(ticket));}catch(error){return res.status(500).json({error:"Failed to fetch the ticket."});}});

router.post("/",async(req,res)=>{
 const title=text(req.body.title,180);const description=text(req.body.description);const ticketPriority=priority(req.body.priority)||"Medium";const workspace=text(req.body.workspace||"IT",100);let groupId=id(req.body.assignedGroupId);let assigneeId=id(req.body.assignedToUserId);let requesterId=req.user.id;
 if(!title)return res.status(400).json({error:"A ticket title is required."});if(!description)return res.status(400).json({error:"A ticket description is required."});const requestedFor=id(req.body.requesterId||req.body.requestedForUserId);if(requestedFor&&requestedFor!==req.user.id){if(!operations(req.user))return res.status(403).json({error:"You are not authorised to create a ticket for another person."});requesterId=requestedFor;}
 const client=await pool.connect();let open=false;try{await client.query("BEGIN");open=true;const requester=await validRequester(client,requesterId);if(!requester){await client.query("ROLLBACK");open=false;return res.status(400).json({error:"The selected requester is not an active person account."});}
 if(!groupId)groupId=await defaultGroup(client);await validateAssignment(client,groupId,assigneeId);const duplicate=await client.query(`SELECT id,ticket_ref FROM tickets WHERE requester_id=$1 AND LOWER(title)=LOWER($2) AND created_at>NOW()-INTERVAL '30 seconds' ORDER BY created_at DESC LIMIT 1`,[requesterId,title]);if(duplicate.rows[0]){await client.query("ROLLBACK");open=false;return res.status(409).json({error:"A similar ticket was just created.",ticket:duplicate.rows[0]});}
 const sequence=await client.query(`SELECT nextval(pg_get_serial_sequence('tickets','id')) next_id`);const nextId=sequence.rows[0].next_id;const reference=`${prefix(req.body.ticketType,title,workspace)}-${String(nextId).padStart(5,"0")}`;await client.query(`INSERT INTO tickets(id,ticket_ref,title,description,requester_id,created_by_user_id,priority,status,workspace,assigned_group_id,assigned_to_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,'Open',$8,$9,$10)`,[nextId,reference,title,description,requesterId,req.user.id,ticketPriority,workspace,groupId,assigneeId]);await history(client,nextId,req.user.id,"created",null,"Open");await client.query("COMMIT");open=false;const ticket=await getTicket(nextId);setImmediate(()=>notify(ticket));return res.status(201).json(decorate(ticket));
 }catch(error){if(open)await client.query("ROLLBACK").catch(()=>{});console.error("Create ticket failed:",error);return res.status(error.status||500).json({error:error.status?error.message:"Failed to create ticket."});}finally{client.release();}
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
      `UPDATE tickets SET title=$1,description=$2,priority=$3,status=$4,workspace=$5,assigned_group_id=$6,assigned_to_user_id=$7,due_at=$8,closed_at=CASE WHEN $4='Closed' THEN COALESCE(closed_at,NOW()) WHEN $4='Resolved' THEN closed_at ELSE NULL END,updated_at=NOW() WHERE id=$9`,
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
    await pool.query(`UPDATE tickets SET assigned_group_id=$1,assigned_to_user_id=$2,status='Assigned',updated_at=NOW() WHERE id=$3`,[groupId,assigneeId,req.params.id]);
    const ticket=await getTicket(req.params.id);
    await logAssignmentChange(pool,req.params.id,req.user.id,existing,ticket);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status);
    setImmediate(()=>notify(ticket));
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(error.status||500).json({error:error.status?error.message:"Failed to assign ticket."});
  }
});
router.patch("/:id/status",allowRoles("agent","operator","manager","admin","superadmin"),async(req,res)=>{
  const next=status(req.body.status);
  if(!next)return res.status(400).json({error:"Invalid ticket status."});
  try{
    const existing=await getTicket(req.params.id);
    if(!existing)return res.status(404).json({error:"Ticket not found."});
    await pool.query(
      `UPDATE tickets SET status=$1,closed_at=CASE WHEN $1='Closed' THEN COALESCE(closed_at,NOW()) WHEN $1='Resolved' THEN closed_at ELSE NULL END,updated_at=NOW() WHERE id=$2`,
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
    await pool.query(`UPDATE tickets SET status='Resolved',updated_at=NOW() WHERE id=$1`,[req.params.id]);
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
    await pool.query(`UPDATE tickets SET status='Closed',closed_at=NOW(),updated_at=NOW() WHERE id=$1`,[req.params.id]);
    const ticket=await getTicket(req.params.id);
    await logStatusChange(pool,req.params.id,req.user.id,existing.status,ticket.status,"closed");
    return res.json(decorate(ticket));
  }catch(error){
    return res.status(500).json({error:"Failed to close ticket."});
  }
});

module.exports = router;
