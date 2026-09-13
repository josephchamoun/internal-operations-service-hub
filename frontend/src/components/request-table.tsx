import { Link } from "react-router-dom";
import type { RequestItem } from "../types";
import { Badge, StatusBadge } from "./badge";

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function RequestTable({
  requests,
  empty,
  currentUserId,
}: {
  requests: RequestItem[];
  empty: string;
  currentUserId?: string;
}) {
  return (
    <div className="request-table">
      <div className="request-columns" aria-hidden="true">
        <span>Request</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Claim</span>
        <span>Created</span>
      </div>
      {requests.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        requests.map((request) => (
          <Link
            className={`request-row${request.requesterId === currentUserId ? " request-row-own" : ""}`}
            to={`/requests/${request.id}`}
            key={request.id}
          >
            <div className="request-subject">
              <strong>{request.subject}</strong>
              <span>{request.categoryId}</span>
            </div>
            <StatusBadge status={request.status} />
            <Badge kind="priority" value={request.priorityId} />
            <span
              className={
                request.claimedBy ? "claim-state claimed" : "claim-state"
              }
            >
              {request.claimedBy === currentUserId
                ? "Claimed by you"
                : request.claimedBy
                  ? `Claimed · ${request.claimedBy}`
                  : "Unclaimed"}
            </span>
            <time>
              <span>Created</span>
              {formatDate(request.createdAt)}
            </time>
          </Link>
        ))
      )}
    </div>
  );
}
