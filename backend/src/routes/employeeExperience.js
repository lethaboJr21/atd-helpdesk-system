const express = require("express");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

const TEMPLATES = ["employee","employeeFocused","quickSupport","equipment","knowledgeFirst","minimal"];
const THEMES = ["light","dark","system"];
const APPEARANCE_STYLES = ["solid","two-color","gradient","glass"];
const APPEARANCE_ACCENTS = ["atd-blue","slate","cyan","teal","sky","violet","rose","amber","green"];
const MONITOR_VIEWS = ["list","kanban"];
const WIDGETS = ["supportActions","requestModules","pinnedActions","quickLinks","myWork","recentTickets","assignedAssets"];
const ACTIONS = [
  "incident","service","asset","change","project","knowledge","my_tickets","my_assets",
  "syspro_issue","qmuzik_issue","laptop_issue","printer_issue","syspro_catalog","qmuzik_catalog"
];
const FEATURE_BY_ACTION = {
  incident:"report_incident", service:"request_service", asset:"request_asset",
  change:"request_change", project:"employee_dashboard", knowledge:"knowledge",
  my_tickets:"my_tickets", my_assets:"my_assets", syspro_issue:"report_incident",
  qmuzik_issue:"report_incident", laptop_issue:"report_incident", printer_issue:"report_incident",
  syspro_catalog:"request_service", qmuzik_catalog:"request_service"
};
const ACTION_DETAILS = {
  incident:{label:"Report an Incident",description:"Report something broken, unavailable or working incorrectly.",path:"/incidents/new"},
  service:{label:"Request a Service",description:"Browse IT services and submit a standard request.",path:"/services"},
  asset:{label:"Request an Asset",description:"Request new, replacement or temporary equipment.",path:"/request-asset"},
  change:{label:"Request a Change",description:"Submit a planned change for assessment and scheduling.",path:"/changes/new"},
  project:{label:"Create a Project",description:"Start a structured project with objectives and deliverables.",path:"/projects/new"},
  knowledge:{label:"Browse Solutions",description:"Find policies, FAQs and self-help guidance.",path:"/knowledge"},
  my_tickets:{label:"My Open Tickets",description:"Track requests and support work raised for you.",path:"/tickets?view=mine"},
  my_assets:{label:"My Assets",description:"Review equipment currently assigned to you.",path:"/assets"},
  syspro_issue:{label:"Syspro Issue",description:"Report a Syspro access or application problem.",path:"/incidents/new?title=Syspro%20issue&category=Application%20Software&subCategory=Syspro"},
  qmuzik_issue:{label:"QMuzik Issue",description:"Report QMuzik access, connection or transaction problems.",path:"/incidents/new?title=QMuzik%20issue&category=Application%20Software&subCategory=QMuzik"},
  laptop_issue:{label:"Laptop or PC Issue",description:"Report a laptop or desktop problem.",path:"/incidents/new?title=Laptop%20%2F%20PC%20issue&category=Hardware%20%2FEquipment&subCategory=Laptop%20%2F%20Computer"},
  printer_issue:{label:"Printer or Scanner Issue",description:"Report printing, scanner or connection problems.",path:"/incidents/new?title=Printer%20issue&category=Hardware%20%2FEquipment&subCategory=Office%20Printers"},
  syspro_catalog:{label:"Syspro Support",description:"Open the Syspro service catalogue.",path:"/services?category=atd-syspro"},
  qmuzik_catalog:{label:"QMuzik Support",description:"Open the QMuzik service catalogue.",path:"/services?category=atd-qmuzik"}
};

