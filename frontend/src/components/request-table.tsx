import { Link } from "react-router-dom";
import type { Category, Priority, RequestItem } from "../types";
import type { DirectoryUser } from "../lib/directory";
import { Badge, StatusBadge } from "./badge";
import { PersonLabel } from "./person-label";

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
  users,
  categories,
  priorities,
}: {
  requests: RequestItem[];
  empty: string;
  currentUserId?: string;
  users?: DirectoryUser[];
  categories?: Category[];
  priorities?: Priority[];
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
        <p className="empty-state">{empty}</p>
      ) : (
        requests.map((request) => {
          const isMine = request.claimedBy === currentUserId;
          const isSubmittedByMe = request.requesterId === currentUserId;
          const rowClass = [
            "request-row",
            isMine && "request-row-claimed",
            !isMine && isSubmittedByMe && "request-row-own",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <Link
              className={rowClass}
              to={`/requests/${request.id}`}
              key={request.id}
            >
              <div className="request-subject">
                <strong>
                  {isMine && (
                    <span
                      className="mine-mark"
                      title="Claimed by you"
                      aria-hidden="true"
                    >
                      ●
                    </span>
                  )}
                  {request.subject}
                </strong>
                <span>
                  {categories?.find((item) => item.id === request.categoryId)
                    ?.name ?? request.categoryId}
                  {isMine && <em className="mine-label"> · yours</em>}
                  {!isMine && isSubmittedByMe && (
                    <em className="mine-label"> · you submitted</em>
                  )}
                </span>
              </div>
              <StatusBadge status={request.status} />
              <Badge
                kind="priority"
                value={
                  priorities?.find((item) => item.id === request.priorityId)
                    ?.name ?? request.priorityId
                }
              />
              <span
                className={
                  request.claimedBy ? "claim-state claimed" : "claim-state"
                }
              >
                {request.claimedBy ? (
                  request.claimedBy === currentUserId ? (
                    "Claimed by you"
                  ) : (
                    <>
                      Claimed ·{" "}
                      <PersonLabel
                        userId={request.claimedBy}
                        users={users}
                        currentUserId={currentUserId}
                      />
                    </>
                  )
                ) : (
                  "Unclaimed"
                )}
              </span>
              <time>
                <span>Created</span>
                {formatDate(request.createdAt)}
              </time>
            </Link>
          );
        })
      )}
    </div>
  );
}
