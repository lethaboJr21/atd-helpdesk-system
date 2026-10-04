import axios from "axios";

function getModuleBase() {
  return window.location.pathname.toLowerCase().startsWith("/production")
    ? "/production"
    : "/helpdesk";
}

// Dev uses a relative path so the Vite proxy forwards /api to the backend ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
// works from any machine, not just the server itself.
const API_BASE = import.meta.env.MODE === "production"
  ? `${window.location.origin}${getModuleBase()}/api`
  : "/api";

const api = axios.create({
  baseURL: API_BASE,
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
  assignAgent: (ticketId, assignedToUserId) =>
    api.post(`/tickets/${ticketId}/assign-agent`, { assignedToUserId }),
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
      files.forEach((file) => body.append("attachments", file));
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
  close: (id) => api.patch(`/tickets/${id}/close`, {}),
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
    (files || []).forEach((file) => body.append("attachments", file));
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
  getAll: () => api.get("/company-communications"),
  preview: (data) => api.post("/company-communications/preview", data),
  audienceOptions: () => api.get("/company-communications/audience-options"),
  create: (data, files = []) => { const body = new FormData(); Object.entries(data || {}).forEach(([key,value]) => body.append(key, typeof value === "object" ? JSON.stringify(value) : String(value))); files.forEach((file) => body.append("attachments", file)); return api.post("/company-communications", body, { headers: { "Content-Type": undefined }, transformRequest: [(payload,headers) => { if (payload instanceof FormData && headers) delete headers["Content-Type"]; return payload; }] }); },
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
    if (Array.isArray(payload)) return { users: payload, pagination: null };
    return {
      users: Array.isArray(payload?.users) ? payload.users : [],
      pagination: payload?.pagination || null,
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
export const financeWorkspaceApi = {
  configuration: () => api.get("/finance-workspace/configuration"),
  dashboard: () => api.get("/finance-workspace/dashboard"),
  exportContract: () => api.get("/finance-workspace/export-contract"),
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
    return api.post(`/profile-media/users/${userId}/${mediaType}`, data, { headers: { "Content-Type": "multipart/form-data" } });
  },
  remove: (userId, mediaType, reason) => api.delete(`/profile-media/users/${userId}/${mediaType}`, { data: { reason } }),
};
