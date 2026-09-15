import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Loading } from "../components/loading";
import { ErrorState } from "../components/error-state";
import type { Category, Priority, RequestItem, Team } from "../types";

export function NewRequestPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const categories = useApiQuery<Category[]>(["categories"], "/categories");
  const priorities = useApiQuery<Priority[]>(["priorities"], "/priorities");
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const [categoryId, setCategoryId] = useState("");
  const [priorityId, setPriorityId] = useState("Normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState("");
  const selected = categories.data?.find((c) => c.id === categoryId);
  const create = useMutation({
    mutationFn: () =>
      api<RequestItem>("/requests", token, {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          priorityId,
          subject,
          description,
          ...(selected?.defaultTeamId ? {} : { teamId }),
        }),
      }),
    onSuccess: (r) => navigate(`/requests/${r.id}`),
  });
  if (categories.isPending || priorities.isPending || teams.isPending)
    return <Loading />;
  if (categories.isError || priorities.isError || teams.isError)
    return (
      <ErrorState
        error={categories.error ?? priorities.error ?? teams.error}
        retry={() => {
          void categories.refetch();
          void priorities.refetch();
          void teams.refetch();
        }}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Intake</div>
          <h1>New request</h1>
          <p className="page-description">
            Pick a category so it lands with the right team. You can edit the
            subject and description until someone claims it.
          </p>
        </div>
      </div>
      <Card>
        <form
          className="form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label>
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories.data.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {selected && !selected.defaultTeamId && (
            <label>
              Owning team
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a team
                </option>
                {teams.data.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Priority
            <select
              value={priorityId}
              onChange={(e) => setPriorityId(e.target.value)}
            >
              {priorities.data.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={7}
            />
          </label>
          {create.isError && (
            <p className="form-error">{create.error.message}</p>
          )}
          <div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
