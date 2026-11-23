const pool = require("../db/pool");
const crossWorkspaceAccess = require("../services/crossWorkspaceAccess");
const { normaliseWorkspaceCode } = require("../services/workspaceCodeRegistry");
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
async function requireManagerScope(req,res,next){if(["manager","workspace_manager","security_admin"].includes(req.financeAccess?.accessLevel))return next();try{const d=await pool.query(`SELECT id FROM finance_delegated_authority WHERE delegate_user_id=$1::bigint AND scope IN ('all_actions','journal_approval') AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1`,[req.user?.id]);if(d.rowCount)return next();}catch(error){if(!["42P01","42703"].includes(error.code))console.warn("Delegated authority check failed:",error.message);}return res.status(403).json({code:"FINANCE_MANAGER_SCOPE_REQUIRED",error:"Finance management authority is required."});}
function requireSecurityAdmin(req,res,next){if(req.financeAccess?.accessLevel!=="security_admin")return res.status(403).json({code:"FINANCE_SECURITY_ADMIN_REQUIRED",error:"Finance Security Administrator authority is required."});next();}
function requireHodScope(req,res,next){if(!["director","executive"].includes(req.financeAccess?.accessLevel)&&req.user?.role!=="superadmin")return res.status(403).json({code:"HOD_SCOPE_REQUIRED",error:"Head of Department authority is required."});next();}
function confidentialityAllowed(context,level){const maximum=CONFIDENTIALITY.indexOf(context.maxConfidentiality||"Internal");const requested=CONFIDENTIALITY.indexOf(level||"Internal");return requested>=0&&maximum>=requested;}
function ticketScope(req,start=1){const c=req.financeAccess;if(["workspace_manager","security_admin","auditor"].includes(c.accessLevel)){const clauses=[],params=[];if(c.allowedOffices.length){params.push(c.allowedOffices);clauses.push(`COALESCE(fo.office_code,'')=ANY($${start+params.length-1}::text[])`);}if(c.allowedFunctions.length){params.push(c.allowedFunctions);clauses.push(`COALESCE(fo.finance_function,'')=ANY($${start+params.length-1}::text[])`);}return {sql:clauses.length?`(${clauses.join(" OR ")})`:"TRUE",params};}const ids=[Number(req.user.id),...(c.reportingScope||[])];return {sql:`t.assigned_to_user_id=ANY($${start}::bigint[])`,params:[ids]};}
async function requireTicketAccess(req,res,next){try{const scope=ticketScope(req,2);const result=await pool.query(`SELECT t.id,COALESCE(fo.confidentiality_level,'Internal') confidentiality_level FROM tickets t LEFT JOIN finance_ticket_operations fo ON fo.ticket_id=t.id WHERE t.id=$1 AND t.workspace='FIN' AND ${scope.sql}`,[req.params.ticketId,...scope.params]);if(!result.rowCount||!confidentialityAllowed(req.financeAccess,result.rows[0].confidentiality_level))return res.status(403).json({code:"FINANCE_TICKET_SCOPE_DENIED",error:"This Finance record is outside the authorised scope."});next();}catch(error){next(error);}}
async function accessContext(req,res){res.json({allowed:true,source:req.financeAccess.source,accessLevel:req.financeAccess.accessLevel,officeCode:req.financeAccess.officeCode,financeFunction:req.financeAccess.financeFunction,reportingScopeCount:req.financeAccess.reportingScope.length,maxConfidentiality:req.financeAccess.maxConfidentiality,overrideExpiresAt:req.financeAccess.overrideExpiresAt});}

function resolveUserWorkspace(req) {
  if (req.user?.role === "superadmin" || req.user?.role === "system_administrator") return null;
  if (req.financeAccess || FINANCE_DEPARTMENTS.has(normalize(req.user?.department))) return "FIN";
  return normaliseWorkspaceCode(req.user?.department) || "IT";
}

async function requireCrossWorkspaceTicketAccess(req,res,next) {
  try {
    const ticketId = req.params.ticketId || req.params.id;
    if (!ticketId) return next();

    const result = await pool.query(`SELECT workspace FROM tickets WHERE id=$1`, [ticketId]);
    if (!result.rowCount) return res.status(404).json({code:"TICKET_NOT_FOUND",error:"Ticket not found."});

    const targetWorkspace = result.rows[0].workspace;
    const userWorkspace = resolveUserWorkspace(req);

    if (!userWorkspace || userWorkspace === targetWorkspace) return next();

    const exceptionCheck = await crossWorkspaceAccess.checkException(req.user.id, targetWorkspace);
    if (!exceptionCheck.allowed) {
      await audit(req, "denied", exceptionCheck.reason, {}, { ticketId, targetWorkspace, userWorkspace });
      return res.status(403).json({
        code: exceptionCheck.reason,
        error: "Cross-workspace access is not authorised for this resource."
      });
    }

    await crossWorkspaceAccess.logAccess(
      req.user.id, userWorkspace, targetWorkspace,
      "ticket", Number(ticketId), exceptionCheck.exception?.id, exceptionCheck.reason
    );
    req.crossWorkspaceException = exceptionCheck.exception;
    next();
  } catch(error) {
    if (error.code === "AUDIT_LOG_FAILURE") {
      return res.status(403).json({code:"AUDIT_LOG_FAILURE",error:"Access denied due to audit logging failure."});
    }
    next(error);
  }
}

module.exports={requireEntry,requireManagerScope,requireSecurityAdmin,requireHodScope,requireTicketAccess,requireCrossWorkspaceTicketAccess,ticketScope,confidentialityAllowed,accessContext,audit,resolveUserWorkspace,resolve};
