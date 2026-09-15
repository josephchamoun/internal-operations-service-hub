import { useState } from "react";
import { Link } from "react-router-dom";
import { useApiQuery } from "../../hooks/use-api-query";
import type { Category, Priority, Team, User } from "../../types";
import { Card } from "../../components/card";
import { ErrorState } from "../../components/error-state";
import { Loading } from "../../components/loading";

export type AdminResource = "users" | "teams" | "categories" | "priorities";
export function AdminList({ type }: { type: AdminResource }) {
  const query = useApiQuery<(User | Team | Category | Priority)[]>(
    [type],
    `/${type}`,
  );
  const [search, setSearch] = useState("");
  if (query.isPending) return <Loading />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const items = query.data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>{type[0].toUpperCase() + type.slice(1)}</h1>
          <p className="page-description">
            Reference data for the hub. These pages are view-only.
          </p>
        </div>
      </div>
      <div className="admin-tabs">
        {(["users", "teams", "categories", "priorities"] as const).map(
          (item) => (
            <Link
              className={item === type ? "active" : ""}
              to={`/admin/${item}`}
              key={item}
            >
              {item}
            </Link>
          ),
        )}
      </div>
      <Card>
        <input
          className="admin-search"
          aria-label={`Search ${type}`}
          placeholder={`Search ${type} by name`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="simple-table">
          {items.map((item) => (
            <div key={item.id}>
              {type === "users" && (
                <>
                  <strong>{(item as User).name}</strong>
                  <span>{(item as User).email}</span>
                  <span>{(item as User).role}</span>
                </>
              )}
              {type === "teams" && <strong>{(item as Team).name}</strong>}
              {type === "categories" && (
                <>
                  <strong>{(item as Category).name}</strong>
                  <span>
                    Default team:{" "}
                    {(item as Category).defaultTeamId ??
                      "None (manual selection)"}
                  </span>
                </>
              )}
              {type === "priorities" && (
                <>
                  <strong>{(item as Priority).name}</strong>
                  <span>
                    {(item as Priority).escalationWindowMinutes} minute
                    escalation window
                  </span>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="muted">No matching {type}.</p>}
        </div>
      </Card>
    </>
  );
}
