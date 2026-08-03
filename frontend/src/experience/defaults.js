export const EXPERIENCE_TEMPLATES = [
  { key: "service_hub", name: "Service Hub" },
  { key: "guided_assistant", name: "Guided Assistant" },
  { key: "application_launcher", name: "Application Launcher" },
  { key: "hybrid_hub", name: "Hybrid Employee Hub", recommended: true },
  { key: "minimal", name: "Minimal" },
];
export const BACKGROUNDS = ["clean_light","clean_dark","aurora_blue","connected_systems","digital_factory","soft_gradient","minimal"];
export const SIDEBAR_MODES = ["expanded","compact","floating"];
export const DEFAULT_EXPERIENCE = { template:"hybrid_hub", background:"clean_light", sidebarMode:"expanded", widgets:["employee_welcome","service_search","common_requests","my_requests","service_status","knowledge_suggestions","my_devices","support_contacts"] };
