import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // ✅ Stores the currently logged-in user
  const [user, setUser] = useState(null);

  // ✅ Prevents route flicker while session is being restored
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Restore session from localStorage token
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((res) => {
        // ✅ Accept either { user } or direct user response
        const userData = res.data.user || res.data;
        setUser(userData);
      })
      .catch(() => {
        // ✅ If token is invalid, clear session
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // ✅ Login authenticates approved users only
  const login = async (email, password) => {
    const res = await authApi.login({ email, password });

    // ✅ Store JWT only after successful login
    localStorage.setItem("token", res.data.token);

    // ✅ Store logged-in user
    setUser(res.data.user);

    return res.data.user;
  };

  // ✅ Signup creates account only.
  // ✅ It must NOT log the user in.
  // ✅ Pending users must wait for admin approval.
  const signup = async (name, email, password) => {
    const res = await authApi.signup({
      name,
      email,
      password,
    });

    // ✅ Make sure signup does not authenticate pending users
    localStorage.removeItem("token");
    setUser(null);

    return res.data;
  };

  // ✅ Logout clears frontend session
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_) {
      // ✅ Ignore backend logout errors in local dev
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