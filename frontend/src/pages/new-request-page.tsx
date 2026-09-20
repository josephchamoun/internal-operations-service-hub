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
import { fileError } from "../lib/file-rules";
import type {
  Category,
  IntakeSuggestion,
  Priority,
  RequestItem,
  Team,
} from "../types";

export function NewRequestPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const categories = useApiQuery<Category[]>(["categories"], "/categories");
  const priorities = useApiQuery<Priority[]>(["priorities"], "/priorities");
  const teams = useApiQuery<Team[]>(["teams"], "/teams");
  const [draft, setDraft] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priorityId, setPriorityId] = useState("Normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState("");
  const [suggestion, setSuggestion] = useState<IntakeSuggestion | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileIssue, setFileIssue] = useState<string | null>(null);
  const selected = categories.data?.find((c) => c.id === categoryId);

  const applySuggestion = (next: IntakeSuggestion) => {
    setSuggestion(next);
    setCategoryId(next.categoryId);
    setPriorityId(next.priorityId);
    setSubject(next.summary.slice(0, 200));
    setDescription(draft.trim());
    setTeamId(next.suggestedOwningTeamId ?? "");
  };

  const interpret = useMutation({
    mutationFn: () =>
      api<IntakeSuggestion>("/requests/interpret", token, {
        method: "POST",
        body: JSON.stringify({ draft: draft.trim() }),
      }),
    onSuccess: applySuggestion,
  });
  const create = useMutation({
    mutationFn: async () => {
      const blocked = files.map(fileError).find(Boolean);
      if (blocked) throw new Error(blocked);
      const created = await api<RequestItem>("/requests", token, {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          priorityId,
          subject,
          description,
          ...(selected?.defaultTeamId ? {} : { teamId }),
        }),
      });
      if (files.length > 0) {
        const data = new FormData();
        files.forEach((file) => data.append("files", file));
        await api(`/requests/${created.id}/attachments`, token, {
          method: "POST",
          body: data,
        });
      }
      return created;
    },
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
    <div className="intake-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Intake</div>
          <h1>New request</h1>
          <p className="page-description">
            Describe the problem in your own words. The hub will suggest a
            category, team, and next step. You confirm before anything is
            submitted.
          </p>
        </div>
      </div>
      <Card>
        <form
          className="form intake-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="intake-col">
            <label>
              What do you need help with?
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={8}
                maxLength={4000}
                placeholder="e.g. my laptop is shut down and wont open"
              />
            </label>
            <div className="actions">
              <Button
                type="button"
                disabled={!draft.trim() || interpret.isPending}
                onClick={() => interpret.mutate()}
              >
                {interpret.isPending ? "Getting suggestion…" : "Get AI suggestion"}
              </Button>
            </div>
            {interpret.isError && (
              <p className="form-error">{interpret.error.message}</p>
            )}
            {suggestion && (
              <div className="suggestion-card">
                <p className="eyebrow">Suggested before you submit</p>
                <dl>
                  <dt>Summary</dt>
                  <dd>{suggestion.summary}</dd>
                  <dt>Category</dt>
                  <dd>
                    {categories.data.find((item) => item.id === suggestion.categoryId)
                      ?.name ?? suggestion.categoryId}
                  </dd>
                  <dt>Owning team</dt>
                  <dd>
                    {suggestion.suggestedOwningTeamId
                      ? (teams.data.find(
                          (item) => item.id === suggestion.suggestedOwningTeamId,
                        )?.name ?? suggestion.suggestedOwningTeamId)
                      : "Not sure yet"}
                  </dd>
                  <dt>Priority</dt>
                  <dd>{suggestion.priorityId}</dd>
                  <dt>Next step</dt>
                  <dd>{suggestion.suggestedNextStep}</dd>
                  {suggestion.selfServeHint && (
                    <>
                      <dt>You can try</dt>
                      <dd>{suggestion.selfServeHint}</dd>
                    </>
                  )}
                </dl>
                {suggestion.needsClarification && (
                  <p className="notice warning">
                    {suggestion.clarificationQuestion ??
                      "This draft is unclear. Add detail before submitting if you can."}
                  </p>
                )}
                <p className="muted">
                  Confidence: {suggestion.confidence}. Edit the fields on the
                  right if this is wrong — nothing is submitted until you do.
                </p>
              </div>
            )}
          </div>
          <div className="intake-col">
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
            <label>
              Files (optional, 5MB each)
              <input
                type="file"
                multiple
                onChange={(event) => {
                  const next = Array.from(event.target.files ?? []);
                  const blocked = next.map(fileError).find(Boolean);
                  if (blocked) {
                    setFileIssue(blocked);
                    setFiles([]);
                    event.target.value = "";
                    return;
                  }
                  setFileIssue(null);
                  setFiles(next);
                }}
              />
            </label>
            {fileIssue && <p className="form-error">{fileIssue}</p>}
            {create.isError && (
              <p className="form-error">{create.error.message}</p>
            )}
            <div>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
