"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { AuthResponse } from "@interface/shared";
import { api } from "@/lib/api";
import type { ApiResponse } from "@interface/shared";

interface AuthContextValue {
  user: AuthResponse["user"] | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved) {
      try {
        const parsed: AuthResponse = JSON.parse(saved);
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        localStorage.removeItem("auth");
      }
    }
    setLoading(false);
  }, []);

  const persist = (res: AuthResponse) => {
    localStorage.setItem("auth", JSON.stringify(res));
    setToken(res.token);
    setUser(res.user);
  };

  // Silent token refresh — every 6 days to stay within the 7-day window
  const REFRESH_INTERVAL = 6 * 24 * 60 * 60 * 1000;
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      return;
    }

    const doRefresh = async () => {
      try {
        const res = await api<ApiResponse<AuthResponse>>("/auth/refresh", {
          method: "POST",
        });
        persist(res.data);
      } catch {
        // Token invalid / expired — force logout
        localStorage.removeItem("auth");
        setToken(null);
        setUser(null);
      }
    };

    refreshTimer.current = setInterval(doRefresh, REFRESH_INTERVAL);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [token]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResponse> => {
      const res = await api<ApiResponse<AuthResponse>>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      persist(res.data);
      return res.data;
    },
    [],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await api<ApiResponse<AuthResponse>>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      persist(res.data);
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("auth");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, login, register, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
