import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import { Card } from "../components/card";
import { Loading } from "../components/loading";
import { RequestTable } from "../components/request-table";
import { ErrorState } from "../components/error-state";
import type { RequestItem, RequestStatus, Team } from "../types";

const statuses: RequestStatus[] = [
  "New",
  "In Progress",
  "Resolved",
  "Cancelled",
];
export function RequestListPage({ mine = false }: { mine?: boolean }) {
  const { user } = useAuth();
  const query = useApiQuery<RequestItem[]>(
    [mine ? "mine" : "requests"],
    mine ? "/requests/mine" : "/requests",
  );
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const [status, setStatus] = useState("");
  const [team, setTeam] = useState("");
  const [claimState, setClaimState] = useState("all");
  if (query.isPending || teams.isPending) return <Loading />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const shown = query.data.filter(
    (r) =>
      ((!status || r.status === status) &&
        (!team || r.owningTeamId === team) &&
        (!claimState || claimState === "all")) ||
      (claimState === "unclaimed" && !r.claimedBy) ||
      (claimState === "mine" && r.claimedBy === user?.userId) ||
      (claimState === "other" && !!r.claimedBy && r.claimedBy !== user?.userId),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {mine
              ? "Your submitted work"
              : user?.role === "admin"
                ? "All requests"
                : "Team queue"}
          </div>
          <h1>{mine ? "My requests" : "Requests"}</h1>
          {!mine && user?.role === "employee" && (
            <p className="page-description">
              This is your personal request queue. As an employee, it contains
              the same requests as My requests; use this page to track their
              handling status.
            </p>
          )}
        </div>
        <Link className="btn" to="/new">
          New request
        </Link>
      </div>
      <Card>
        <div className="filters">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Claimed
            <select
              value={claimState}
              onChange={(event) => setClaimState(event.target.value)}
            >
              <option value="all">All requests</option>
              <option value="unclaimed">Unclaimed</option>
              <option value="mine">Claimed by me</option>
              <option value="other">Claimed by someone else</option>
            </select>
          </label>
          {user?.role === "admin" && (
            <label>
              Owning team
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">All teams</option>
                {teams.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <RequestTable
          requests={shown}
          empty="No requests match these filters."
          currentUserId={user?.userId}
        />
      </Card>
    </>
  );
}
