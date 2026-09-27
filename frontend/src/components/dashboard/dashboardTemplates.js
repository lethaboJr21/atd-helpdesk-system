export const DASHBOARD_WIDGETS = Object.freeze({
  supportActions:{id:"supportActions",label:"Support actions",description:"Approvals and self-service solutions."},
  requestModules:{id:"requestModules",label:"Request modules",description:"Incident, service, asset, change and project entry points."},
  quickLinks:{id:"quickLinks",label:"Quick links",description:"Frequently used guided support shortcuts."},
  myWork:{id:"myWork",label:"My work",description:"Open work, approvals, assets and alerts."},
  recentTickets:{id:"recentTickets",label:"Recent tickets",description:"The latest tickets available to the signed-in person."},
  assignedAssets:{id:"assignedAssets",label:"Assigned assets",description:"Equipment currently assigned to the signed-in person."},
  participatedTickets:{id:"participatedTickets",label:"Someone else's tickets",description:"Tickets where the signed-in person has scoped participation."},
  pinnedActions:{id:"pinnedActions",label:"Favourites",description:"Favourite request and support shortcuts you can remove or restore."},
});
const ROLES=["user","hod","agent","operator","manager","admin","superadmin"];
const ALL=Object.freeze(Object.keys(DASHBOARD_WIDGETS));
const preview=(accent,secondary,blocks)=>({accent,secondary,blocks});
export const DASHBOARD_TEMPLATES=Object.freeze({
 employee:{id:"employee",label:"Employee Self-Service",description:"Balanced support, requests, tickets and equipment visibility.",roles:ROLES,experience:"employee",route:"/employee",widgets:ALL,preview:preview("#2563eb","#22d3ee",["hero","actions","requests","tickets"])},
 employeeFocused:{id:"employeeFocused",label:"My Work Focus",description:"Prioritises actions, active work and recent tickets.",roles:ROLES,experience:"employee",route:"/employee",widgets:["supportActions","pinnedActions","myWork","recentTickets","quickLinks"],preview:preview("#7c3aed","#ec4899",["hero","work","tickets"])},
 quickSupport:{id:"quickSupport",label:"Quick Support",description:"Fast access to support and favourite shortcuts.",roles:ROLES,experience:"employee",route:"/employee",widgets:["supportActions","pinnedActions","requestModules","quickLinks"],preview:preview("#0891b2","#14b8a6",["hero","actions","links"])},
 equipment:{id:"equipment",label:"My Equipment",description:"Centres assigned equipment and current work.",roles:ROLES,experience:"employee",route:"/employee",widgets:["assignedAssets","pinnedActions","myWork","recentTickets"],preview:preview("#16a34a","#84cc16",["hero","assets","work"])},
 knowledgeFirst:{id:"knowledgeFirst",label:"Knowledge First",description:"Promotes self-service solutions before raising a request.",roles:ROLES,experience:"employee",route:"/employee",widgets:["supportActions","quickLinks","pinnedActions","recentTickets"],preview:preview("#d97706","#facc15",["hero","knowledge","tickets"])},
 minimal:{id:"minimal",label:"Minimal Home",description:"A calm lightweight home for requests and current work.",roles:ROLES,experience:"employee",route:"/employee",widgets:["pinnedActions","requestModules","myWork"],preview:preview("#475569","#94a3b8",["hero","requests"])},
 operations:{id:"operations",label:"Helpdesk Operations",description:"Operational ticket, SLA and alert monitoring.",roles:ROLES.slice(1),experience:"operations",route:"/",widgets:[],preview:preview("#1d4ed8","#f97316",["metrics","chart","tickets"])},
 manager:{id:"manager",label:"Manager Overview",description:"Department, service performance, approvals and escalation oversight.",roles:["manager"],experience:"management",route:"/",widgets:[],preview:preview("#6d28d9","#0ea5e9",["metrics","chart","teams"])},
 admin:{id:"admin",label:"Administration Overview",description:"Users, groups, directory, communications and system governance.",roles:["admin"],experience:"administration",route:"/admin",widgets:[],preview:preview("#0f766e","#2563eb",["users","groups","health"])},
 superadmin:{id:"superadmin",label:"Platform Governance",description:"Global audited governance, emergency controls and platform health.",roles:["superadmin"],experience:"governance",route:"/admin",widgets:[],preview:preview("#991b1b","#7c3aed",["governance","audit","health"])},
 assets:{id:"assets",label:"Assets and CMDB",description:"Asset inventory and ownership workspace.",roles:ROLES.slice(1),experience:"operations",route:"/assets",widgets:[],preview:preview("#047857","#06b6d4",["metrics","assets","owners"])},
 projects:{id:"projects",label:"Projects and Tasks",description:"Separate Project Management experience coming later.",roles:ROLES.slice(1),experience:"operations",route:"/projects",widgets:[],available:false,preview:preview("#64748b","#94a3b8",["disabled"])},
});
export const DEFAULT_EMPLOYEE_TEMPLATE_ID="employee";
export function availableDashboardTemplates(role,experience){return Object.values(DASHBOARD_TEMPLATES).filter(t=>t.roles.includes(role)&&(!experience||t.experience===experience)&&t.available!==false);}
export function dashboardTemplateById(id){return DASHBOARD_TEMPLATES[id]||DASHBOARD_TEMPLATES.employee;}
export function employeeWidgetIds(){return [...ALL];}
