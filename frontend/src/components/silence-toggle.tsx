import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import { Button } from "./button";

export function SilenceToggle({
  requestId,
  enabled,
}: {
  requestId: string;
  enabled: boolean;
}) {
  const { token } = useAuth();
  const client = useQueryClient();
  const silence = useApiQuery<{ silenced: boolean }>(
    ["silence", requestId],
    `/requests/${requestId}/silence`,
    enabled,
  );
  const toggle = useMutation({
    mutationFn: () =>
      api<{ silenced: boolean }>(`/requests/${requestId}/silence`, token, {
        method: silence.data?.silenced ? "DELETE" : "PUT",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["silence", requestId] });
    },
  });

  if (!enabled) return null;
  if (silence.isPending) return null;
  if (silence.isError) return null;

  return (
    <div className="action-group stacked">
      <p className="muted">
        {silence.data?.silenced
          ? "You will not get escalation reminders for this request."
          : "Silence reminders if you have seen this and are waiting on purpose."}
      </p>
      {toggle.isError && <p className="form-error">{toggle.error.message}</p>}
      <Button
        className="secondary"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate()}
      >
        {silence.data?.silenced ? "Un-silence reminders" : "Silence reminders"}
      </Button>
    </div>
  );
}
