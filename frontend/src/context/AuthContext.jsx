import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((res) => {
        const userData = res.data.user || res.data;
        setUser(userData);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });

    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);

    return res.data.user;
  };

  const signup = async (name, email, password) => {
    const res = await authApi.signup({ name, email, password });

    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);

    return res.data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_) {
      // ignore backend logout error in local dev
    } finally {
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);