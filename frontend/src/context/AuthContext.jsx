/* oxlint-disable react/only-export-components -- The provider and its hook form one Context API module. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const AUTH_ME_URL = "http://localhost:3001/api/auth/me";
const AuthContext = createContext(null);
const bootstrapRequests = new Map();

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function getCurrentUser(token) {
  if (!bootstrapRequests.has(token)) {
    const request = axios.get(AUTH_ME_URL, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      window.setTimeout(() => bootstrapRequests.delete(token), 0);
    });
    bootstrapRequests.set(token, request);
  }

  return bootstrapRequests.get(token);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => readStoredUser());
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const skipNextTokenValidation = useRef(false);

  const clearAuthentication = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  useEffect(() => {
    let active = true;

    if (skipNextTokenValidation.current) {
      skipNextTokenValidation.current = false;
      setIsAuthLoading(false);
      return () => { active = false; };
    }

    if (!token) {
      setUser(null);
      setIsAuthLoading(false);
      return () => { active = false; };
    }

    setIsAuthLoading(true);
    getCurrentUser(token).then(({ data }) => {
      if (!active) return;
      setUser((currentUser) => ({ ...currentUser, ...data.user }));
      localStorage.setItem("user", JSON.stringify({ ...readStoredUser(), ...data.user }));
    }).catch((error) => {
      if (!active) return;
      if (error.response?.status === 401) clearAuthentication();
      else setUser(null);
    }).finally(() => {
      if (active) setIsAuthLoading(false);
    });

    return () => { active = false; };
  }, [clearAuthentication, token]);

  const login = useCallback((nextToken, nextUser) => {
    skipNextTokenValidation.current = true;
    setToken(nextToken);
    setUser(nextUser);
    setIsAuthLoading(false);
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
  }, []);

  const logout = useCallback(() => {
    clearAuthentication();
    setIsAuthLoading(false);
  }, [clearAuthentication]);

  const updateUser = useCallback((updates) => {
    setUser((currentUser) => {
      const nextUser = { ...currentUser, ...updates };
      localStorage.setItem("user", JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isAuthLoading,
    login,
    logout,
    updateUser
  }), [isAuthLoading, login, logout, token, updateUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
