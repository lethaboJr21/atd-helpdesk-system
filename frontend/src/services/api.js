import axios from "axios";

function getModuleBase() {
  return window.location.pathname.toLowerCase().startsWith("/production")
    ? "/production"
    : "/helpdesk";
}

const API_BASE = import.meta.env.MODE === "production"
  ? `${window.location.origin}${getModuleBase()}/api`
  : "http://localhost:3001/api";

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
  getEmployeeView: () =>api.get("/tickets/employee-view"),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post("/tickets", data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  updateStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
  resolve: (id) => api.patch(`/tickets/${id}/resolve`, {}),
  close: (id) => api.patch(`/tickets/${id}/close`, {}),
  assign: (id, assignedToUserId, assignedGroupId) => api.post(`/tickets/${id}/assign`, { assignedToUserId, assignedGroupId }),
};

export const groupsApi = {
  getAll: () => api.get("/groups"),
  getCatalogue: () => api.get("/groups/catalogue"),
  getMembers: (groupId) => api.get(`/groups/${groupId}/members`),
  getEligibleAgents: () => api.get("/groups/eligible-agents"),
  create: (data) => api.post("/groups", data),
  update: (groupId, data) => api.put(`/groups/${groupId}`, data),
  addMember: (groupId, userId) => api.post(`/groups/${groupId}/members`, { userId }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
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

export const knowledgeApi = { getAll: (params) => api.get("/knowledge", { params }) };

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
  getVolumeData: () => api.get("/stats/volume"),
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
