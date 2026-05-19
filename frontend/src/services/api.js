import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
    }

    return Promise.reject(error);
  }
);

export const ticketsApi = {
  getAll: (params) => api.get("/tickets", { params }),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post("/tickets", data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  close: (id) => api.patch(`/tickets/${id}/close`),
};

export const statsApi = {
  getDashboard: () => api.get("/stats/dashboard"),
  getSLATrend: () => api.get("/stats/sla-trend"),
  getVolumeData: () => api.get("/stats/volume"),
  getCategoryData: () => api.get("/stats/categories"),
  getAssetHealth: () => api.get("/stats/assets"),
};

export const authApi = {
  login: (credentials) => api.post("/auth/login", credentials),
  signup: (data) => api.post("/auth/signup", data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
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
  getAll: () => api.get("/notifications"),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
  clearAll: () => api.delete("/notifications/clear"),
};

export const userApi = {
  getUsers: () => api.get("/auth/users"),
  approveUser: (id, role) => api.put(`/auth/approve/${id}`, { role }),
};

export default api;