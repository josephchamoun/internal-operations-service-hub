import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "./button";
import type { Category, RequestItem, Team } from "../types";

export function ReassignForm({
  request,
  teams,
  categories,
  compact = false,
}: {
  request: RequestItem;
  teams: Team[];
  categories: Category[];
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const action = useMutation({
    mutationFn: () =>
      api<RequestItem>(`/requests/${request.id}/reassign`, {
        method: "PATCH",
        body: JSON.stringify({
          newTeamId: teamId,
          ...(categoryId ? { categoryId } : {}),
        }),
      }),
    onSuccess: () => navigate("/queue"),
  });
  const isActive = !["Resolved", "Cancelled"].includes(request.status);
  const teamCategories = categories.filter(
    (category) =>
      !category.defaultTeamId || category.defaultTeamId === teamId,
  );
  if (!isActive) return null;
  return (
    <div className="action-group stacked">
      <strong>Reassign</strong>
      {!compact && (
        <p className="muted">
          Use this if the request does not belong to this team. You do not need
          to open the full details first.
        </p>
      )}
      {action.isError && <p className="form-error">{action.error.message}</p>}
      <select
        value={teamId}
        onChange={(event) => {
          setTeamId(event.target.value);
          setCategoryId(event.target.value ? "other" : "");
        }}
      >
        <option value="">Select target team</option>
        {teams
          .filter((team) => team.id !== request.owningTeamId)
          .map((team) => (
            <option value={team.id} key={team.id}>
              {team.name}
            </option>
          ))}
      </select>
      <select
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        disabled={!teamId}
      >
        {!teamId && <option value="">Pick a team first</option>}
        {teamId &&
          teamCategories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.name}
            </option>
          ))}
      </select>
      <p className="muted">
        Defaults to Other (a catch-all category). Pick a team-specific category
        if one fits.
      </p>
      <Button
        disabled={!teamId || action.isPending}
        onClick={() => action.mutate()}
      >
        {action.isPending ? "Reassigning…" : "Reassign"}
      </Button>
    </div>
  );
}
