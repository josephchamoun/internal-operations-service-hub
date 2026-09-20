import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrentUser } from "./types";
import { api } from "./api/client";

type AuthState = {
  token: string | null;
  user: CurrentUser | null;
  notice: string | null;
  login: (token: string) => void;
  logout: (message?: string) => void;
  clearNotice: () => void;
};
const AuthContext = createContext<AuthState | null>(null);
const TOKEN_STORAGE_KEY = "ops-hub.access-token";

function decodeToken(token: string): CurrentUser {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Invalid login token");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const json = decodeURIComponent(
    atob(padded)
      .split("")
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join(""),
  );
  const parsed = JSON.parse(json) as CurrentUser;
  return {
    userId: parsed.userId,
    name: parsed.name,
    role: parsed.role,
    teamIds: parsed.teamIds ?? [],
  };
}

function restoreSession(): { token: string | null; user: CurrentUser | null } {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return { token: null, user: null };

  try {
    return { token, user: decodeToken(token) };
  } catch {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(restoreSession);
  const [notice, setNotice] = useState<string | null>(null);
  const logout = useCallback((message?: string) => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setSession({ token: null, user: null });
    setNotice(message ?? null);
  }, []);
  const refreshUser = useCallback(
    async (token: string) => {
      try {
        const live = await api<CurrentUser>("/auth/me", token);
        setSession((current) =>
          current.token === token ? { token, user: live } : current,
        );
      } catch {
        logout("Your session is no longer valid. Please sign in again.");
      }
    },
    [logout],
  );
  const login = useCallback(
    (nextToken: string) => {
      const nextUser = decodeToken(nextToken);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      setSession({ token: nextToken, user: nextUser });
      setNotice(null);
      void refreshUser(nextToken);
    },
    [refreshUser],
  );
  useEffect(() => {
    if (!session.token) return;
    const token = session.token;
    void refreshUser(token);
    const onFocus = () => void refreshUser(token);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session.token, refreshUser]);
  return (
    <AuthContext.Provider
      value={{
        token: session.token,
        user: session.user,
        notice,
        login,
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
