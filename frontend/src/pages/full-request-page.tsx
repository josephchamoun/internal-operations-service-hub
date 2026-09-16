import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { ReassignForm } from "../components/reassign-form";

const statuses: RequestStatus[] = ["New", "In Progress", "Resolved"];

export function FullRequestPage() {
  const { id = "" } = useParams();
  const { token, user } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const preview = useApiQuery<RequestItem>(["request", id], `/requests/${id}`);
  const [acknowledgedFullView, setAcknowledgedFullView] = useState(false);
  const isRequesterPreview = user?.userId === preview.data?.requesterId;
  const isOwningTeamPreview = !!user?.teamIds.includes(
    preview.data?.owningTeamId ?? "",
  );
  const needsMisrouteWarning =
    !!preview.data &&
    !isRequesterPreview &&
    (isOwningTeamPreview || user?.role === "admin");
  const detail = useApiQuery<RequestItem>(
    ["full-request", id],
    `/requests/${id}/full`,
    !!preview.data && (!needsMisrouteWarning || acknowledgedFullView),
  );
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const categories = useApiQuery<Category[]>(["categories"], "/categories");
  const priorities = useApiQuery<Priority[]>(["priorities"], "/priorities");
  const [status, setStatus] = useState<RequestStatus>("In Progress");
  const [priorityId, setPriorityId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["full-request", id] });
    void client.invalidateQueries({ queryKey: ["request", id] });
    void client.invalidateQueries({ queryKey: ["requests"] });
    void client.invalidateQueries({ queryKey: ["mine"] });
  };
  useEffect(() => {
    if (!detail.data) return;
    setEditSubject(detail.data.subject);
    setEditDescription(detail.data.description ?? "");
  }, [detail.data]);
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
    onSuccess: (_data, variables) => {
      refresh();
      if (variables.path.endsWith("/details")) {
        setEditing(false);
      }
      // Reassigning moves the request to a different team's ownership.
      // The actor who reassigned it (on the *old* owning team) typically
      // loses view access the moment that happens, unless they're also
      // the requester or an admin — so staying on this page just means
      // immediately hitting the 403 ErrorState below. Send them back to
      // the queue instead, where the request will no longer appear.
      if (variables.path.endsWith("/reassign")) {
        navigate("/queue");
      }
    },
  });
  if (preview.isPending || teams.isPending || categories.isPending)
    return <Loading />;
  if (preview.isError)
    return <ErrorState error={preview.error} retry={() => preview.refetch()} />;
  if (needsMisrouteWarning && !acknowledgedFullView) {
    const request = preview.data;
    return (
      <>
        <div className="page-heading detail-title">
          <div>
            <Link to={`/requests/${id}`} className="back">
              ← Limited view
            </Link>
            <h1>{request.subject}</h1>
          </div>
        </div>
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <Card className="modal-card">
            <p className="eyebrow">Before you open this</p>
            <h2>Check that this request is for your team</h2>
            <p>
              Please read the request&apos;s subject and make sure this request
              is really intended for your team. If it is not, reassign it to
              the correct team — you do not need to open the full details
              first.
            </p>
            <p className="notice warning">
              Subject: <strong>{request.subject}</strong>
            </p>
            {isOwningTeamPreview && (
              <ReassignForm
                request={request}
                teams={teams.data ?? []}
                categories={categories.data ?? []}
                token={token}
              />
            )}
            <div className="detail-links">
              <Button
                className="secondary"
                onClick={() => navigate(`/requests/${id}`)}
              >
                Go back
              </Button>
              <Button onClick={() => setAcknowledgedFullView(true)}>
                This is for my team — open full details
              </Button>
            </div>
          </Card>
        </div>
      </>
    );
  }
  if (detail.isPending || priorities.isPending) return <Loading />;
  if (detail.isError)
    return <ErrorState error={detail.error} retry={() => detail.refetch()} />;
  const request = detail.data;
  const isLimited = !("description" in request);
  const isTeamMember = !!user?.teamIds.includes(request.owningTeamId);
  const isRequester = user?.userId === request.requesterId;
  const isClaimant = user?.userId === request.claimedBy;
  const isActive = !["Resolved", "Cancelled"].includes(request.status);
  const canMakeAction = isActive && (isTeamMember || isRequester);
  const canEdit =
    isRequester &&
    request.status === "New" &&
    !request.claimedBy &&
    !isLimited;
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
          <h2>Full request</h2>
          {isLimited ? (
            <p className="notice">
              Limited view — you are not on the owning team for this request.
            </p>
          ) : editing ? (
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                action.mutate({
                  path: `/requests/${id}/details`,
                  body: {
                    subject: editSubject,
                    description: editDescription,
                  },
                });
              }}
            >
              <label>
                Subject
                <input
                  value={editSubject}
                  onChange={(event) => setEditSubject(event.target.value)}
                  required
                  maxLength={200}
                />
              </label>
              <label>
                Description
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  required
                  rows={7}
                />
              </label>
              {action.isError && (
                <p className="form-error">{action.error.message}</p>
              )}
              <div className="actions">
                <Button type="submit" disabled={action.isPending}>
                  {action.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditing(false);
                    setEditSubject(request.subject);
                    setEditDescription(request.description ?? "");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className="description">{request.description}</p>
          )}
          {canEdit && !editing && (
            <div className="detail-links">
              <Button
                className="secondary"
                onClick={() => {
                  setEditSubject(request.subject);
                  setEditDescription(request.description ?? "");
                  setEditing(true);
                }}
              >
                Edit details
              </Button>
            </div>
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
              {isTeamMember && teams.data && categories.data && (
                <ReassignForm
                  request={request}
                  teams={teams.data}
                  categories={categories.data}
                  token={token}
                />
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
                    disabled={
                      (priorityId || request.priorityId) === request.priorityId
                    }
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
