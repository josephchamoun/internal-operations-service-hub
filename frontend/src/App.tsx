import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/layout";
import { Loading } from "./components/loading";
import { LoginPage } from "./pages/login-page";
import { RequestListPage } from "./pages/requests-list-page";
import { NewRequestPage } from "./pages/new-request-page";
import { LimitedRequestPage } from "./pages/limited-request-page";
import { FullRequestPage } from "./pages/full-request-page";
import { RequestEventsPage } from "./pages/request-events-page";
import { AccessLogsPage } from "./pages/admin/access-logs-page";
import { UsersPage } from "./pages/admin/users-page";
import { TeamsPage } from "./pages/admin/teams-page";
import { CategoriesPage } from "./pages/admin/categories-page";
import { PrioritiesPage } from "./pages/admin/priorities-page";
import { AuthCallbackPage } from "./pages/auth-callback-page";
import { AnalyticsPage } from "./pages/analytics-page";

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.role === "admin" ? children : <Navigate to="/" replace />;
}

// A "queue" (the team/admin-wide request list) only means anything for an
// admin or a user who's actually on a team. An employee with no team sees
// the exact same data on /mine, so /queue is redirected away for them
// rather than shown as a redundant page.
function HasQueue({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const hasQueue = user?.role === "admin" || (user?.teamIds?.length ?? 0) > 0;
  return hasQueue ? children : <Navigate to="/mine" replace />;
}

function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  const hasQueue = user.role === "admin" || (user.teamIds?.length ?? 0) > 0;
  return <Navigate to={hasQueue ? "/queue" : "/mine"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<Home />} />
      <Route
        path="/queue"
        element={
          <Protected>
            <HasQueue>
              <RequestListPage />
            </HasQueue>
          </Protected>
        }
      />
      <Route
        path="/mine"
        element={
          <Protected>
            <RequestListPage mine />
          </Protected>
        }
      />
      <Route
        path="/new"
        element={
          <Protected>
            <NewRequestPage />
          </Protected>
        }
      />
      <Route
        path="/requests/:id"
        element={
          <Protected>
            <LimitedRequestPage />
          </Protected>
        }
      />
      <Route
        path="/requests/:id/full"
        element={
          <Protected>
            <FullRequestPage />
          </Protected>
        }
      />
      <Route
        path="/requests/:id/events"
        element={
          <Protected>
            <RequestEventsPage />
          </Protected>
        }
      />
      <Route
        path="/requests/:id/access-logs"
        element={
          <Protected>
            <AccessLogsPage />
          </Protected>
        }
      />

      <Route
        path="/analytics"
        element={
          <Protected>
            <AnalyticsPage />
          </Protected>
        }
      />

      <Route
        path="/admin/users"
        element={
          <Protected>
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/teams"
        element={
          <Protected>
            <AdminOnly>
              <TeamsPage />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <Protected>
            <AdminOnly>
              <CategoriesPage />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/priorities"
        element={
          <Protected>
            <AdminOnly>
              <PrioritiesPage />
            </AdminOnly>
          </Protected>
        }
      />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
