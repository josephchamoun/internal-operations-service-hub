import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrentUser } from "./types";
import { api } from "./api/client";

type AuthState = {
  user: CurrentUser | null;
  ready: boolean;
  notice: string | null;
  refresh: () => Promise<CurrentUser | null>;
  logout: (message?: string) => void;
  clearNotice: () => void;
};
const AuthContext = createContext<AuthState | null>(null);
const LEGACY_TOKEN_KEY = "ops-hub.access-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const live = await api<CurrentUser>("/auth/me");
      setUser(live);
      setNotice(null);
      return live;
    } catch {
      setUser(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  const logout = useCallback((message?: string) => {
    void api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setReady(true);
    setNotice(message ?? null);
  }, []);

  useEffect(() => {
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        notice,
        refresh,
        logout,
        clearNotice: () => setNotice(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
