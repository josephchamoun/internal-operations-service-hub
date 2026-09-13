import { Link, useParams } from "react-router-dom";
import { useApiQuery } from "../hooks/use-api-query";
import type { RequestEvent } from "../types";
import { Card } from "../components/card";
import { ErrorState } from "../components/error-state";
import { Loading } from "../components/loading";

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function RequestEventsPage() {
  const { id = "" } = useParams();
  const events = useApiQuery<RequestEvent[]>(
    ["events", id],
    `/requests/${id}/events`,
  );
  if (events.isPending) return <Loading />;
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
        </div>
      </div>
      <Card>
        <ul className="timeline">
          {events.data.map((event) => (
            <li key={event.id}>
              <strong>{event.eventType.replaceAll("_", " ")}</strong>
              <span>
                {event.fromValue ?? "—"} → {event.toValue ?? "—"} ·{" "}
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
