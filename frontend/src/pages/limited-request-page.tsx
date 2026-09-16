import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import type { Category, RequestItem, Team } from "../types";
import { Badge, StatusBadge } from "../components/badge";
import { Card } from "../components/card";
import { ErrorState } from "../components/error-state";
import { Loading } from "../components/loading";
import { ReassignForm } from "../components/reassign-form";

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function LimitedRequestPage() {
  const { id = "" } = useParams();
  const { token, user } = useAuth();
  const client = useQueryClient();
  const request = useApiQuery<RequestItem>(["request", id], `/requests/${id}`);
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const categories = useApiQuery<Category[]>(["categories"], "/categories");

  useEffect(() => {
    if (!token) return;
    const stream = new EventSource(
      apiUrl(`/requests/${id}/stream?token=${encodeURIComponent(token)}`),
    );
    stream.onmessage = () => {
      void client.invalidateQueries({ queryKey: ["request", id] });
    };
    return () => stream.close();
  }, [id, token, client]);

  if (request.isPending || teams.isPending || categories.isPending)
    return <Loading />;
  if (request.isError)
    return <ErrorState error={request.error} retry={() => request.refetch()} />;

  const item = request.data;
  const isTeamMember = !!user?.teamIds.includes(item.owningTeamId);
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
      <div className="detail-grid">
        <Card>
          <h2>Limited request view</h2>
          <p className="notice">
            Only category, subject, and routing are shown here so a misrouted
            request can be recognized without opening sensitive details.
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
        {isTeamMember && teams.data && categories.data && (
          <Card className="actions-card">
            <h2>Actions</h2>
            <ReassignForm
              request={item}
              teams={teams.data}
              categories={categories.data}
              token={token}
            />
          </Card>
        )}
      </div>
    </>
  );
}
