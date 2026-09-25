import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Card } from "../components/card";

// Landing page for Microsoft Entra ID login. The backend has already set
// the session cookie before redirecting here. This page asks who is signed
// in, then moves on.
export function AuthCallbackPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void refresh().then((user) => {
      navigate(user ? "/" : "/login?microsoft=failed", { replace: true });
    });
  }, [refresh, navigate]);

  return (
    <div className="login-callback">
      <Card className="login-card">
        <div className="loading">Signing you in…</div>
      </Card>
    </div>
  );
}
