import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { useApiQuery } from "../../hooks/use-api-query";
import { useUserDirectory } from "../../hooks/use-user-directory";
import type { AccessLog } from "../../types";
import { Card } from "../../components/card";
import { ErrorState } from "../../components/error-state";
import { Loading } from "../../components/loading";
import { PersonLabel } from "../../components/person-label";

export function AccessLogsPage() {
  const { user } = useAuth();
  const { id = "" } = useParams();
  const people = useUserDirectory();
  const logs = useApiQuery<AccessLog[]>(
    ["access-logs", id],
    `/requests/${id}/access-logs`,
  );
  if (user?.role !== "admin")
    return <Navigate to={`/requests/${id}`} replace />;
  if (logs.isPending) return <Loading />;
  if (logs.isError)
    return <ErrorState error={logs.error} retry={() => logs.refetch()} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <Link to={`/requests/${id}`} className="back">
            ← Request
          </Link>
          <h1>Request access logs</h1>
          <p className="page-description">
            Who opened the full details of this request, and when. Requester
            views are not recorded. Repeat opens by the same person within an
            hour are not logged again.
          </p>
        </div>
      </div>
      <Card>
        <p className="request-count">
          {logs.data.length}{" "}
          {logs.data.length === 1 ? "logged view" : "logged views"}
        </p>
        <ul className="timeline">
          {logs.data.map((log) => (
            <li key={log.id}>
              <PersonLabel
                userId={log.userId}
                users={people.data}
                currentUserId={user?.userId}
              />
              <span>
                opened full details ·{" "}
                {new Date(log.accessedAt).toLocaleString()}
              </span>
            </li>
          ))}
          {logs.data.length === 0 && (
            <li className="muted">No logged external detail views.</li>
          )}
        </ul>
      </Card>
    </>
  );
}
