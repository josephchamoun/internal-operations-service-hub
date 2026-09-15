import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { useApiQuery } from "../../hooks/use-api-query";
import type { AccessLog } from "../../types";
import { Card } from "../../components/card";
import { ErrorState } from "../../components/error-state";
import { Loading } from "../../components/loading";

export function AccessLogsPage() {
  const { user } = useAuth();
  const { id = "" } = useParams();
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
          <Link to={`/requests/${id}/full`} className="back">
            ← Full request
          </Link>
          <h1>Request access logs</h1>
          <p className="page-description">
            Who opened the full details of this request, and when. Requester
            views are not recorded.
          </p>
        </div>
      </div>
      <Card>
        <ul className="timeline">
          {logs.data.map((log) => (
            <li key={log.id}>
              <strong>{log.userId}</strong>
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
