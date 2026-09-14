import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";

// Landing page for REAL Microsoft Entra ID login only. Dev-login (the
// picker on LoginPage) never navigates here — it calls login() directly.
// This page's only job: grab the token the backend redirected here with,
// store it the same way dev-login does, then move on to the app.
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    login(token);
    navigate("/queue", { replace: true });
  }, [searchParams, login, navigate]);

  return (
    <div className="login-page">
      <p>Signing you in…</p>
    </div>
  );
}
