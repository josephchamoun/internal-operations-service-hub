import { Navigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { Button } from "../components/button";
import { Card } from "../components/card";

// TEST-ONLY — safe to delete this array and the picker UI below before any
// real deployment. Corresponds to POST /auth/dev-login on the backend,
// which is itself gated off when NODE_ENV=production.
const testUsers = [
  ["u1", "Alice Employee (Employee)"],
  ["u2", "Ben Employee (Employee)"],
  ["it-agent-1", "Sam IT (IT team member)"],
  ["it-agent-2", "Riley IT (IT team member)"],
  ["hr-agent-1", "Maya HR (HR team member)"],
  ["admin-1", "Jordan Admin (Admin)"],
  ["main-agent-1", "HR/IT agent (IT + HR team member)"],
  ["dev-manager", "Dev Manager (IT team member, test)"],
  ["dev-employee", "Dev Employee (Employee, test)"],
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export function LoginPage() {
  const { token, login, notice } = useAuth();
  const [params] = useSearchParams();
  const [userId, setUserId] = useState(testUsers[0][0]);
  const microsoftUnavailable = params.get("microsoft") === "unavailable";
  const mutation = useMutation({
    mutationFn: () =>
      api<{ accessToken: string }>("/auth/dev-login", undefined, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: ({ accessToken }) => login(accessToken),
  });
  if (token) return <Navigate to="/queue" replace />;
  return (
    <div className="login-shell">
      <aside className="login-intro">
        <div className="brand-mark" aria-hidden="true">
          OH
        </div>
        <p className="eyebrow">Internal operations</p>
        <h1>One place for every internal request</h1>
        <p>
          Submit once, land with the right team, and follow the work until it is
          resolved — without losing it in chat or the wrong inbox.
        </p>
      </aside>
      <Card className="login-card">
        <p className="eyebrow">Welcome back</p>
        <h2>Sign in</h2>
        {notice && <p className="notice">{notice}</p>}
        {microsoftUnavailable && (
          <p className="notice warning">
            Microsoft sign-in is not configured on this server. Use a test
            identity below, or ask an admin to set the Azure AD environment
            variables.
          </p>
        )}
        {params.get("microsoft") === "failed" && (
          <p className="notice warning">
            Microsoft sign-in came back, but the session could not be started.
            Try again, or use a test identity.
          </p>
        )}

        {/* REAL AUTHENTICATION — Microsoft Entra ID. This is the actual
            login path; keep this when the test picker below is removed. */}
        <a className="btn microsoft" href={`${API_BASE_URL}/auth/login`}>
          Sign in with Microsoft
        </a>

        <div className="login-divider">
          <span>or continue with a test identity</span>
        </div>

        {/* TEST-ONLY LOGIN — see comment on testUsers above. */}
        <label>
          Test identity
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {testUsers.map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {mutation.isError && (
          <p className="form-error">{mutation.error.message}</p>
        )}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Logging in…" : "Log in (test)"}
        </Button>
      </Card>
    </div>
  );
}
