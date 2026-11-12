import axios from "axios";

const resolveApiBaseUrl = () => {
  if (typeof window === "undefined") return "/helpdesk/api";
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return isLocal ? "/api" : "/helpdesk/api";
};

function getModuleBase() {
  return window.location.pathname.toLowerCase().startsWith("/production")
    ? "/production"
    : "/helpdesk";
}

// Dev uses a relative path so the Vite proxy forwards /api to the backend —
// works from any machine, not just the server itself.
const API_BASE = import.meta.env.MODE === "production"
  ? `${window.location.origin}${getModuleBase()}/api`
  : "/api";

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem("token");
    return Promise.reject(error);
  }
);

export const ticketsApi = {
  getAll: (params) => api.get("/tickets", { params }),
  getMine: () => api.get("/tickets/my-tickets"),
  getEscalationTargets: (ticketId) => api.get(`/tickets/${ticketId}/escalation-targets`),
  escalate: (ticketId, data) => api.post(`/tickets/${ticketId}/escalate`, data),
  setImportant: (ticketId, important, source="manual") => api.patch(`/tickets/${ticketId}/important`, { important, source }),
  assignAgent: (
  ticketId,
  assignedToUserId,
  assignedGroupId = undefined
) =>
  api.post(
    `/tickets/${ticketId}/assign-agent`,
    {
      assignedToUserId,
      assignedGroupId,
    }
  ),
  getEmployeeView: () =>api.get("/tickets/employee-view"),
  getParticipantView: () => api.get("/tickets/participant-view"),
  getMyModules: () => api.get("/tickets/my-modules"),
  getById: (id) => api.get(`/tickets/${id}`),
  getHistory: (id) => api.get(`/tickets/${id}/history`),
  undoHistory: (id, historyId) => api.post(`/tickets/${id}/history/${historyId}/undo`, {}),
  create: (data, files = []) => {
    if (Array.isArray(files) && files.length > 0) {
      const body = new FormData();
      Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === "object") {
          body.append(key, JSON.stringify(value));
        } else {
          body.append(key, String(value));
        }
      });
      files.forEach((file) => { if (file instanceof File) body.append("attachments", file, file.name); });
      return api.post("/tickets", body, {
        headers: { "Content-Type": undefined },
        transformRequest: [(payload, headers) => {
          if (payload instanceof FormData && headers) {
            delete headers["Content-Type"];
          }
          return payload;
        }],
      });
    }
    return api.post("/tickets", data);
  },
  update: (id, data) => api.put(`/tickets/${id}`, data),
  bulkAction: (data) => api.post("/tickets/bulk", data),
  updateStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
  resolve: (id) => api.patch(`/tickets/${id}/resolve`, {}),
  close: (id, data) => api.patch(`/tickets/${id}/close`, data),
  reopen: (id, reason) => api.post(`/tickets/${id}/reopen`, { reason }),
  getResolutionCycles: (id) => api.get(`/tickets/${id}/resolution-cycles`),
  assign: (id, assignedToUserId, assignedGroupId) => api.post(`/tickets/${id}/assign`, { assignedToUserId, assignedGroupId }),
  getAttachments: (id) => api.get(`/tickets/${id}/attachments`),
  previewAttachment: (ticketId, attachmentId) =>
    api.get(`/tickets/${ticketId}/attachments/${attachmentId}/preview`, {
      responseType: "blob",
    }),
  downloadAttachment: (ticketId, attachmentId) =>
    api.get(`/tickets/${ticketId}/attachments/${attachmentId}/download`, {
      responseType: "blob",
    }),
  uploadAttachments: (id, files = []) => {
    const body = new FormData();
    (files || []).forEach((file) => { if (file instanceof File) body.append("attachments", file, file.name); });
    return api.post(`/tickets/${id}/attachments`, body, {
      headers: { "Content-Type": undefined },
      transformRequest: [
        (payload, headers) => {
          if (payload instanceof FormData && headers) {
            delete headers["Content-Type"];
          }
          return payload;
        },
      ],
    });
  },
  getComments: (id) => api.get(`/tickets/${id}/comments`),
  getConversation: (id) => api.get(`/tickets/${id}/conversation`),
  getSurvey: (id) => api.get(`/tickets/${id}/survey`),
  submitSurvey: (id, data) => api.post(`/tickets/${id}/survey`, data),
  getTeamsConversation: (id) => api.get(`/tickets/${id}/teams-conversation`),
  prepareTeamsConversation: (id) => api.post(`/tickets/${id}/teams-conversation/prepare`, {}),
  getChangeConfirmations: (id) => api.get(`/tickets/${id}/change-confirmations`),
  addComment: (id, data) => api.post(`/tickets/${id}/comments`, data),
  replyAction: (id, data) => api.post(`/tickets/${id}/reply-action`, data),
  getEmailParticipants: (id) => api.get(`/assignment-acceptance/${id}/email-participants`),
  addEmailParticipant: (id, data) => api.post(`/assignment-acceptance/${id}/email-participants`, data),
  removeEmailParticipant: (id, participantId) => api.delete(`/assignment-acceptance/${id}/email-participants/${participantId}`),
};

