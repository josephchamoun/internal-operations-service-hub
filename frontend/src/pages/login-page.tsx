import { type FormEvent, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Loading } from "../components/loading";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export function LoginPage() {
  const { user, ready, refresh, notice } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const microsoftUnavailable = params.get("microsoft") === "unavailable";
  const mutation = useMutation({
    mutationFn: async () => {
      await api("/auth/password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const signedIn = await refresh();
      if (!signedIn) {
        throw new Error("Sign-in did not start. Try again.");
      }
    },
  });
  if (!ready) return <Loading />;
  if (user) return <Navigate to="/queue" replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

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
            Microsoft sign-in is not configured on this server. Use email and
            password, or ask an admin to set the Azure AD environment variables.
          </p>
        )}
        {params.get("microsoft") === "failed" && (
          <p className="notice warning">
            Microsoft sign-in came back, but the session could not be started.
            Try again, or sign in with email and password.
          </p>
        )}

        <form className="form" onSubmit={submit}>
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {mutation.isError && (
            <p className="form-error">{mutation.error.message}</p>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <a className="btn microsoft" href={`${API_BASE_URL}/auth/login`}>
          Sign in with Microsoft
        </a>
      </Card>
    </div>
  );
}
