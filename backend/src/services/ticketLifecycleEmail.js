const pool = require("../db/pool");
const { sendMailSafe } = require("./email");
const PORTAL = String(process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk").replace(/\/$/, "");
function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
function ref(ticket){return ticket?.ticket_ref||`TICKET-${ticket?.id}`;}
function when(value){if(!value)return "Not set";try{return new Date(value).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg"});}catch{return String(value);}}
function category(ticket){return [ticket?.category,ticket?.sub_category,ticket?.item_category].filter(Boolean).join(" / ")||"Not classified";}
function detailRows(ticket){return [
  ["Requester",ticket?.requester_name||ticket?.requester_email||"Unknown"],
  ["Priority",ticket?.priority||"Medium"],["Status",ticket?.status||"Open"],
  ["Classification",category(ticket)],["Support group",ticket?.assigned_group_name||"Not available"],
  ["Proposed assignee",ticket?.assigned_to_name||"Not available"],
  ["First response due",when(ticket?.response_due_at)],["Resolution due",when(ticket?.due_at)]
];}
function table(rows){return `<table style="border-collapse:collapse;margin:16px 0">${rows.map(([a,b])=>`<tr><td style="padding:7px 12px;color:#64748b">${esc(a)}</td><td style="padding:7px 12px;font-weight:600">${esc(b)}</td></tr>`).join("")}</table>`;}
function plain(rows){return rows.map(([a,b])=>`${a}: ${b}`).join("\n");}
async function recipientsForGroup(groupId,exclude=[]){if(!groupId)return[];const result=await pool.query(`SELECT DISTINCT LOWER(u.email) email FROM support_group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1 AND u.approved=TRUE AND u.status='active' AND u.archived_at IS NULL AND COALESCE(u.account_type,'person')='person' AND u.email IS NOT NULL`,[groupId]);const blocked=new Set(exclude.filter(Boolean).map(v=>String(v).toLowerCase()));return result.rows.map(r=>r.email).filter(v=>v&&!blocked.has(v));}
async function userEmail(userId){if(!userId)return null;const result=await pool.query(`SELECT LOWER(email) email FROM users WHERE id=$1 AND approved=TRUE AND status='active' AND archived_at IS NULL`,[userId]);return result.rows[0]?.email||null;}
async function deliver({to,category:eventCategory,subject,ticket,intro,actionLabel="Open Ticket"}){const rows=detailRows(ticket);const url=`${PORTAL}/tickets/${ticket.id}`;return sendMailSafe({to,category:eventCategory,subject,html:`<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><p>${esc(intro)}</p><h2>${esc(ref(ticket))}</h2><p><strong>${esc(ticket.title||"Untitled ticket")}</strong></p>${table(rows)}<p><a href="${url}" style="background:#172b57;color:white;padding:10px 16px;text-decoration:none;border-radius:8px">${esc(actionLabel)}</a></p></div>`,text:`${intro}\n\n${ref(ticket)}\n${ticket.title||""}\n\n${plain(rows)}\n\n${url}`});}
async function sendTicketCreatedLifecycle({ticket,requester,attachmentCount=0}){
 const requesterEmail=requester?.email||ticket.requester_email;const group=await recipientsForGroup(ticket.assigned_group_id,[requesterEmail,ticket.assigned_to_email]);const results=[];
 results.push({audience:"requester",result:await deliver({to:requesterEmail,category:"ticket_created",subject:`[${ref(ticket)}] Request received`,ticket,intro:`Your request was created successfully. Attachments: ${Number(attachmentCount)||0}.`})});
 if(group.length)results.push({audience:"support_group",result:await deliver({to:group,category:"ticket_assignment",subject:`[${ref(ticket)}] New ${ticket.priority||"Medium"} priority ticket`,ticket,intro:"A new ticket entered your Support Group queue.",actionLabel:"Open Group Ticket"})});
 if(ticket.assigned_to_email)results.push({audience:"proposed_assignee",result:await deliver({to:ticket.assigned_to_email,category:"assignment_proposed",subject:`[${ref(ticket)}] Assignment proposed, action required`,ticket,intro:"This assignment is proposed only. Select Accept and Action in ATD Helpdesk to take ownership.",actionLabel:"Review Assignment"})});
 return results;
}
async function sendAssignmentProposedLifecycle({ticket,proposedAssigneeUserId,groupId}){const assignee=await userEmail(proposedAssigneeUserId);const group=await recipientsForGroup(groupId,[assignee]);const results=[];if(assignee)results.push({audience:"proposed_assignee",result:await deliver({to:assignee,category:"assignment_proposed",subject:`[${ref(ticket)}] Assignment proposed, action required`,ticket,intro:"You are the proposed assignee. Ownership starts only after you select Accept and Action.",actionLabel:"Accept or Redirect"})});if(group.length)results.push({audience:"support_group",result:await deliver({to:group,category:"ticket_assignment",subject:`[${ref(ticket)}] Ticket in Support Group queue`,ticket,intro:"A ticket entered or changed within your Support Group queue."})});return results;}
async function sendAssignmentAcceptedLifecycle({ticket}){const requester=ticket.requester_email;const assignee=ticket.assigned_to_email||await userEmail(ticket.assigned_to_user_id);const results=[];if(requester)results.push({audience:"requester",result:await deliver({to:requester,category:"assignment_accepted",subject:`[${ref(ticket)}] Assignment accepted`,ticket,intro:`${ticket.assigned_to_name||"An IT agent"} accepted your ticket for action.`})});if(assignee)results.push({audience:"accepted_owner",result:await deliver({to:assignee,category:"assignment_accepted",subject:`[${ref(ticket)}] Ownership accepted`,ticket,intro:"You accepted ownership of this ticket. The SLA deadlines remain active."})});return results;}
module.exports={sendTicketCreatedLifecycle,sendAssignmentProposedLifecycle,sendAssignmentAcceptedLifecycle};
