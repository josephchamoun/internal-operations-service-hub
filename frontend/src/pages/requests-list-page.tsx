import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import { Card } from "../components/card";
import { Loading } from "../components/loading";
import { RequestTable } from "../components/request-table";
import { ErrorState } from "../components/error-state";
import { useUserDirectory } from "../hooks/use-user-directory";
import type { Category, Priority, RequestItem, RequestStatus, Team } from "../types";

const statuses: RequestStatus[] = [
  "New",
  "In Progress",
  "Resolved",
  "Cancelled",
];
export function RequestListPage({ mine = false }: { mine?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useApiQuery<RequestItem[]>(
    [mine ? "mine" : "requests"],
    mine ? "/requests/mine" : "/requests",
  );
  const people = useUserDirectory();
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const categories = useApiQuery<Category[]>(["categories"], "/categories");
  const priorities = useApiQuery<Priority[]>(["priorities"], "/priorities");
  const [status, setStatus] = useState("");
  const [team, setTeam] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [claimState, setClaimState] = useState("all");
  const canBeClaimant = (user?.teamIds?.length ?? 0) > 0;
  const showTeamFilter =
    !mine &&
    (user?.role === "admin" || (user?.teamIds?.length ?? 0) > 1);
  const showCategoryFilter = !mine && (user?.role === "admin" || canBeClaimant);
  const userId = user?.userId;
  useEffect(() => {
    if (!userId) return;
    const stream = new EventSource(apiUrl("/requests/stream/all"), {
      withCredentials: true,
    });
    stream.onmessage = () => {
      void client.invalidateQueries({ queryKey: ["requests"] });
      void client.invalidateQueries({ queryKey: ["mine"] });
    };
    return () => stream.close();
  }, [userId, client]);
  if (
    query.isPending ||
    teams.isPending ||
    categories.isPending ||
    priorities.isPending ||
    people.isPending
  )
    return <Loading />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  if (teams.isError)
    return <ErrorState error={teams.error} retry={() => teams.refetch()} />;
  if (categories.isError)
    return (
      <ErrorState error={categories.error} retry={() => categories.refetch()} />
    );
  if (priorities.isError)
    return (
      <ErrorState error={priorities.error} retry={() => priorities.refetch()} />
    );

  const shown = query.data.filter((r) => {
    const matchesStatus = !status || r.status === status;
    const matchesTeam = !team || r.owningTeamId === team;
    const matchesCategory = !category || r.categoryId === category;
    const matchesPriority = !priority || r.priorityId === priority;
    const matchesClaim =
      claimState === "all" ||
      (claimState === "unclaimed" && !r.claimedBy) ||
      (claimState === "mine" && r.claimedBy === user?.userId) ||
      (claimState === "other" &&
        !!r.claimedBy &&
        r.claimedBy !== user?.userId);
    return (
      matchesStatus &&
      matchesTeam &&
      matchesCategory &&
      matchesPriority &&
      matchesClaim
    );
  });
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
          <p className="page-description">
            {mine
              ? "Everything you submitted, with live status as the owning team works it."
              : user?.role === "admin"
                ? "Every request across teams. Open a row for the limited view first."
                : "Requests routed to your team. Claim one to start work."}
          </p>
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
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">All priorities</option>
              {priorities.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {showCategoryFilter && (
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Claimed
            <select
              value={claimState}
              onChange={(event) => setClaimState(event.target.value)}
            >
              <option value="all">All requests</option>
              <option value="unclaimed">Unclaimed</option>
              {canBeClaimant && <option value="mine">Claimed by me</option>}
              {!mine && (
                <option value="other">Claimed by someone else</option>
              )}
            </select>
          </label>
          {showTeamFilter && (
            <label>
              Owning team
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">All teams</option>
                {(user?.role === "admin"
                  ? teams.data
                  : teams.data?.filter((t) => user?.teamIds.includes(t.id))
                )?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="request-count">
          {shown.length === query.data.length
            ? `${query.data.length} ${query.data.length === 1 ? "request" : "requests"}`
            : `${shown.length} out of ${query.data.length} requests`}
        </p>
        <RequestTable
          requests={shown}
          empty="No requests match these filters."
          currentUserId={user?.userId}
          users={people.data}
          categories={categories.data}
          priorities={priorities.data}
        />
      </Card>
    </>
  );
}
