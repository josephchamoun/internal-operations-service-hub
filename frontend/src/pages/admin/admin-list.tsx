import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuth } from "../../auth";
import { useApiQuery } from "../../hooks/use-api-query";
import type { Category, Priority, Role, Team, User } from "../../types";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { ErrorState } from "../../components/error-state";
import { Loading } from "../../components/loading";

export type AdminResource = "users" | "teams" | "categories" | "priorities";
type Item = User | Team | Category | Priority;

const TABS: AdminResource[] = ["users", "teams", "categories", "priorities"];
const SINGULAR: Record<AdminResource, string> = {
  users: "user",
  teams: "team",
  categories: "category",
  priorities: "priority",
};
const OTHER_CATEGORY_ID = "other";
const DEFAULT_PRIORITY_ID = "Normal";

export function AdminList({ type }: { type: AdminResource }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const query = useApiQuery<Item[]>([type], `/${type}`);
  const teams = useApiQuery<Team[]>(
    ["teams"],
    "/teams",
    type === "users" || type === "categories",
  );
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [type] });
    if (type === "users") void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };

  const save = useMutation({
    mutationFn: (payload: { path: string; method: "POST" | "PATCH"; body: unknown }) =>
      api<Item>(payload.path, token, {
        method: payload.method,
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      setEditing(null);
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api<Item>(`/${type}/${id}`, token, { method: "DELETE" }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const closeEditor = () => {
    setEditing(null);
    setError(null);
  };

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const needsTeams = type === "users" || type === "categories";
  if (query.isPending || (needsTeams && teams.isPending)) return <Loading />;
  if (query.isError || (needsTeams && teams.isError))
    return (
      <ErrorState
        error={query.error ?? teams.error}
        retry={() => {
          void query.refetch();
          void teams.refetch();
        }}
      />
    );

  const items = query.data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const teamOptions = type === "teams" ? (query.data as Team[]) : (teams.data ?? []);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>{type[0].toUpperCase() + type.slice(1)}</h1>
          <p className="page-description">
            Add or edit hub reference data. Unused rows can be removed. Other is
            a permanent category and cannot be changed.
          </p>
        </div>
        <Button type="button" onClick={() => { setEditing("new"); setError(null); }}>
          Add {SINGULAR[type]}
        </Button>
      </div>
      <div className="admin-tabs">
        {TABS.map((item) => (
          <Link
            className={item === type ? "active" : ""}
            to={`/admin/${item}`}
            key={item}
          >
            {item}
          </Link>
        ))}
      </div>
      {editing && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editing === "new" ? `New ${SINGULAR[type]}` : `Edit ${(editing as Item).name}`}
          onClick={closeEditor}
        >
          <div className="admin-modal-shell" onClick={(event) => event.stopPropagation()}>
            <Card className="modal-card admin-modal">
            <AdminForm
              type={type}
              item={editing === "new" ? null : editing}
              teams={teamOptions}
              saving={save.isPending}
              error={error ?? (save.isError ? save.error.message : null)}
              onCancel={closeEditor}
              onSubmit={(body, id) => {
                setError(null);
                save.mutate({
                  path: id ? `/${type}/${id}` : `/${type}`,
                  method: id ? "PATCH" : "POST",
                  body,
                });
              }}
            />
            </Card>
          </div>
        </div>
      )}
      <Card>
        <input
          className="admin-search"
          aria-label={`Search ${type}`}
          placeholder={`Search ${type} by name`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {error && !editing && <p className="form-error">{error}</p>}
        <p className="request-count">
          {items.length === query.data.length
            ? `${query.data.length} ${query.data.length === 1 ? SINGULAR[type] : type}`
            : `${items.length} out of ${query.data.length} ${type}`}
        </p>
        <div className="simple-table">
          {items.map((item) => {
            const locked = item.id === OTHER_CATEGORY_ID;
            const canDelete = !locked && item.id !== DEFAULT_PRIORITY_ID;
            return (
              <div key={item.id} className={`admin-row admin-row-${type}`}>
                {type === "users" && (
                  <>
                    <strong title={(item as User).name}>{(item as User).name}</strong>
                    <span title={(item as User).email}>{(item as User).email}</span>
                    <span>{(item as User).role}</span>
                    <span title={(item as User).teamIds?.join(", ") || "No teams"}>
                      {(item as User).teamIds?.length
                        ? (item as User).teamIds
                            .map((id) => teamOptions.find((team) => team.id === id)?.name ?? id)
                            .join(", ")
                        : "No teams"}
                    </span>
                  </>
                )}
                {type === "teams" && (
                  <strong title={(item as Team).name}>{(item as Team).name}</strong>
                )}
                {type === "categories" && (
                  <>
                    <strong title={(item as Category).name}>{(item as Category).name}</strong>
                    <span>
                      Default team:{" "}
                      {(item as Category).defaultTeamId
                        ? teamOptions.find((team) => team.id === (item as Category).defaultTeamId)
                            ?.name ?? (item as Category).defaultTeamId
                        : "None (manual selection)"}
                    </span>
                  </>
                )}
                {type === "priorities" && (
                  <>
                    <strong title={(item as Priority).name}>{(item as Priority).name}</strong>
                    <span>
                      {(item as Priority).escalationWindowMinutes} minute
                      escalation window
                    </span>
                  </>
                )}
                <div className="admin-row-actions">
                  {!locked && (
                    <Button
                      type="button"
                      className="secondary"
                      onClick={() => { setEditing(item); setError(null); }}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (window.confirm(`Delete ${item.name}?`)) {
                          remove.mutate(item.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="muted">No matching {type}.</p>}
        </div>
      </Card>
    </>
  );
}

function AdminForm({
  type,
  item,
  teams,
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  type: AdminResource;
  item: Item | null;
  teams: Team[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: unknown, id?: string) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [email, setEmail] = useState(item && "email" in item ? item.email : "");
  const [role, setRole] = useState<Role>(
    item && "role" in item ? item.role : "employee",
  );
  const [teamIds, setTeamIds] = useState<string[]>(
    item && "teamIds" in item ? item.teamIds ?? [] : [],
  );
  const [defaultTeamId, setDefaultTeamId] = useState(
    item && "defaultTeamId" in item ? (item.defaultTeamId ?? "") : "",
  );
  const [escalationWindowMinutes, setEscalationWindowMinutes] = useState(
    item && "escalationWindowMinutes" in item
      ? String(item.escalationWindowMinutes)
      : "1440",
  );
  const canAssignTeams = role === "team_member";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (type === "users") {
      onSubmit(
        {
          name,
          email,
          role,
          teamIds: canAssignTeams ? teamIds : [],
        },
        item?.id,
      );
      return;
    }
    if (type === "teams") {
      onSubmit({ name }, item?.id);
      return;
    }
    if (type === "categories") {
      onSubmit({ name, defaultTeamId }, item?.id);
      return;
    }
    onSubmit(
      { name, escalationWindowMinutes: Number(escalationWindowMinutes) },
      item?.id,
    );
  };

  return (
    <form className="form admin-form" onSubmit={handleSubmit}>
      <h2>{item ? `Edit ${item.name}` : `New ${SINGULAR[type]}`}</h2>
      <label>
        Name
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {type === "users" && (
        <>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => {
                const next = event.target.value as Role;
                setRole(next);
                if (next !== "team_member") setTeamIds([]);
              }}
            >
              <option value="employee">employee</option>
              <option value="team_member">team_member</option>
              <option value="admin">admin</option>
            </select>
          </label>
          {canAssignTeams && (
            <fieldset className="admin-teams">
              <legend>Teams</legend>
              {teams.map((team) => (
                <label key={team.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={teamIds.includes(team.id)}
                    onChange={(event) => {
                      setTeamIds((current) =>
                        event.target.checked
                          ? [...current, team.id]
                          : current.filter((value) => value !== team.id),
                      );
                    }}
                  />
                  {team.name}
                </label>
              ))}
              {teams.length === 0 && <p className="muted">No teams yet.</p>}
            </fieldset>
          )}
        </>
      )}
      {type === "categories" && (
        <label>
          Default team
          <select
            required
            value={defaultTeamId}
            onChange={(event) => setDefaultTeamId(event.target.value)}
          >
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {type === "priorities" && (
        <label>
          Escalation window (minutes)
          <input
            required
            type="number"
            min={1}
            value={escalationWindowMinutes}
            onChange={(event) => setEscalationWindowMinutes(event.target.value)}
          />
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="action-group">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
