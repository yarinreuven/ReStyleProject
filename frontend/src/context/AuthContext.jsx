/* oxlint-disable react/only-export-components -- The provider and its hook form one Context API module. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const AUTH_URL = `${API_BASE_URL}/auth`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const refreshPromiseRef = useRef(null);

  const clearAuthentication = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = axios.post(`${AUTH_URL}/refresh`, {}, { withCredentials: true })
        .then(({ data }) => {
          setToken(data.token);
          return data.token;
        })
        .finally(() => { refreshPromiseRef.current = null; });
    }
    return refreshPromiseRef.current;
  }, []);

  useEffect(() => {
    let active = true;
    refreshAccessToken()
      .then((nextToken) => axios.get(`${AUTH_URL}/me`, {
        headers: { Authorization: `Bearer ${nextToken}` }
      }))
      .then(({ data }) => { if (active) setUser(data.user); })
      .catch(() => { if (active) clearAuthentication(); })
      .finally(() => { if (active) setIsAuthLoading(false); });
    return () => { active = false; };
  }, [clearAuthentication, refreshAccessToken]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const request = error.config;
        const isAuthLifecycleRequest = request?.url?.includes("/api/auth/refresh") ||
          request?.url?.includes("/api/auth/login") ||
          request?.url?.includes("/api/auth/register") ||
          request?.url?.includes("/api/auth/google") ||
          request?.url?.includes("/api/auth/logout");
        if (error.response?.status !== 401 || request?._restyleRetried || isAuthLifecycleRequest) {
          return Promise.reject(error);
        }
        request._restyleRetried = true;
        try {
          const nextToken = await refreshAccessToken();
          request.headers = { ...request.headers, Authorization: `Bearer ${nextToken}` };
          return axios(request);
        } catch (refreshError) {
          clearAuthentication();
          return Promise.reject(refreshError);
        }
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [clearAuthentication, refreshAccessToken]);

  const login = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    setIsAuthLoading(false);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  const logout = useCallback(() => {
    axios.post(`${AUTH_URL}/logout`, {}, { withCredentials: true }).catch(() => {});
    clearAuthentication();
    setIsAuthLoading(false);
  }, [clearAuthentication]);

  const updateUser = useCallback((updates) => {
    setUser((currentUser) => ({ ...currentUser, ...updates }));
  }, []);

  const value = useMemo(() => ({
    user, token, isAuthenticated: Boolean(user && token), isAuthLoading,
    login, logout, updateUser
  }), [isAuthLoading, login, logout, token, updateUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