export const ticketParticipationApi = { getMine:()=>api.get("/ticket-participation/mine"), getTicket:(ticketId)=>api.get(`/ticket-participation/${ticketId}`), invite:(ticketId,data)=>api.post(`/ticket-participation/${ticketId}/invite`,data), forward:(ticketId,data)=>api.post(`/ticket-participation/${ticketId}/forward`,data), revoke:(ticketId,participantId,reason)=>api.delete(`/ticket-participation/${ticketId}/participants/${participantId}`,{data:{reason}}) };
export const groupsApi = {
  getAll: () => api.get("/groups"),
  getCatalogue: () => api.get("/groups/catalogue"),
  getAgents: (params) => api.get("/groups/agents", { params }),
  getCatalogueAgents: () => api.get("/groups/catalogue-agents"),
  getRequesters: () => api.get("/groups/requesters"),
  getRequestBeneficiaries: () => api.get("/groups/request-beneficiaries"),
  getMembers: (groupId) => api.get(`/groups/${groupId}/members`),
  getEligibleAgents: () => api.get("/groups/eligible-agents"),
  create: (data) => api.post("/groups", data),
  update: (groupId, data) => api.put(`/groups/${groupId}`, data),
  addMember: (groupId, userId) => api.post(`/groups/${groupId}/members`, { userId }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

export const adminControlsApi = {
  getUserControls: (userId) =>
    api.get(`/admin-controls/${userId}`),

  updateUserFeatures: (userId, data) =>
    api.put(`/admin-controls/${userId}/features`, data),

  updateUserEmailPreferences: (userId, data) =>
    api.put(`/admin-controls/${userId}/email-preferences`, data),

  getAudit: (params) =>
    api.get("/admin-controls/audit", { params }),

  getHealth: () =>
    api.get("/admin-controls/health"),
};

export const accessRequestsApi = {
  getFeatures: () => api.get("/access-requests/features"),
  getMine: () => api.get("/access-requests/mine"),
  getPending: () => api.get("/access-requests/pending"),
  getById: (requestId) => api.get(`/access-requests/${requestId}`),
  submit: (data) => api.post("/access-requests", data),
  cancel: (requestId, reason) => api.post(`/access-requests/${requestId}/cancel`, { reason }),
  decide: (requestId, data) => api.post(`/access-requests/${requestId}/decision`, data),
  getMyTemporaryEntitlements: () => api.get("/access-requests/temporary-entitlements/mine"),
  getTemporaryEntitlements: () => api.get("/access-requests/temporary-entitlements"),
  reconcileTemporaryEntitlements: () => api.post("/access-requests/temporary-entitlements/reconcile", {}),
  revokeTemporaryEntitlement: (entitlementId, reason) => api.post(`/access-requests/temporary-entitlements/${entitlementId}/revoke`, { reason }),
  getEffective: (userId) => api.get(`/access-requests/effective/${userId}`),
};

export const settingsApi = {
  getEmailSettings: () => api.get("/settings/email"),
  updateEmailSettings: (data) => api.put("/settings/email", data),
};
export const archiveRulesApi = { getAll:()=>api.get("/archive-rules"), create:(data)=>api.post("/archive-rules",data) };
export const companyCommunicationsApi = {
  communicationMonitoring: () => api.get("/company-communications/monitoring/summary"),
  recordInteraction: (id,data) => api.post(`/company-communications/${id}/interactions`,data),
  getAll: () => api.get("/company-communications"),
  preview: (data) => api.post("/company-communications/preview", data),
  audienceOptions: () => api.get("/company-communications/audience-options"),
  create: (data, files = []) => { const body = new FormData(); Object.entries(data || {}).forEach(([key,value]) => body.append(key, typeof value === "object" ? JSON.stringify(value) : String(value))); files.forEach((file) => { if (file instanceof File) body.append("attachments", file, file.name); }); return api.post("/company-communications", body, { headers: { "Content-Type": undefined }, transformRequest: [(payload,headers) => { if (payload instanceof FormData && headers) delete headers["Content-Type"]; return payload; }] }); },
  attachments: (id) => api.get(`/company-communications/${id}/attachments`),
  downloadAttachment: (id, attachmentId) => api.get(`/company-communications/${id}/attachments/${attachmentId}/download`, { responseType: "blob" }),
  removeAttachment: (id, attachmentId) => api.delete(`/company-communications/${id}/attachments/${attachmentId}`),
  deliveries: (id) => api.get(`/company-communications/${id}/deliveries`),
  test: (id, to) => api.post(`/company-communications/${id}/test`, { to }),
  schedule: (id, scheduledAt, approved) => api.post(`/company-communications/${id}/schedule`, { scheduledAt, approved }),
  cancel: (id) => api.post(`/company-communications/${id}/cancel`, {}),
  send: (id, approved) => api.post(`/company-communications/${id}/send`, { approved }),
  feed: () => api.get("/company-communications/feed/mine"),
  markRead: (id) => api.post(`/company-communications/${id}/read`, {}),
  comments: (id) => api.get(`/company-communications/${id}/comments`),
  addComment: (id, body) => api.post(`/company-communications/${id}/comments`, { body }),
  editComment: (id, commentId, body) => api.patch(`/company-communications/${id}/comments/${commentId}`, { body }),
  hideComment: (id, commentId) => api.patch(`/company-communications/${id}/comments/${commentId}/hide`, {}),
};


export const assetsApi = {
  getAll: (params) =>
     api.get("/assets", { params }),

  getById: (id) =>
     api.get(`/assets/${id}`),

  getStats: () =>
     api.get("/assets/stats"),

  getMine: () =>
     api.get("/assets/mine"),

  getByUser: (params) =>
     api.get("/assets/by-user", { params }),
};

export const catalogApi = {
  getService: () => api.get("/catalog/service"),
  getManagedItServices: () => api.get("/catalog/managed-it-services", { timeout: 8000 }),
  getAssets: () => api.get("/catalog/assets"),
  getFields: () => api.get("/catalog/fields"),
};

export const knowledgeApi = { getAll: (params) => api.get("/knowledge", { params }) };

export const currentTicketArchiveApi = {
  list: (params) => api.get("/current-ticket-archive", { params }),
  get: (id) => api.get(`/current-ticket-archive/${id}`),
  restore: (id, reason) => api.post(`/current-ticket-archive/${id}/restore`, { reason }),
  remove: (id, data) => api.delete(`/current-ticket-archive/${id}`, { data }),
};

export const archiveApi = {
  getSummary: () => api.get("/archive/summary"),
  getFilters: () => api.get("/archive/filters"),
  searchTickets: (params) => api.get("/archive/tickets", { params }),
  getMyTickets: (params) => api.get("/archive/my-tickets", { params }),
  getTicket: (fsId) => api.get(`/archive/tickets/${fsId}`),
  downloadAttachment: (fsId) =>
    api.get(`/archive/attachments/${fsId}/download`, { responseType: "blob" }),
  getKnowledge: (params) => api.get("/archive/knowledge", { params }),
  getAssets: (params) => api.get("/archive/assets", { params }),
  getSyncRuns: () => api.get("/archive/sync-runs"),
};

export const employeeExperienceApi = {
  getCurrent: () => api.get("/employee-experience/current"),
  savePreferences: (data) => api.put("/employee-experience/preferences", data),
  complete: (data) => api.post("/employee-experience/complete", data),
  saveMonitorView: (monitorView) => api.put("/employee-experience/monitor-view", { monitorView }),
};export const termsApi = {
  getCurrent: () => api.get("/terms/current"),
  accept: (documentIds) => api.post("/terms/accept", { documentIds }),
};
export const authApi = {
  loginOptions: (identifier) => api.post("/auth/login-options", { identifier }),
  login: (credentials) =>
     api.post("/auth/login", credentials),
  signup: (data) =>
     api.post("/auth/signup", data),
  logout: () =>
     api.post("/auth/logout", {}),
  me: () =>
     api.get("/auth/me"),
  microsoftLoginUrl: () =>
     `${API_BASE}/auth/microsoft`,
};

export const userApi = {
  getUsers: (params) => api.get("/users", { params }),
  unwrapUsers: (payload) => {
    const source = payload?.data && !Array.isArray(payload) ? payload.data : payload;
    const users = Array.isArray(source)
      ? source
      : Array.isArray(source?.users)
        ? source.users
        : Array.isArray(source?.accounts)
          ? source.accounts
          : Array.isArray(source?.items)
            ? source.items
            : Array.isArray(source?.rows)
              ? source.rows
              : Array.isArray(source?.results)
                ? source.results
                : [];
    return {
      users,
      pagination: source?.pagination || source?.meta?.pagination || null,
    };
  },
  getMeta: () => api.get("/users/meta"),
  getById: (id) => api.get(`/users/${id}`),
  getEmployeePreview: (id) => api.get(`/users/${id}/employee-preview`),
  bulkAction: (data) => api.post("/users/bulk", data),
  updateProfile: (id, data) => api.put(`/users/${id}/profile`, data),
  approveUser: (id, role) => api.put(`/users/${id}/approve`, { role }),
  updateUserRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  deactivateUser: (id, reason) => api.put(`/users/${id}/deactivate`, { reason }),
  reactivateUser: (id) => api.put(`/users/${id}/reactivate`, {}),
  archiveUser: (id, reason) => api.put(`/users/${id}/archive`, { reason }),
  restoreUser: (id) => api.put(`/users/${id}/restore`, {}),
  deleteUser: (id) => api.delete(`/users/${id}`),
  getPendingSignups: (params = {}) => api.get("/users", { params: { ...params, accountView: "pending", includeExternal: true } }),
  getActiveUsers: (params = {}) => api.get("/users", { params: { ...params, accountView: "active" } }),
  getDeactivatedUsers: (params = {}) => api.get("/users", { params: { ...params, accountView: "deactivated" } }),
  getArchivedUsers: (params = {}) => api.get("/users", { params: { ...params, accountView: "archived", includeArchived: true } }),
  getExternalUsers: (params = {}) => api.get("/users", { params: { ...params, accountView: "external", includeExternal: true } }),
  getNonPersonAccounts: (params = {}) => api.get("/users", { params: { ...params, accountView: "non-person", includeExternal: true } }),
};

export const azureApi = {
  getUsers: (params) => api.get("/azure/users", { params }),
  syncUsers: (options = {}) => api.post("/azure/sync", options),
};

export const statsApi = {
  getDashboard: () => api.get("/stats/dashboard"),
  getSLATrend: () => api.get("/stats/sla-trend"),
  getVolumeData: (params) => api.get("/stats/volume", { params }),
  getServiceMix: () => api.get("/stats/service-mix"),
  getCategoryData: () => api.get("/stats/categories"),
  getAssetHealth: () => api.get("/stats/assets"),
};

export const productionApi = {
  getAll: () => api.get("/production"),
  create: (data) => api.post("/production", data),
};

export const logsApi = {
  getAll: () => api.get("/logs"),
  create: (data) => api.post("/logs", data),
};

export const notificationApi = {
  getAll: (params) => api.get("/notifications", { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`, {}),
  markUnread: (id) => api.patch(`/notifications/${id}/unread`, {}),
  getUnreadCount: (params) => api.get("/notifications/unread-count", { params }),
  markAllRead: (module) => api.patch("/notifications/read-all", {}, { params: { module } }),
  clearAll: (module) => api.delete("/notifications/clear", { params: { module } }),
};

export const productionSyncApi = {
  getBedlinerDaily: (params) => api.get("/production/sync/bedliner-daily", { params }),
  syncBedlinerDaily: () => api.post("/production/sync/sync-bedliner-daily", {}),
  testMssql: () => api.get("/production/sync/test-mssql"),
};

export const productionEventsApi = {
  getAll: (params) => api.get("/production-events", { params }),
  create: (data) => api.post("/production-events", data),
};


export const workspaceCatalogueApi = {
  getItems: (params = {}) => api.get("/workspace-catalogue/items", { params }),
  getHistory: (id) => api.get(`/workspace-catalogue/items/${id}/history`),
  createItem: (data) => api.post("/workspace-catalogue/items", data),
  updateItem: (id, data) => api.put(`/workspace-catalogue/items/${id}`, data),
  duplicateItem: (id) => api.post(`/workspace-catalogue/items/${id}/duplicate`, {}),
  changeStatus: (id, data) => api.patch(`/workspace-catalogue/items/${id}/status`, data),
  ensureOther: (data) => api.post("/workspace-catalogue/ensure-other", data),
  requestOptions: (params) => api.get("/workspace-catalogue/request-options", { params }),
};
export const workspacesApi = {
  getAll: (params) => api.get("/workspaces", { params }),
  getById: (id) => api.get(`/workspaces/${id}`),
  getDashboard: (id) => api.get(`/workspaces/${id}/dashboard`),
  getReadiness: (id) => api.get(`/workspaces/${id}/readiness`),
  create: (data) => api.post("/workspaces", data),
  update: (id, data) => api.put(`/workspaces/${id}`, data),
  changeStatus: (id, data) => api.patch(`/workspaces/${id}/status`, data),
  getMembers: (id) => api.get(`/workspaces/${id}/members`),
  getMemberCandidates: (id, params) => api.get(`/workspaces/${id}/member-candidates`, { params }),
  addMember: (id, data) => api.post(`/workspaces/${id}/members`, data),
  updateMember: (id, memberId, data) => api.patch(`/workspaces/${id}/members/${memberId}`, data),
  removeMember: (id, memberId, reason) => api.delete(`/workspaces/${id}/members/${memberId}`, { data: { reason } }),
  getActivity: (id) => api.get(`/workspaces/${id}/activity`),
};
export const processEngineeringWorkspaceApi = {
  accessContext: () => api.get("/process-engineering-workspace/access-context"),
  dashboard: () => api.get("/process-engineering-workspace/dashboard"),
  catalogue: () => api.get("/process-engineering-workspace/catalogue"),
  tickets: () => api.get("/process-engineering-workspace/tickets"),
  activity: () => api.get("/process-engineering-workspace/activity"),
  completionReport: () => api.get("/process-engineering-workspace/completion-report"),
  downloadExport: () => api.get("/process-engineering-workspace/export.xlsx?reviewed=true",{responseType:"blob"}),
    ticketContext: (ticketId) => api.get(`/process-engineering-workspace/ticket-context/${ticketId}`),
    saveTicketContext: (ticketId, data) => api.put(`/process-engineering-workspace/ticket-context/${ticketId}`, data),
};
export const financeWorkspaceManagementApi = {
  financeFunctions: () => api.get("/finance-workspace/management/functions"),
  addFinanceFunction: data => api.post("/finance-workspace/management/functions",data),
  updateFinanceFunction: (id,data) => api.put(`/finance-workspace/management/functions/${id}`,data),
  retireFinanceFunction: (id,data) => api.post(`/finance-workspace/management/functions/${id}/retire`,data),
  restoreFinanceFunction: id => api.post(`/finance-workspace/management/functions/${id}/restore`),
  updateEmployeeResponsibility: (userId,data) => api.put(`/finance-workspace/management/employees/${userId}/responsibility`,data),
  setEmployeeScopeStatus: (userId,data) => api.post(`/finance-workspace/management/employees/${userId}/scope-status`,data),
  previewDutyDelegation: data => api.post("/finance-workspace/management/duty-delegations/preview",data),
  createDutyDelegation: data => api.post("/finance-workspace/management/duty-delegations",data),
  financeLocations: () => api.get("/finance-workspace/management/locations"),
  governedEmployees: () => api.get("/finance-workspace/management/employees"),
  assignmentSelectors: () => api.get("/finance-workspace/management/assignment-selectors"),
  addEmployee: (userId,data) => api.post(`/finance-workspace/management/employees/${userId}/add`,data),
  removeEmployee: (userId,data) => api.post(`/finance-workspace/management/employees/${userId}/remove`,data),
  restoreEmployee: (userId,data) => api.post(`/finance-workspace/management/employees/${userId}/restore`,data),
  refreshManagerSuggestions: () => api.post("/finance-workspace/management/manager-suggestions/refresh",{}),
  overrideManager: (userId,data) => api.put(`/finance-workspace/management/manager-suggestions/${userId}/override`,data),
  positionDutyTemplates: () => api.get("/finance-workspace/management/position-duty-templates"),
  duties: params => api.get("/finance-workspace/management/duties",{params}),
  addDuty: data => api.post("/finance-workspace/management/duties",data),
  updateDuty: (id,data) => api.put(`/finance-workspace/management/duties/${id}`,data),
  kpis: () => api.get("/finance-workspace/management/kpis"),
  addKpi: data => api.post("/finance-workspace/management/kpis",data),
  updateKpi: (id,data) => api.put(`/finance-workspace/management/kpis/${id}`,data),
  executiveDashboard: () => api.get("/finance-workspace/management/executive-dashboard"),
  boardroomBookings: () => api.get("/finance-workspace/management/boardroom-bookings"),
  bookBoardroom: data => api.post("/finance-workspace/management/boardroom-bookings",data),
};
export const financeWorkspaceApi = {
  financeTaskControl: ticketId => api.get(`/finance-workspace/tasking/${ticketId}/control`),
  updateFinanceTaskReminder: (ticketId,data) => api.put(`/finance-workspace/tasking/${ticketId}/reminders`,data),
  classifyFinanceCommunication: (ticketId,data) => api.post(`/finance-workspace/tasking/${ticketId}/communications`,data),
  updateFinanceParticipantAccess: (ticketId,participantId,data) => api.put(`/finance-workspace/tasking/participants/${ticketId}/${participantId}/access`,data),
  taskParticipants: ticketId => api.get(`/finance-workspace/tasking/participants/${ticketId}`),
  addTaskParticipant: (ticketId,data) => api.post(`/finance-workspace/tasking/participants/${ticketId}`,data),
  submitFinanceTask: (ticketId,data={}) => api.post(`/finance-workspace/tasking/${ticketId}/submit`,data),
  reviewFinanceTask: (ticketId,data) => api.post(`/finance-workspace/tasking/${ticketId}/review`,data),
  financeSenderAutomation: () => api.get("/finance-workspace/sender-automation"),
  createFinanceSenderAutomation: data => api.post("/finance-workspace/sender-automation",data),
  financeCompletionMonitor: () => api.get("/finance-workspace/completion-monitor"),
    accessContext: () => api.get("/finance-workspace/access-context"),
    catalogue: () => api.get("/finance-workspace/catalogue"),
  administration: () => api.get("/finance-workspace/administration"),
  updateOffice: (code, data) => api.put(`/finance-workspace/offices/${code}`, data),
  updateEmployeeStatus: (userId, data) => api.patch(`/finance-workspace/employees/${userId}/status`, data),
  updateExternalSender: (senderId, data) => api.put(`/finance-workspace/external-senders/${senderId}`, data),  configuration: () => api.get("/finance-workspace/configuration"),
  dashboard: () => api.get("/finance-workspace/dashboard"),
  reportingSummary: () => api.get("/finance-workspace/reporting-summary"),
  employees: () => api.get("/finance-workspace/employees"),
  updateEmployee: (userId, data) => api.put(`/finance-workspace/employees/${userId}`, data),
  mailboxes: () => api.get("/finance-workspace/mailboxes"),
  saveMailbox: (data) => api.post("/finance-workspace/mailboxes", data),
  queue: (type) => api.get("/finance-workspace/queues", { params: { type } }),
  triage: (ticketId, data) => api.post(`/finance-workspace/tickets/${ticketId}/triage`, data),
  delegate: (ticketId, data) => api.post(`/finance-workspace/tickets/${ticketId}/delegate`, data),
  delegations: () => api.get("/finance-workspace/delegations"),
  routingOptions: () => api.get("/finance-workspace/routing-options"),
  updateMailbox: (mailboxId, data) => api.put(`/finance-workspace/mailboxes/${mailboxId}`, data),
  saveExternalSender: (data) => api.post("/finance-workspace/external-senders", data),
  triageConsole: (state = "triage_required") => api.get("/finance-workspace/triage-console", { params: { state } }),
  bulkDelegate: (data) => api.post("/finance-workspace/tickets/bulk-delegate", data),
  correspondence: (params) => api.get("/finance-workspace/correspondence", { params }),
  emailTickets: (params={}) => api.get("/finance-workspace/correspondence", { params: { filter: "all", ...params } }),
  mailboxHealth: () => api.get("/finance-workspace/email-intake/health"),
  intakeExceptions: (params={}) => api.get("/finance-workspace/email-intake/exceptions", { params }),
  reprocessIntakeException: (id,data={}) => api.post(`/finance-workspace/email-intake/exceptions/${id}/reprocess`,data),
  resolveIntakeException: (id,data) => api.post(`/finance-workspace/email-intake/exceptions/${id}/resolve`,data),
  emailRoutingRules: () => api.get("/finance-workspace/email-intake/rules"),
  approvalRecords: (type,params={}) => api.get(`/finance-workspace/approvals/${type}`,{params}),
  monthEndPeriod: period => api.get(`/finance-workspace/month-end/${period}`),
  governanceRecords: area => api.get(`/finance-workspace/governance/${area}`),
  peoplePerformanceDashboard: period => api.get("/finance-workspace/people-performance/dashboard",{params:{period}}),
  financeDuties: params => api.get("/finance-workspace/people-performance/duties",{params}),
  createFinanceDuty: data => api.post("/finance-workspace/people-performance/duties",data),
  updateFinanceDuty: (id,data) => api.put(`/finance-workspace/people-performance/duties/${id}`,data),
  financeKpis: period => api.get("/finance-workspace/people-performance/kpis",{params:{period}}),
  createFinanceKpi: data => api.post("/finance-workspace/people-performance/kpis",data),
  reviewFinanceKpi: (id,data) => api.post(`/finance-workspace/people-performance/kpis/${id}/review`,data),
  teamAdminAction: (userId,data) => api.post(`/finance-workspace/people-performance/team/${userId}/action`,data),
  createAudit: data => api.post("/finance-workspace/governance/audits",data),
  createAuditItem: (id,data) => api.post(`/finance-workspace/governance/audits/${id}/items`,data),
  createFinanceEvidence: data => api.post("/finance-workspace/governance/evidence",data),
  reviewFinanceEvidence: (id,data) => api.post(`/finance-workspace/governance/evidence/${id}/review`,data),
  financeNotificationAction: (id,data) => api.post(`/finance-workspace/governance/notifications/${id}/action`,data),
  createFinanceAccessRequest: data => api.post("/finance-workspace/governance/access",data),
  decideFinanceAccessRequest: (id,data) => api.post(`/finance-workspace/governance/access/${id}/decision`,data),
  openMonthEndPeriod: data => api.post("/finance-workspace/month-end/periods",data),
  monthEndTemplates: () => api.get("/finance-workspace/month-end/templates/all"),
  createMonthEndTemplate: data => api.post("/finance-workspace/month-end/templates",data),
  generateMonthEndTasks: period => api.post(`/finance-workspace/month-end/${period}/generate`,{}),
  createMonthEndTask: (period,data) => api.post(`/finance-workspace/month-end/${period}/tasks`,data),
  monthEndTaskAction: (id,data) => api.post(`/finance-workspace/month-end/tasks/${id}/action`,data),
  bulkMonthEndTasks: data => api.post("/finance-workspace/month-end/tasks/bulk",data),
  createJournal: data => api.post("/finance-workspace/approvals/journals",data),
  createReconciliation: data => api.post("/finance-workspace/approvals/reconciliations",data),
  approvalAction: (type,id,data) => api.post(`/finance-workspace/approvals/${type}/${id}/action`,data),
  approvalHistory: (type,id) => api.get(`/finance-workspace/approvals/${type}/${id}/history`),
  createEmailRoutingRule: data => api.post("/finance-workspace/email-intake/rules",data),
  updateEmailRoutingRule: (id,data) => api.put(`/finance-workspace/email-intake/rules/${id}`,data),
  syncCorrespondence: () => api.post("/finance-workspace/correspondence/sync"),
  updateCorrespondence: (id, data) => api.patch(`/finance-workspace/correspondence/${id}`, data),
  exportContract: () => api.get("/finance-workspace/export-contract"),
  monitoringStatus: () => api.get("/finance-workspace/monitoring-status"),
  convertCorrespondence: (id,data={}) => api.post(`/finance-workspace/correspondence/${id}/convert-to-ticket`,data),
  exportPreview: (params={}) => api.get("/finance-workspace/export-preview",{params}),
  downloadExport: () => api.get("/finance-workspace/export.xlsx?reviewed=true",{responseType:"blob"}),
};

export default api;

export const operationalMonitorApi = {
  summary: (params) => api.get("/operational-monitor/summary", { params }),
  digestPreview: () => api.get("/operational-monitor/digest-preview"),
  claim: (ticketId) => api.post(`/operational-monitor/tickets/${ticketId}/claim`),
  proposeAssignee: (ticketId, data) => api.post(`/assignment-acceptance/${ticketId}/propose`, data),
};

export const profileMediaApi = {
  metadata: (userId, mediaType) => api.get(`/profile-media/users/${userId}/${mediaType}/metadata`),
  download: (userId, mediaType, revision) =>
    api.get(`/profile-media/users/${userId}/${mediaType}`, {
      params: { v: revision || 1 },
      responseType: "blob",
    }),
  upload: (userId, mediaType, file, visibility = "portal") => {
    const data = new FormData();
    data.append("image", file);
    data.append("visibility", visibility);
    return api.post(`/profile-media/users/${userId}/${mediaType}`, data, { });
  },
  remove: (userId, mediaType, reason) => api.delete(`/profile-media/users/${userId}/${mediaType}`, { data: { reason } }),
};