function array(value, fallback=[]) { return Array.isArray(value) ? value : fallback; }
function allowed(values, allowlist) { return [...new Set(array(values).filter((value) => allowlist.includes(value)))]; }
function error(status,message,code) { const value=new Error(message); value.status=status; value.code=code; return value; }
async function getMode(database=pool) {
  const result=await database.query("SELECT setting_value FROM system_settings WHERE setting_key='onboarding.enforcement_mode'");
  const mode=result.rows[0]?.setting_value;
  return ["disabled","preview","enforced"].includes(mode) ? mode : "disabled";
}
async function getPolicy(database=pool) {
  const result=await database.query(`SELECT * FROM employee_experience_settings WHERE is_active=TRUE ORDER BY CASE setting_scope WHEN 'user' THEN 5 WHEN 'group' THEN 4 WHEN 'role' THEN 3 WHEN 'department' THEN 2 ELSE 1 END DESC, priority DESC, created_at DESC`);
  const organisation=result.rows.find((row)=>row.setting_scope==="organisation") || {};
  const nav=organisation.navigation_policy || {};
  return {
    defaultTemplate:TEMPLATES.includes(organisation.default_template)?organisation.default_template:"employee",
    allowedTemplates:allowed(organisation.allowed_templates,TEMPLATES).length?allowed(organisation.allowed_templates,TEMPLATES):TEMPLATES,
    allowedThemes:allowed(organisation.appearance_policy?.allowedThemes,THEMES).length?allowed(organisation.appearance_policy.allowedThemes,THEMES):THEMES,
    defaultTheme:THEMES.includes(organisation.appearance_policy?.defaultTheme)?organisation.appearance_policy.defaultTheme:"system",
    allowedWidgets:allowed(organisation.widget_policy?.allowed,WIDGETS).length?allowed(organisation.widget_policy.allowed,WIDGETS):WIDGETS,
    requiredWidgets:allowed(organisation.widget_policy?.required,WIDGETS),
    allowedActions:allowed(nav.allowedActions,ACTIONS).length?allowed(nav.allowedActions,ACTIONS):ACTIONS,
    requiredActions:allowed(nav.requiredActions,ACTIONS),
    defaultActions:allowed(nav.defaultActions,ACTIONS),
    maxActions:Math.min(Math.max(Number(nav.maxActions)||8,1),12),
    onboardingRequired:nav.onboardingRequired!==false,
    onboardingVersion:Math.max(Number(nav.onboardingVersion)||1,1)
  };
}
async function getPreference(userId,database=pool) {
  const result=await database.query("SELECT * FROM employee_landing_preferences WHERE user_id=$1 LIMIT 1",[userId]);
  return result.rows[0] || null;
}
function permittedActions(request,policy) {
  const features=request.user.features || {};
  return policy.allowedActions.filter((id)=>features[FEATURE_BY_ACTION[id]]!==false).map((id)=>({id,...ACTION_DETAILS[id]}));
}
function onboardingEligibility(user) {
  if (!user?.approved) return { eligible:false, reason:"account_not_approved" };
  if (user?.status !== "active" || user?.deactivated_at) return { eligible:false, reason:"account_inactive" };
  if (user?.archived_at) return { eligible:false, reason:"account_archived" };
  if (user?.microsoft_account_enabled === false) return { eligible:false, reason:"microsoft_account_disabled" };
  if (String(user?.account_type || "person").toLowerCase() !== "person") return { eligible:false, reason:"non_person_account" };
  return { eligible:true, reason:null };
}
async function state(request,database=pool) {
  const [mode,policy,preference]=await Promise.all([getMode(database),getPolicy(database),getPreference(request.user.id,database)]);
  const actions=permittedActions(request,policy);
  const actionIds=new Set(actions.map((item)=>item.id));
  const selected=allowed(preference?.selected_action_ids,policy.allowedActions).filter((id)=>actionIds.has(id));
  const eligibility=onboardingEligibility(request.user);
  const completed=preference?.onboarding_status==="completed" && Number(preference?.onboarding_version)===policy.onboardingVersion;
  const required=eligibility.eligible && mode==="enforced" && policy.onboardingRequired && !completed;
  const previewRequired=eligibility.eligible && mode==="preview" && policy.onboardingRequired && !completed;
  return {mode,required,previewRequired,completed,eligible:eligibility.eligible,exemptionReason:eligibility.reason,policy,actions,preference:preference?{
    selectedTemplate:preference.selected_template,
    theme:preference.theme,
    appearanceStyle:preference.appearance_style || "solid",
    appearanceAccent:preference.appearance_accent || "atd-blue",
    monitorView:preference.monitor_view || "list",
    visibleWidgets:array(preference.widget_layout?.visibleWidgets),
    selectedActionIds:selected,
    onboardingStatus:preference.onboarding_status,
    onboardingCompletedAt:preference.onboarding_completed_at,
    onboardingVersion:preference.onboarding_version
  }:null};
}
function validate(body,policy,actionIds) {
  const selectedTemplate=String(body.selectedTemplate||"");
  const theme=String(body.theme||"");
  const appearanceStyle=String(body.appearanceStyle||"solid");
  const appearanceAccent=String(body.appearanceAccent||"atd-blue");
  const visibleWidgets=allowed(body.visibleWidgets,policy.allowedWidgets);
  let selectedActionIds=allowed(body.selectedActionIds,policy.allowedActions).filter((id)=>actionIds.has(id));
  if (!policy.allowedTemplates.includes(selectedTemplate)) throw error(400,"Select an available dashboard template.","INVALID_TEMPLATE");
  if (!policy.allowedThemes.includes(theme)) throw error(400,"Select an available theme.","INVALID_THEME");
  if (!APPEARANCE_STYLES.includes(appearanceStyle)) throw error(400,"Select an available appearance style.","INVALID_APPEARANCE_STYLE");
  if (!APPEARANCE_ACCENTS.includes(appearanceAccent)) throw error(400,"Select an available accent palette.","INVALID_APPEARANCE_ACCENT");
  for (const required of policy.requiredWidgets) if (!visibleWidgets.includes(required)) visibleWidgets.push(required);
  if (!visibleWidgets.length) throw error(400,"Select at least one dashboard widget.","WIDGET_REQUIRED");
  for (const required of policy.requiredActions) if (actionIds.has(required)&&!selectedActionIds.includes(required)) selectedActionIds.push(required);
  if (!selectedActionIds.length) throw error(400,"Select at least one dashboard action.","ACTION_REQUIRED");
  if (selectedActionIds.length>policy.maxActions) throw error(400,`Select no more than ${policy.maxActions} dashboard actions.`,"ACTION_LIMIT");
  return {selectedTemplate,theme,appearanceStyle,appearanceAccent,visibleWidgets,selectedActionIds};
}
router.get("/current",async(request,response,next)=>{try{return response.json(await state(request));}catch(e){return next(e);}});
router.put("/monitor-view",async(request,response,next)=>{try{const monitorView=String(request.body?.monitorView||"");if(!MONITOR_VIEWS.includes(monitorView))throw error(400,"Select List or Kanban.","INVALID_MONITOR_VIEW");await pool.query(`INSERT INTO employee_landing_preferences(user_id,monitor_view,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET monitor_view=EXCLUDED.monitor_view,updated_at=NOW()`,[request.user.id,monitorView]);return response.json({monitorView});}catch(e){return next(e);}});
router.put("/preferences",async(request,response,next)=>{
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const policy=await getPolicy(client); const actions=permittedActions(request,policy); const ids=new Set(actions.map((item)=>item.id));
    const value=validate(request.body||{},policy,ids);
    await client.query(`INSERT INTO employee_landing_preferences(user_id,selected_template,theme,appearance_style,appearance_accent,widget_layout,selected_action_ids,onboarding_status,onboarding_version,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,'in_progress',$8,NOW()) ON CONFLICT(user_id) DO UPDATE SET selected_template=EXCLUDED.selected_template,theme=EXCLUDED.theme,appearance_style=EXCLUDED.appearance_style,appearance_accent=EXCLUDED.appearance_accent,widget_layout=EXCLUDED.widget_layout,selected_action_ids=EXCLUDED.selected_action_ids,onboarding_status=CASE WHEN employee_landing_preferences.onboarding_status='completed' THEN 'completed' ELSE 'in_progress' END,onboarding_version=EXCLUDED.onboarding_version,updated_at=NOW()`,[request.user.id,value.selectedTemplate,value.theme,value.appearanceStyle,value.appearanceAccent,JSON.stringify({visibleWidgets:value.visibleWidgets}),JSON.stringify(value.selectedActionIds),policy.onboardingVersion]);
    await client.query("COMMIT"); return response.json(await state(request));
  } catch(e) { await client.query("ROLLBACK").catch(()=>{}); return next(e); } finally { client.release(); }
});
router.post("/complete",async(request,response,next)=>{
  const eligibility=onboardingEligibility(request.user);
  if (!eligibility.eligible) return next(error(403,"This account is exempt from employee onboarding.","ONBOARDING_ACCOUNT_EXEMPT"));
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const policy=await getPolicy(client); const actions=permittedActions(request,policy); const ids=new Set(actions.map((item)=>item.id)); const value=validate(request.body||{},policy,ids);
    await client.query(`INSERT INTO employee_landing_preferences(user_id,selected_template,theme,appearance_style,appearance_accent,widget_layout,selected_action_ids,onboarding_status,onboarding_completed_at,onboarding_version,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,'completed',NOW(),$8,NOW()) ON CONFLICT(user_id) DO UPDATE SET selected_template=EXCLUDED.selected_template,theme=EXCLUDED.theme,appearance_style=EXCLUDED.appearance_style,appearance_accent=EXCLUDED.appearance_accent,widget_layout=EXCLUDED.widget_layout,selected_action_ids=EXCLUDED.selected_action_ids,onboarding_status='completed',onboarding_completed_at=NOW(),onboarding_version=EXCLUDED.onboarding_version,updated_at=NOW()`,[request.user.id,value.selectedTemplate,value.theme,value.appearanceStyle,value.appearanceAccent,JSON.stringify({visibleWidgets:value.visibleWidgets}),JSON.stringify(value.selectedActionIds),policy.onboardingVersion]);
    await client.query(`INSERT INTO administration_audit_log(actor_user_id,target_user_id,action,new_value,details) VALUES($1,$1,'employee_onboarding_completed',$2::jsonb,$3::jsonb)`,[request.user.id,JSON.stringify(value),JSON.stringify({onboardingVersion:policy.onboardingVersion})]);
    await client.query("COMMIT"); return response.json({message:"Dashboard setup completed.",...(await state(request))});
  } catch(e) { await client.query("ROLLBACK").catch(()=>{}); return next(e); } finally { client.release(); }
});
router.use((err,request,response,next)=>{if(response.headersSent)return next(err);console.error("Employee Experience API failed:",{message:err.message,code:err.code||null});return response.status(err.status||500).json({code:err.code||"EMPLOYEE_EXPERIENCE_ERROR",error:err.status?err.message:"Employee experience settings could not be processed."});});
module.exports=router;
