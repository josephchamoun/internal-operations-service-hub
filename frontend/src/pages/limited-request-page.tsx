import { Link, useParams } from "react-router-dom";
import { useApiQuery } from "../hooks/use-api-query";
import type { RequestItem } from "../types";
import { Badge, StatusBadge } from "../components/badge";
import { Card } from "../components/card";
import { ErrorState } from "../components/error-state";
import { Loading } from "../components/loading";

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function LimitedRequestPage() {
  const { id = "" } = useParams();
  const request = useApiQuery<RequestItem>(["request", id], `/requests/${id}`);

  if (request.isPending) return <Loading />;
  if (request.isError)
    return <ErrorState error={request.error} retry={() => request.refetch()} />;

  const item = request.data;
  return (
    <>
      <div className="page-heading detail-title">
        <div>
          <Link to="/queue" className="back">
            ← Requests
          </Link>
          <h1>{item.subject}</h1>
          <div className="badges">
            <StatusBadge status={item.status} />
            <Badge kind="priority" value={item.priorityId} />
          </div>
        </div>
      </div>
      <Card>
        <h2>Limited request view</h2>
        <p className="notice">
          This view intentionally excludes the request description and sensitive
          details.
        </p>
        <dl>
          <dt>Category</dt>
          <dd>{item.categoryId}</dd>
          <dt>Requester</dt>
          <dd>{item.requesterId}</dd>
          <dt>Owning team</dt>
          <dd>{item.owningTeamId}</dd>
          <dt>Created</dt>
          <dd>{formatDate(item.createdAt)}</dd>
          <dt>Claimant</dt>
          <dd>{item.claimedBy ?? "Unclaimed"}</dd>
        </dl>
        <div className="detail-links">
          <Link className="btn" to={`/requests/${id}/full`}>
            View full details
          </Link>
          <Link className="btn secondary" to={`/requests/${id}/events`}>
            View request events
          </Link>
        </div>
      </Card>
    </>
  );
}
