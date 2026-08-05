import axios from "axios";

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
  getMyModules: () => api.get("/tickets/my-modules"),
  getById: (id) => api.get(`/tickets/${id}`),
  getHistory: (id) => api.get(`/tickets/${id}/history`),
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
  updateStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
  resolve: (id) => api.patch(`/tickets/${id}/resolve`, {}),
  close: (id) => api.patch(`/tickets/${id}/close`, {}),
  assign: (id, assignedToUserId, assignedGroupId) => api.post(`/tickets/${id}/assign`, { assignedToUserId, assignedGroupId }),
  getAttachments: (id) => api.get(`/tickets/${id}/attachments`),
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
};

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

export const settingsApi = {
  getEmailSettings: () =>
    api.get("/settings/email"),

  updateEmailSettings: (data) =>
    api.put("/settings/email", data),
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

export default api;
