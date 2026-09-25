import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "./button";

export function TestEscalationButton({ requestId }: { requestId: string }) {
  const client = useQueryClient();
  const run = useMutation({
    mutationFn: () =>
      api<{ reminded: string[] }>("/escalations/run", {
        method: "POST",
        body: JSON.stringify({
          now: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["events", requestId] });
    },
  });
  return (
    <div className="action-group stacked">
      <p className="muted">
        Local test: run the reminder sweep as if this request is overdue.
      </p>
      {run.isError && <p className="form-error">{run.error.message}</p>}
      {run.isSuccess && (
        <p className="muted">
          {run.data.reminded.includes(requestId)
            ? "A reminder was sent (silenced teammates skipped)."
            : "No reminder: still inside the window, claimed, or already reminded."}
        </p>
      )}
      <Button
        className="secondary"
        disabled={run.isPending}
        onClick={() => run.mutate()}
      >
        {run.isPending ? "Checking…" : "Test reminders"}
      </Button>
    </div>
  );
}
