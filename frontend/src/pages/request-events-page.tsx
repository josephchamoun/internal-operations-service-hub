import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import { useUserDirectory } from "../hooks/use-user-directory";
import type { DirectoryUser } from "../lib/directory";
import type { Category, Priority, RequestEvent, Team } from "../types";
import { Card } from "../components/card";
import { ErrorState } from "../components/error-state";
import { Loading } from "../components/loading";
import { PersonLabel } from "../components/person-label";

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function isUserEvent(eventType: string) {
  return eventType === "claimed" || eventType === "unclaimed";
}

function EventValue({
  value,
  eventType,
  users,
  currentUserId,
  teams,
  categories,
  priorities,
}: {
  value: string | null;
  eventType: string;
  users?: DirectoryUser[];
  currentUserId?: string;
  teams?: Team[];
  categories?: Category[];
  priorities?: Priority[];
}) {
  if (!value) return <>—</>;
  if (isUserEvent(eventType)) {
    return (
      <PersonLabel userId={value} users={users} currentUserId={currentUserId} />
    );
  }
  if (eventType === "reassigned") {
    return <>{teams?.find((item) => item.id === value)?.name ?? value}</>;
  }
  if (eventType === "category_changed") {
    return <>{categories?.find((item) => item.id === value)?.name ?? value}</>;
  }
  if (eventType === "priority_changed") {
    return <>{priorities?.find((item) => item.id === value)?.name ?? value}</>;
  }
  return <>{value}</>;
}

export function RequestEventsPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const people = useUserDirectory();
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const categories = useApiQuery<Category[]>(["categories"], "/categories");
  const priorities = useApiQuery<Priority[]>(["priorities"], "/priorities");
  const events = useApiQuery<RequestEvent[]>(
    ["events", id],
    `/requests/${id}/events`,
  );
  if (
    events.isPending ||
    people.isPending ||
    teams.isPending ||
    categories.isPending ||
    priorities.isPending
  )
    return <Loading />;
  if (events.isError)
    return <ErrorState error={events.error} retry={() => events.refetch()} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <Link to={`/requests/${id}`} className="back">
            ← Request
          </Link>
          <h1>Request events</h1>
          <p className="page-description">
            Claims, status changes, reassignments, and other timeline entries
            for this request.
          </p>
        </div>
      </div>
      <Card>
        <p className="request-count">
          {events.data.length}{" "}
          {events.data.length === 1 ? "event" : "events"}
        </p>
        <ul className="timeline">
          {events.data.map((event) => (
            <li key={event.id}>
              <strong>{event.eventType.replaceAll("_", " ")}</strong>
              <span className="timeline-meta">
                <EventValue
                  value={event.fromValue}
                  eventType={event.eventType}
                  users={people.data}
                  currentUserId={user?.userId}
                  teams={teams.data}
                  categories={categories.data}
                  priorities={priorities.data}
                />
                {" → "}
                <EventValue
                  value={event.toValue}
                  eventType={event.eventType}
                  users={people.data}
                  currentUserId={user?.userId}
                  teams={teams.data}
                  categories={categories.data}
                  priorities={priorities.data}
                />
                {event.actorId && (
                  <>
                    {" · "}
                    <PersonLabel
                      userId={event.actorId}
                      users={people.data}
                      currentUserId={user?.userId}
                    />
                  </>
                )}
                {" · "}
                {formatDate(event.createdAt)}
              </span>
            </li>
          ))}
          {events.data.length === 0 && (
            <li className="muted">No events recorded yet.</li>
          )}
        </ul>
      </Card>
    </>
  );
}
