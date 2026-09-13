import { createContext, useContext, useState, type ReactNode } from "react";
import type { CurrentUser } from "./types";

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
  const json = decodeURIComponent(
    atob(normalized)
      .split("")
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join(""),
  );
  return JSON.parse(json) as CurrentUser;
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
  const login = (nextToken: string) => {
    const nextUser = decodeToken(nextToken);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setSession({ token: nextToken, user: nextUser });
    setNotice(null);
  };
  const logout = (message?: string) => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setSession({ token: null, user: null });
    setNotice(message ?? null);
  };
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
