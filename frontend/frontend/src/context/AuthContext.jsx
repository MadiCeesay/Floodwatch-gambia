import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api, setAccessToken } from "../lib/api";
import { Loading } from "../components/Feedback";
import { AuthContext } from "./auth";
import { useAuth } from "../hooks/useAuth";
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialToken] = useState(() => {
    try {
      return sessionStorage.getItem("floodwatch-admin-token");
    } catch {
      return null;
    }
  });
  const [checking, setChecking] = useState(Boolean(initialToken));
  useEffect(() => {
    const expire = () => {
      setAccessToken(null);
      setUser(null);
      try {
        sessionStorage.removeItem("floodwatch-admin-token");
      } catch {
        /* Storage blocked */
      }
    };
    window.addEventListener("auth-expired", expire);
    const token = initialToken;
    let cancelled = false;
    if (token) {
      setAccessToken(token);
      api("/auth/me", { authenticated: true })
        .then((result) => {
          if (!cancelled) setUser(result.data);
        })
        .catch(expire)
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }
    return () => {
      cancelled = true;
      window.removeEventListener("auth-expired", expire);
    };
  }, [initialToken]);
  async function login(email, password) {
    const { data } = await api("/auth/login", {
      method: "POST",
      body: { email: email.trim(), password },
    });
    setAccessToken(data.token);
    try {
      sessionStorage.setItem("floodwatch-admin-token", data.token);
    } catch {
      /* Token stays in memory. */
    }
    const account = await api("/auth/me", { authenticated: true });
    setUser(account.data);
  }
  function logout() {
    window.dispatchEvent(new Event("auth-expired"));
  }
  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function RequireAdmin() {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Loading text="Checking your session…" />;
  return user?.role === "admin" ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  );
}
