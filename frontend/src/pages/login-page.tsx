import { Navigate } from "react-router-dom";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { Button } from "../components/button";
import { Card } from "../components/card";

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

export function LoginPage() {
  const { token, login, notice } = useAuth();
  const [userId, setUserId] = useState(testUsers[0][0]);
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
    <div className="login-page">
      <Card className="login-card">
        <div className="eyebrow">Internal Operations Service Hub</div>
        <h1>Sign in for testing</h1>
        <p>Pick a seeded identity to use the development login.</p>
        {notice && <p className="notice">{notice}</p>}
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
          {mutation.isPending ? "Logging in…" : "Log in"}
        </Button>
      </Card>
    </div>
  );
}
