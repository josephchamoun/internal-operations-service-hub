import { useAuth } from "../auth";
import { Button } from "./button";
import { Card } from "./card";

export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { logout } = useAuth();
  const status = (error as { status?: number })?.status;
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  if (status === 401)
    return (
      <Card>
        <p className="eyebrow">Session</p>
        <h2>Session expired</h2>
        <p className="muted">Please log in again to continue.</p>
        <Button
          onClick={() => logout("Your session expired. Please log in again.")}
        >
          Return to login
        </Button>
      </Card>
    );
  return (
      <Card className="error">
        <p className="eyebrow">Something went wrong</p>
        <h2>
          {status === 403
            ? "You don’t have permission for this"
            : "Could not load this information"}
        </h2>
        <p className="muted">{message}</p>
        {retry && <Button onClick={retry}>Try again</Button>}
      </Card>
  );
}
