import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi } from "../services/api";

export const AuthContext = createContext(undefined);

const TOKEN_STORAGE_KEY = "token";
const EMPLOYEE_VIEW_STORAGE_KEY =
  "atd-helpdesk-employee-view";

function normalizeBoolean(
  value,
  fallbackValue = false
) {
  if (value === undefined || value === null) {
    return fallbackValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return ["true", "1", "yes"].includes(
    String(value).trim().toLowerCase()
  );
}

function normalizeNullableDate(value) {
  return value || null;
}

function normalizeAuthenticatedUser(userData) {
  if (!userData) {
    return null;
  }

  const approved = normalizeBoolean(
    userData.approved,
    false
  );

  const rawStatus = String(
    userData.status || ""
  )
    .trim()
    .toLowerCase();

  return {
    ...userData,
    id: Number(userData.id || userData.user_id),
    role: String(userData.role || "user")
      .trim()
      .toLowerCase(),
    status:
      rawStatus ||
      (approved ? "active" : "inactive"),
    account_type: String(
      userData.account_type || "person"
    )
      .trim()
      .toLowerCase(),
    approved,
    microsoft_account_enabled:
      normalizeBoolean(
        userData.microsoft_account_enabled,
        true
      ),
    archived_at: normalizeNullableDate(
      userData.archived_at
    ),
    deactivated_at: normalizeNullableDate(
      userData.deactivated_at
    ),
  };
}

function extractUser(response) {
  return normalizeAuthenticatedUser(
    response?.data?.user || response?.data
  );
}

function readEmployeeViewPreference() {
  return (
    sessionStorage.getItem(
      EMPLOYEE_VIEW_STORAGE_KEY
    ) === "true"
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employeeView, setEmployeeView] = useState(
    readEmployeeViewPreference
  );

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(
      EMPLOYEE_VIEW_STORAGE_KEY
    );
    setUser(null);
    setEmployeeView(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await authApi.me();
    const currentUser = extractUser(response);

    setUser(currentUser);

    if (currentUser?.role === "user") {
      setEmployeeView(false);
      sessionStorage.removeItem(
        EMPLOYEE_VIEW_STORAGE_KEY
      );
    }

    return currentUser;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = localStorage.getItem(
        TOKEN_STORAGE_KEY
      );

      if (!token) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        const response = await authApi.me();
        const currentUser = extractUser(response);

        if (!cancelled) {
          setUser(currentUser);

          if (currentUser?.role === "user") {
            setEmployeeView(false);
            sessionStorage.removeItem(
              EMPLOYEE_VIEW_STORAGE_KEY
            );
          }
        }
      } catch (_error) {
        localStorage.removeItem(
          TOKEN_STORAGE_KEY
        );

        if (!cancelled) {
          setUser(null);
          setEmployeeView(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      const response = await authApi.login({
        email,
        password,
      });

      localStorage.setItem(
        TOKEN_STORAGE_KEY,
        response.data.token
      );

      const currentUser =
        normalizeAuthenticatedUser(
          response.data.user
        );

      setUser(currentUser);
      setEmployeeView(false);
      sessionStorage.removeItem(
        EMPLOYEE_VIEW_STORAGE_KEY
      );

      return currentUser;
    },
    []
  );

  const completeSso = useCallback(
    async (token) => {
      localStorage.setItem(
        TOKEN_STORAGE_KEY,
        token
      );

      try {
        const currentUser = await refreshUser();
        setEmployeeView(false);
        sessionStorage.removeItem(
          EMPLOYEE_VIEW_STORAGE_KEY
        );
        return currentUser;
      } catch (error) {
        clearLocalSession();
        throw error;
      }
    },
    [clearLocalSession, refreshUser]
  );

  const loginWithMicrosoft = useCallback(() => {
    window.location.assign(
      authApi.microsoftLoginUrl()
    );
  }, []);

  const signup = useCallback(
    async (name, email, password) => {
      const response = await authApi.signup({
        name,
        email,
        password,
      });

      clearLocalSession();
      return response.data;
    },
    [clearLocalSession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (_error) {
      // Local session removal is authoritative for this browser.
    } finally {
      clearLocalSession();
    }
  }, [clearLocalSession]);

  const enterEmployeeView = useCallback(() => {
    if (user?.role === "user") {
      return;
    }

    sessionStorage.setItem(
      EMPLOYEE_VIEW_STORAGE_KEY,
      "true"
    );
    setEmployeeView(true);
  }, [user?.role]);

  const exitEmployeeView = useCallback(() => {
    sessionStorage.removeItem(
      EMPLOYEE_VIEW_STORAGE_KEY
    );
    setEmployeeView(false);
  }, []);

  const effectiveExperience =
    user?.role === "user" || employeeView
      ? "employee"
      : "operations";

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      employeeView,
      effectiveExperience,
      login,
      signup,
      logout,
      completeSso,
      loginWithMicrosoft,
      refreshUser,
      enterEmployeeView,
      exitEmployeeView,
    }),
    [
      user,
      loading,
      employeeView,
      effectiveExperience,
      login,
      signup,
      logout,
      completeSso,
      loginWithMicrosoft,
      refreshUser,
      enterEmployeeView,
      exitEmployeeView,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
