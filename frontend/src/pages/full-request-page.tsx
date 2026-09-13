import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiUrl } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import type {
  Category,
  Priority,
  RequestItem,
  RequestStatus,
  Team,
} from "../types";
import { Badge, StatusBadge } from "../components/badge";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { ErrorState } from "../components/error-state";
import { Loading } from "../components/loading";

const statuses: RequestStatus[] = ["New", "In Progress", "Resolved"];

export function FullRequestPage() {
  const { id = "" } = useParams();
  const { token, user } = useAuth();
  const client = useQueryClient();
  const detail = useApiQuery<RequestItem>(
    ["full-request", id],
    `/requests/${id}/full`,
  );
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const categories = useApiQuery<Category[]>(["categories"], "/categories");
  const priorities = useApiQuery<Priority[]>(["priorities"], "/priorities");
  const [status, setStatus] = useState<RequestStatus>("In Progress");
  const [teamId, setTeamId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["full-request", id] });
    void client.invalidateQueries({ queryKey: ["request", id] });
    void client.invalidateQueries({ queryKey: ["requests"] });
    void client.invalidateQueries({ queryKey: ["mine"] });
  };
  useEffect(() => {
    if (!token) return;
    const stream = new EventSource(
      apiUrl(`/requests/${id}/stream?token=${encodeURIComponent(token)}`),
    );
    stream.onmessage = refresh;
    return () => stream.close();
  }, [id, token]);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) =>
      api<RequestItem>(path, token, {
        method: "PATCH",
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    onSuccess: refresh,
  });
  if (
    detail.isPending ||
    teams.isPending ||
    categories.isPending ||
    priorities.isPending
  )
    return <Loading />;
  if (detail.isError)
    return <ErrorState error={detail.error} retry={() => detail.refetch()} />;
  const request = detail.data;
  const isLimited = !("description" in request);
  const isTeamMember = !!user?.teamIds.includes(request.owningTeamId);
  const isRequester = user?.userId === request.requesterId;
  const isClaimant = user?.userId === request.claimedBy;
  const isActive = !["Resolved", "Cancelled"].includes(request.status);
  const canMakeAction = isActive && (isTeamMember || isRequester);
  return (
    <>
      <div className="page-heading detail-title">
        <div>
          <Link to={`/requests/${id}`} className="back">
            ← Limited view
          </Link>
          <h1>{request.subject}</h1>
          <div className="badges">
            <StatusBadge status={request.status} />
            <Badge kind="priority" value={request.priorityId} />
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <Card>
          <h2>Full request view</h2>
          {isLimited ? (
            <p className="notice">
              Limited view — you are not on the owning team for this request.
            </p>
          ) : (
            <p className="description">{request.description}</p>
          )}
          <dl>
            <dt>Category</dt>
            <dd>{request.categoryId}</dd>
            <dt>Requester</dt>
            <dd>{request.requesterId}</dd>
            <dt>Owning team</dt>
            <dd>{request.owningTeamId}</dd>
            <dt>Claimant</dt>
            <dd>{request.claimedBy ?? "Unclaimed"}</dd>
          </dl>
          <div className="detail-links">
            <Link className="btn secondary" to={`/requests/${id}/events`}>
              View request events
            </Link>
            {user?.role === "admin" && (
              <Link
                className="btn secondary"
                to={`/requests/${id}/access-logs`}
              >
                View access logs
              </Link>
            )}
          </div>
        </Card>
        {canMakeAction && (
          <Card className="actions-card">
            <h2>Actions</h2>
            {action.isError && (
              <p className="form-error">{action.error.message}</p>
            )}
            <div className="actions">
              {isTeamMember && !request.claimedBy && (
                <Button
                  onClick={() =>
                    action.mutate({ path: `/requests/${id}/claim` })
                  }
                >
                  Claim request
                </Button>
              )}
              {isClaimant && (
                <Button
                  className="secondary"
                  onClick={() =>
                    action.mutate({ path: `/requests/${id}/unclaim` })
                  }
                >
                  Unclaim
                </Button>
              )}
              {isClaimant && (
                <div className="action-group">
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as RequestStatus)
                    }
                  >
                    {statuses.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() =>
                      action.mutate({
                        path: `/requests/${id}/status`,
                        body: { status },
                      })
                    }
                  >
                    Change status
                  </Button>
                </div>
              )}
              {isRequester && (
                <Button
                  className="danger"
                  onClick={() =>
                    action.mutate({ path: `/requests/${id}/cancel` })
                  }
                >
                  Cancel request
                </Button>
              )}
              {isTeamMember && (
                <div className="action-group stacked">
                  <strong>Reassign</strong>
                  <select
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                  >
                    <option value="">Select target team</option>
                    {teams.data
                      ?.filter((team) => team.id !== request.owningTeamId)
                      .map((team) => (
                        <option value={team.id} key={team.id}>
                          {team.name}
                        </option>
                      ))}
                  </select>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <option value="">Category (optional)</option>
                    {categories.data?.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!teamId}
                    onClick={() =>
                      action.mutate({
                        path: `/requests/${id}/reassign`,
                        body: {
                          newTeamId: teamId,
                          ...(categoryId ? { categoryId } : {}),
                        },
                      })
                    }
                  >
                    Reassign
                  </Button>
                </div>
              )}
              {isTeamMember && (
                <div className="action-group">
                  <select
                    value={priorityId || request.priorityId}
                    onChange={(event) => setPriorityId(event.target.value)}
                  >
                    {priorities.data?.map((priority) => (
                      <option value={priority.id} key={priority.id}>
                        {priority.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    className="secondary"
                    onClick={() =>
                      action.mutate({
                        path: `/requests/${id}/priority`,
                        body: { priorityId: priorityId || request.priorityId },
                      })
                    }
                  >
                    Change priority
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
      {!canMakeAction && (
        <p className="action-unavailable">
          {isActive
            ? "No actions are available for your role on this request."
            : `This request is ${request.status.toLowerCase()} and no further actions can be made.`}
        </p>
      )}
    </>
  );
}
