import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import type { Category, Priority, RequestItem, Team } from "../types";
import { Badge, StatusBadge } from "../components/badge";
import { Card } from "../components/card";
import { ErrorState } from "../components/error-state";
import { Loading } from "../components/loading";
import { ReassignForm } from "../components/reassign-form";
import { SilenceToggle } from "../components/silence-toggle";
import { PersonLabel } from "../components/person-label";
import { useUserDirectory } from "../hooks/use-user-directory";

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function LimitedRequestPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const request = useApiQuery<RequestItem>(["request", id], `/requests/${id}`);
  const people = useUserDirectory();
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const categories = useApiQuery<Category[]>(["categories"], "/categories");
  const priorities = useApiQuery<Priority[]>(["priorities"], "/priorities");

  const userId = user?.userId;
  useEffect(() => {
    if (!userId) return;
    const stream = new EventSource(apiUrl(`/requests/${id}/stream`), {
      withCredentials: true,
    });
    stream.onmessage = () => {
      void client.invalidateQueries({ queryKey: ["request", id] });
    };
    return () => stream.close();
  }, [id, userId, client]);

  if (
    request.isPending ||
    teams.isPending ||
    categories.isPending ||
    priorities.isPending ||
    people.isPending
  )
    return <Loading />;
  if (request.isError)
    return <ErrorState error={request.error} retry={() => request.refetch()} />;

  const item = request.data;
  if (user?.userId === item.requesterId) {
    return <Navigate to={`/requests/${id}/full`} replace />;
  }
  const isTeamMember = !!user?.teamIds.includes(item.owningTeamId);
  const canSilence =
    isTeamMember && item.status === "New" && !item.claimedBy;
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
            <Badge
              kind="priority"
              value={
                priorities.data?.find((p) => p.id === item.priorityId)?.name ??
                item.priorityId
              }
            />
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
            <dd>
              {categories.data?.find((c) => c.id === item.categoryId)?.name ??
                item.categoryId}
            </dd>
            <dt>Requester</dt>
            <dd>
              <PersonLabel
                userId={item.requesterId}
                users={people.data}
                currentUserId={user?.userId}
              />
            </dd>
            <dt>Owning team</dt>
            <dd>
              {teams.data?.find((t) => t.id === item.owningTeamId)?.name ??
                item.owningTeamId}
            </dd>
            <dt>Created</dt>
            <dd>{formatDate(item.createdAt)}</dd>
            <dt>Claimant</dt>
            <dd>
              <PersonLabel
                userId={item.claimedBy}
                users={people.data}
                currentUserId={user?.userId}
              />
            </dd>
          </dl>
          <div className="detail-links">
            <Link className="btn" to={`/requests/${id}/full`}>
              View full details
            </Link>
            <Link className="btn secondary" to={`/requests/${id}/events`}>
              View request events
            </Link>
            {user?.role === "admin" && (
              <Link className="btn secondary" to={`/requests/${id}/access-logs`}>
                Access logs
              </Link>
            )}
          </div>
        </Card>
        {isTeamMember && teams.data && categories.data && (
          <Card className="actions-card">
            <h2>Actions</h2>
            <ReassignForm
              request={item}
              teams={teams.data}
              categories={categories.data}
            />
            <SilenceToggle requestId={id} enabled={canSilence} />
          </Card>
        )}
      </div>
    </>
  );
}
