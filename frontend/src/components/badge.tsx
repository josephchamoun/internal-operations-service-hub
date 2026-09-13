import type { RequestStatus } from "../types";

export function Badge({
  value,
  kind,
}: {
  value: string;
  kind: "status" | "priority";
}) {
  return (
    <span
      className={`badge ${kind}-${value.toLowerCase().replaceAll(" ", "-")}`}
    >
      {value}
    </span>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge kind="status" value={status} />;
}
