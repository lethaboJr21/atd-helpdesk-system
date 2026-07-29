import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi } from "../services/api";

export const AuthContext = createContext(undefined);

function normalizeBoolean(value, fallbackValue = false) {
  if (value === undefined || value === null) {
    return fallbackValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalizedValue = String(value)
    .trim()
    .toLowerCase();

  return ["true", "1", "yes"].includes(normalizedValue);
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

  // Backward compatibility for older /auth/me responses that omitted status.
  // The refined backend now returns status explicitly.
  const status = rawStatus || (approved ? "active" : "inactive");

  return {
    ...userData,
    role: String(userData.role || "user")
      .trim()
      .toLowerCase(),
    approved,
    status,
    microsoft_account_enabled: normalizeBoolean(
      userData.microsoft_account_enabled,
      true
    ),
    archived_at: userData.archived_at || null,
  };
}

function extractUser(response) {
  return normalizeAuthenticatedUser(
    response?.data?.user || response?.data
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const response = await authApi.me();
    const currentUser = extractUser(response);

    setUser(currentUser);
    return currentUser;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = localStorage.getItem("token");

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
        }
      } catch (_error) {
        localStorage.removeItem("token");

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await authApi.login({
      email,
      password,
    });

    localStorage.setItem(
      "token",
      response.data.token
    );

    const currentUser = normalizeAuthenticatedUser(
      response.data.user
    );

    setUser(currentUser);
    return currentUser;
  }, []);

  const completeSso = useCallback(async (token) => {
    localStorage.setItem("token", token);

    try {
      return await refreshUser();
    } catch (error) {
      localStorage.removeItem("token");
      setUser(null);
      throw error;
    }
  }, [refreshUser]);

  const loginWithMicrosoft = useCallback(() => {
    window.location.assign(
      authApi.microsoftLoginUrl()
    );
  }, []);

  const signup = useCallback(async (
    name,
    email,
    password
  ) => {
    const response = await authApi.signup({
      name,
      email,
      password,
    });

    localStorage.removeItem("token");
    setUser(null);

    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (_error) {
      // Always clear the local session, even if the API is unavailable.
    } finally {
      localStorage.removeItem("token");
      setUser(null);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      completeSso,
      loginWithMicrosoft,
      refreshUser,
    }),
    [
      user,
      loading,
      login,
      signup,
      logout,
      completeSso,
      loginWithMicrosoft,
      refreshUser,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
