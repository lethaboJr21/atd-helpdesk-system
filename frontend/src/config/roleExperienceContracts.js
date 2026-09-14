export const ROLE_EXPERIENCE_CONTRACTS = Object.freeze({
  user: { role: "user", label: "Employee", experience: "employee", homeRoute: "/employee", dashboardTemplate: "employee", workspaceScope: "own-and-participant", capabilities: ["self-service", "my-tickets", "my-assets", "knowledge"] },
  agent: { role: "agent", label: "Agent", experience: "operations", homeRoute: "/", dashboardTemplate: "operations", workspaceScope: "assigned-and-support-groups", capabilities: ["ticket-workspace", "assignment", "conversation", "sla"] },
  operator: { role: "operator", label: "Operator", experience: "operations", homeRoute: "/", dashboardTemplate: "operations", workspaceScope: "explicit-operational-access", capabilities: ["ticket-workspace", "production-workflows"] },
  manager: { role: "manager", label: "Manager", experience: "management", homeRoute: "/", dashboardTemplate: "manager", workspaceScope: "managed-departments-and-groups", capabilities: ["department-oversight", "escalations", "approvals", "archive-rules"] },
  admin: { role: "admin", label: "Administrator", experience: "administration", homeRoute: "/admin", dashboardTemplate: "admin", workspaceScope: "configured-administration", capabilities: ["users", "groups", "directory", "communications", "system-health"] },
  superadmin: { role: "superadmin", label: "Superadministrator", experience: "governance", homeRoute: "/admin", dashboardTemplate: "superadmin", workspaceScope: "global-audited-governance", capabilities: ["platform-governance", "emergency-access", "audit", "destructive-controls"] },
});

export function roleExperienceContract(role) {
  return ROLE_EXPERIENCE_CONTRACTS[role] || ROLE_EXPERIENCE_CONTRACTS.user;
}

export function dashboardContractFor(role, employeeView = false) {
  return employeeView ? { ...ROLE_EXPERIENCE_CONTRACTS.user, previewingAsEmployee: true } : roleExperienceContract(role);
}

export const DEPARTMENT_WORKSPACE_CONTRACT = Object.freeze({
  type: "department",
  memberRoles: ["employee", "agent", "manager"],
  ticketScopes: ["requester-department", "assigned-agent", "support-group", "explicit-grant"],
  sections: ["overview", "members", "tickets", "sla", "escalations", "communications", "knowledge", "activity"],
  defaultPrivacy: "least-privilege",
});
