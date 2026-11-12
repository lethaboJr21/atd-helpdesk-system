const pool = require("../db/pool");
const FINANCE_DEPARTMENTS = new Set(["finance", "finance department"]);
const CONFIDENTIALITY = ["Internal","Finance Restricted","Confidential","CFO Restricted","Boardroom Restricted","Payment Restricted","Employee Financial Information","Supplier Banking Information"];
const normalize = value => String(value || "").trim().toLowerCase();
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const jsonArray = value => Array.isArray(value) ? value : [];
async function audit(req, decision, reasonCode, context = {}, details = {}) {
  try { await pool.query(`INSERT INTO finance_access_decisions(user_id,endpoint,method,decision,source,access_level,department,job_title,office_code,finance_function,reporting_scope,reason_code,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb)`,[req.user?.id||null,req.originalUrl,req.method,decision,context.source||"policy",context.accessLevel||null,req.user?.department||null,context.jobTitle||null,context.officeCode||null,context.financeFunction||null,JSON.stringify(context.reportingScope||[]),reasonCode,JSON.stringify(details)]); }
  catch(error){ if(!["42P01","42703"].includes(error.code)) console.warn("Finance access audit failed:",error.message); }
}
async function reportingScope(userId) {
  const result=await pool.query(`WITH RECURSIVE reports AS (SELECT user_id FROM finance_employee_responsibilities WHERE manager_user_id=$1 AND active=TRUE UNION SELECT fr.user_id FROM finance_employee_responsibilities fr JOIN reports r ON fr.manager_user_id=r.user_id WHERE fr.active=TRUE) SELECT user_id FROM reports`,[userId]);
  return result.rows.map(row=>Number(row.user_id));
}
async function resolve(req) {
  // SCRIPT_882_GOVERNED_SUPERADMIN_FINANCE_OVERRIDE
  // Superadmin access is explicit, audited by requireEntry, and does not alter ordinary Finance eligibility.
  if (req.user?.role === "superadmin") {
    return {
      source:"governed_superadmin_override",
      accessLevel:"security_admin",
      jobTitle:req.user.job_title||"Superadmin",
      officeCode:null,
      financeFunction:null,
      managerUserId:null,
      reportingScope:[],
      allowedOffices:[],
      allowedFunctions:[],
      maxConfidentiality:"Supplier Banking Information",
      overrideExpiresAt:null
    };
  }
  const result=await pool.query(`SELECT u.id,u.job_title,u.department,u.approved,u.status,u.archived_at,u.deactivated_at,u.account_type,u.microsoft_account_enabled,fr.office_code,fr.finance_function,fr.manager_user_id,fr.is_finance_manager,fr.active finance_active,p.access_level,p.allowed_offices,p.allowed_functions,p.max_confidentiality,o.id override_id,o.access_level override_level,o.allowed_offices override_offices,o.allowed_functions override_functions,o.max_confidentiality override_confidentiality,o.expires_at override_expires_at FROM users u LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=u.id LEFT JOIN finance_approved_positions p ON p.position_key=LOWER(TRIM(COALESCE(u.job_title,''))) AND p.active=TRUE LEFT JOIN LATERAL (SELECT * FROM finance_access_overrides x WHERE x.user_id=u.id AND x.revoked_at IS NULL AND x.starts_at<=NOW() AND x.expires_at>NOW() ORDER BY x.expires_at DESC LIMIT 1) o ON TRUE WHERE u.id=$1`,[req.user.id]);
  const row=result.rows[0];
  if(!row) throw fail(403,"FINANCE_ACCOUNT_NOT_FOUND","Finance Workspace access is not currently assigned to this account.");
  const active=row.approved&&row.status==="active"&&!row.archived_at&&!row.deactivated_at&&row.account_type==="person"&&row.microsoft_account_enabled!==false;
  if(!active) throw fail(403,"FINANCE_ACCOUNT_INACTIVE","Finance Workspace access is not currently assigned to this account.");
  const override=Boolean(row.override_id);
  if(!override&&!FINANCE_DEPARTMENTS.has(normalize(row.department))) throw fail(403,"FINANCE_DEPARTMENT_REQUIRED","Finance Workspace access is restricted to verified Finance department employees.");
  if(!override&&!row.access_level) throw fail(403,"FINANCE_POSITION_NOT_APPROVED","The account position is not approved for Finance Workspace access.");
  if(!override&&!row.finance_active) throw fail(403,"FINANCE_RESPONSIBILITY_REQUIRED","An active Finance responsibility is required.");
  const accessLevel=override?row.override_level:row.access_level;
  const scope=await reportingScope(row.id);
  return {source:override?"temporary_override":"department_position_responsibility",accessLevel,jobTitle:row.job_title,officeCode:row.office_code,financeFunction:row.finance_function,managerUserId:row.manager_user_id,reportingScope:scope,allowedOffices:jsonArray(override?row.override_offices:row.allowed_offices),allowedFunctions:jsonArray(override?row.override_functions:row.allowed_functions),maxConfidentiality:override?row.override_confidentiality:row.max_confidentiality,overrideExpiresAt:row.override_expires_at||null};
}
async function requireEntry(req,res,next){try{req.financeAccess=await resolve(req);await audit(req,"allowed","FINANCE_ACCESS_ALLOWED",req.financeAccess);next();}catch(error){await audit(req,"denied",error.code||"FINANCE_ACCESS_DENIED",{},{});res.status(error.status||403).json({code:error.code||"FINANCE_ACCESS_DENIED",error:error.message||"Finance Workspace access is not currently assigned to this account."});}}
function requireManagerScope(req,res,next){if(!["manager","workspace_manager","security_admin"].includes(req.financeAccess?.accessLevel))return res.status(403).json({code:"FINANCE_MANAGER_SCOPE_REQUIRED",error:"Finance management authority is required."});next();}
function requireSecurityAdmin(req,res,next){if(req.financeAccess?.accessLevel!=="security_admin")return res.status(403).json({code:"FINANCE_SECURITY_ADMIN_REQUIRED",error:"Finance Security Administrator authority is required."});next();}
function confidentialityAllowed(context,level){const maximum=CONFIDENTIALITY.indexOf(context.maxConfidentiality||"Internal");const requested=CONFIDENTIALITY.indexOf(level||"Internal");return requested>=0&&maximum>=requested;}
function ticketScope(req,start=1){const c=req.financeAccess;if(["workspace_manager","security_admin","auditor"].includes(c.accessLevel)){const clauses=[],params=[];if(c.allowedOffices.length){params.push(c.allowedOffices);clauses.push(`COALESCE(fo.office_code,'')=ANY($${start+params.length-1}::text[])`);}if(c.allowedFunctions.length){params.push(c.allowedFunctions);clauses.push(`COALESCE(fo.finance_function,'')=ANY($${start+params.length-1}::text[])`);}return {sql:clauses.length?`(${clauses.join(" OR ")})`:"TRUE",params};}const ids=[Number(req.user.id),...(c.reportingScope||[])];return {sql:`t.assigned_to_user_id=ANY($${start}::bigint[])`,params:[ids]};}
async function requireTicketAccess(req,res,next){try{const scope=ticketScope(req,2);const result=await pool.query(`SELECT t.id,COALESCE(fo.confidentiality_level,'Internal') confidentiality_level FROM tickets t LEFT JOIN finance_ticket_operations fo ON fo.ticket_id=t.id WHERE t.id=$1 AND LOWER(COALESCE(t.workspace,'')) LIKE '%finance%' AND ${scope.sql}`,[req.params.ticketId,...scope.params]);if(!result.rowCount||!confidentialityAllowed(req.financeAccess,result.rows[0].confidentiality_level))return res.status(403).json({code:"FINANCE_TICKET_SCOPE_DENIED",error:"This Finance record is outside the authorised scope."});next();}catch(error){next(error);}}
async function accessContext(req,res){res.json({allowed:true,source:req.financeAccess.source,accessLevel:req.financeAccess.accessLevel,officeCode:req.financeAccess.officeCode,financeFunction:req.financeAccess.financeFunction,reportingScopeCount:req.financeAccess.reportingScope.length,maxConfidentiality:req.financeAccess.maxConfidentiality,overrideExpiresAt:req.financeAccess.overrideExpiresAt});}
module.exports={requireEntry,requireManagerScope,requireSecurityAdmin,requireTicketAccess,ticketScope,confidentialityAllowed,accessContext,audit};
