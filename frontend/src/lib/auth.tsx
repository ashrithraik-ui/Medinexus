import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "./types";
import { api } from "./api";

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: Record<string, unknown>) => Promise<AuthUser>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("ll360_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: AuthUser }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("ll360_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      async login(email, password) {
        const data = await api<{ token: string; user: AuthUser }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem("ll360_token", data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      async register(payload) {
        const data = await api<{ token: string; user: AuthUser }>("/auth/register", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        localStorage.setItem("ll360_token", data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      logout() {
        localStorage.removeItem("ll360_token");
        setToken(null);
        setUser(null);
      },
    }),
    [user, token, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}

export function dashboardPath(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "AMBULANCE_DRIVER") return "/ambulance";
  if (role === "HOSPITAL_STAFF") return "/hospital";
  if (role === "TRAFFIC_CONTROL") return "/traffic";
  return "/login";
}
