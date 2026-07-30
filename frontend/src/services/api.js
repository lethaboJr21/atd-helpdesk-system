import axios from "axios";

function getModuleBase() {
  const pathname = window.location.pathname.toLowerCase();

  if (pathname.startsWith("/production")) {
    return "/production";
  }

  return "/helpdesk";
}

const API_BASE =
  import.meta.env.MODE === "production"
    ? `${window.location.origin}${getModuleBase()}/api`
    : "http://localhost:3001/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
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
// API service functions for different modules
// Each function corresponds to a specific API endpoint and HTTP method
// These functions can be imported and used in React components to interact with the backend API
export const ticketsApi = {
  getAll: (params) => {
    return api.get("/tickets", { params });
  },

  getMine: () => {
    return api.get("/tickets/my-tickets");
  },

  getById: (id) => {
    return api.get(`/tickets/${id}`);
  },

  create: (data) => {
    return api.post("/tickets", data);
  },

  update: (id, data) => {
    return api.put(`/tickets/${id}`, data);
  },

  updateStatus: (id, status) => {
    return api.patch(`/tickets/${id}/status`, { status });
  },

  resolve: (id) => {
    return api.patch(`/tickets/${id}/resolve`, {});
  },

  close: (id) => {
    return api.patch(`/tickets/${id}/close`, {});
  },

  assign: (id, assignedToUserId, assignedGroupId) => {
    return api.post(`/tickets/${id}/assign`, {
      assignedToUserId,
      assignedGroupId,
    });
  },
};

export const groupsApi = {
  getAll: () => {
    return api.get("/groups");
  },
};

export const assetsApi = {
  getAll: (params) => {
    return api.get("/assets", { params });
  },

  getById: (id) => {
    return api.get(`/assets/${id}`);
  },

  getStats: () => {
    return api.get("/assets/stats");
  },

  getMine: () => {
    return api.get("/assets/by-user");
  },

  getByUser: (params) => {
    return api.get("/assets/by-user", { params });
  },
};

export const knowledgeApi = {
  getAll: (params) => {
    return api.get("/knowledge", { params });
  },
};

export const authApi = {
  login: (credentials) => {
    return api.post("/auth/login", credentials);
  },

  signup: (data) => {
    return api.post("/auth/signup", data);
  },

  logout: () => {
    return api.post("/auth/logout", {});
  },

  me: () => {
    return api.get("/auth/me");
  },

  microsoftLoginUrl: () => {
    return `${API_BASE}/auth/microsoft`;
  },
};

export const userApi = {
  getUsers: (params) => {
    return api.get("/users", { params });
  },

  getMeta: () => {
    return api.get("/users/meta");
  },

  getById: (id) => {
    return api.get(`/users/${id}`);
  },

  getEmployeePreview: (id) => {
    return api.get(`/users/${id}/employee-preview`);
  },

  bulkAction: (data) => {
    return api.post("/users/bulk", data);
  },

  updateProfile: (id, data) => {
    return api.put(`/users/${id}/profile`, data);
  },

  approveUser: (id, role) => {
    return api.put(`/users/${id}/approve`, { role });
  },

  updateUserRole: (id, role) => {
    return api.put(`/users/${id}/role`, { role });
  },

  deactivateUser: (id) => {
    return api.put(`/users/${id}/deactivate`, {});
  },

  reactivateUser: (id) => {
    return api.put(`/users/${id}/reactivate`, {});
  },

  archiveUser: (id, reason) => {
    return api.put(`/users/${id}/archive`, { reason });
  },

  restoreUser: (id) => {
    return api.put(`/users/${id}/restore`, {});
  },

  deleteUser: (id) => {
    return api.delete(`/users/${id}`);
  },

  getPendingSignups: (params = {}) => {
  return api.get("/users", {
    params: { ...params, accountView: "pending" },
  });
},

getActiveUsers: (params = {}) => {
  return api.get("/users", {
    params: { ...params, accountView: "active" },
  });
},

getDeactivatedUsers: (params = {}) => {
  return api.get("/users", {
    params: { ...params, accountView: "deactivated" },
  });
},

getArchivedUsers: (params = {}) => {
  return api.get("/users", {
    params: { ...params, accountView: "archived" },
  });
},
};

export const azureApi = {
  getUsers: (params) => {
    return api.get("/azure/users", { params });
  },

  syncUsers: (options = {}) => {
    return api.post("/azure/sync", options);
  },
};

export const statsApi = {
  getDashboard: () => {
    return api.get("/stats/dashboard");
  },

  getSLATrend: () => {
    return api.get("/stats/sla-trend");
  },

  getVolumeData: () => {
    return api.get("/stats/volume");
  },

  getCategoryData: () => {
    return api.get("/stats/categories");
  },

  getAssetHealth: () => {
    return api.get("/stats/assets");
  },
};

export const productionApi = {
  getAll: () => {
    return api.get("/production");
  },

  create: (data) => {
    return api.post("/production", data);
  },
};

export const logsApi = {
  getAll: () => {
    return api.get("/logs");
  },

  create: (data) => {
    return api.post("/logs", data);
  },
};

export const notificationApi = {
  getAll: (params) => {
    return api.get("/notifications", { params });
  },

  markRead: (id) => {
    return api.patch(
      `/notifications/${id}/read`,
      {}
    );
  },

  getUnreadCount: (params) => {
  return api.get("/notifications/unread-count", { params });
  },

  markAllRead: (module) => {
    return api.patch(
      "/notifications/read-all",
      {},
      {
        params: {
          module,
        },
      }
    );
  },

  clearAll: (module) => {
    return api.delete("/notifications/clear", {
      params: {
        module,
      },
    });
  },
};

export const productionSyncApi = {
  getBedlinerDaily: (params) => {
    return api.get("/production/sync/bedliner-daily", {
      params,
    });
  },

  syncBedlinerDaily: () => {
    return api.post(
      "/production/sync/sync-bedliner-daily",
      {}
    );
  },

  testMssql: () => {
    return api.get("/production/sync/test-mssql");
  },
};

export const productionEventsApi = {
  getAll: (params) => {
    return api.get("/production-events", { params });
  },

  create: (data) => {
    return api.post("/production-events", data);
  },
};

export default api;
