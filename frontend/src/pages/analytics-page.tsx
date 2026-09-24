import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "../api/client";
import { useAuth } from "../auth";
import { useApiQuery } from "../hooks/use-api-query";
import { Card } from "../components/card";
import { Loading } from "../components/loading";
import { ErrorState } from "../components/error-state";
import type { AnalyticsBucket, AnalyticsReport, AnalyticsSlice } from "../types";

type Scope = "submitted" | "queue";

const STATUS_COLOR: Record<string, string> = {
  New: "#0f766e",
  "In Progress": "#d97706",
  Resolved: "#15803d",
  Cancelled: "#a8a29e",
};

export function AnalyticsPage() {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const report = useApiQuery<AnalyticsReport>(["analytics"], "/analytics");
  const [scope, setScope] = useState<Scope>("submitted");

  useEffect(() => {
    if (!token) return;
    const stream = new EventSource(
      apiUrl(`/requests/stream/all?token=${encodeURIComponent(token)}`),
    );
    stream.onmessage = () => {
      void client.invalidateQueries({ queryKey: ["analytics"] });
    };
    return () => stream.close();
  }, [token, client]);

  if (report.isPending) return <Loading />;
  if (report.isError) {
    return <ErrorState error={report.error} retry={() => report.refetch()} />;
  }

  const queueLabel = user?.role === "admin" ? "Whole hub" : "My teams";
  const activeScope: Scope =
    scope === "queue" && report.data.queue ? "queue" : "submitted";
  const slice =
    activeScope === "queue" && report.data.queue
      ? report.data.queue
      : report.data.submitted;
  const points = talkingPoints(slice, activeScope);

  return (
    <div className="analytics-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Analytics</div>
          <h1>{user?.name ? `${user.name.split(" ")[0]}'s picture` : "Your picture"}</h1>
          <p className="page-description">
            {activeScope === "submitted"
              ? "Counts only requests you submitted. Status, priority, and where they landed."
              : user?.role === "admin"
                ? "Every request in the hub, the same set as the queue."
                : "Requests routed to your teams, including ones you did not submit."}
          </p>
        </div>
        <Link className="btn" to="/new">
          New request
        </Link>
      </div>

      {report.data.queue && (
        <div className="analytics-switch" role="tablist" aria-label="Analytics scope">
          <button
            type="button"
            role="tab"
            aria-selected={activeScope === "submitted"}
            className={activeScope === "submitted" ? "active" : ""}
            onClick={() => setScope("submitted")}
          >
            I submitted
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeScope === "queue"}
            className={activeScope === "queue" ? "active" : ""}
            onClick={() => setScope("queue")}
          >
            {queueLabel}
          </button>
        </div>
      )}

      <div className="analytics-stats">
        <Stat
          label={activeScope === "submitted" ? "Submitted" : "In view"}
          value={slice.total}
          note={activeScope === "submitted" ? "Requests you created" : "Requests in this view"}
        />
        <Stat
          label="Still open"
          value={slice.open}
          note={openNote(slice)}
          tone={slice.urgentOpen > 0 ? "warn" : undefined}
        />
        <Stat
          label="Resolved"
          value={slice.resolved}
          note={
            slice.total === 0
              ? "Nothing to resolve yet"
              : `${Math.round((slice.resolved / slice.total) * 100)}% of this view`
          }
          tone="good"
        />
        {activeScope === "queue" ? (
          <Stat
            label="Waiting"
            value={slice.unclaimed}
            note={
              slice.claimedByMe > 0
                ? `${slice.claimedByMe} open and claimed by you`
                : "Open, and nobody has claimed them"
            }
          />
        ) : (
          <Stat
            label="Cancelled"
            value={slice.cancelled}
            note="Closed without a resolution"
          />
        )}
      </div>

      <div className="analytics-grid">
        <Card>
          <p className="eyebrow">Status</p>
          <h2>Where the work stands</h2>
          <div className="analytics-donut-row">
            <Donut slices={slice.byStatus} />
            <ul className="analytics-legend">
              {slice.byStatus.map((item) => (
                <li key={item.id}>
                  <span
                    className="analytics-swatch"
                    style={{ background: STATUS_COLOR[item.label] ?? "#0f766e" }}
                  />
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <p className="eyebrow">Priority</p>
          <h2>How urgent it is</h2>
          <Bars
            rows={slice.byPriority}
            colorFor={(row) => priorityColor(row.label)}
            empty="No priorities defined yet."
          />
        </Card>
      </div>

      <div className="analytics-grid">
        <Card>
          <p className="eyebrow">Category</p>
          <h2>What people ask for</h2>
          <Bars
            rows={slice.byCategory}
            colorFor={() => "#0f766e"}
            empty="No requests in a category yet."
          />
        </Card>
        <Card>
          <p className="eyebrow">Team</p>
          <h2>Who owns the work</h2>
          <Bars
            rows={slice.byTeam}
            colorFor={() => "#9a7040"}
            empty="No team has a request in this view yet."
          />
        </Card>
      </div>

      <Card>
        <p className="eyebrow">Last 6 months</p>
        <h2>When requests arrived</h2>
        <MonthChart rows={slice.byMonth} />
      </Card>

      <Card className="analytics-notes">
        <p className="eyebrow">Worth a look</p>
        <h2>What the numbers say</h2>
        <ul>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone?: "good" | "warn";
}) {
  return (
    <article className={`analytics-stat${tone ? ` ${tone}` : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function Donut({ slices }: { slices: AnalyticsBucket[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const drawn = slices.filter((slice) => slice.count > 0);
  const gap = drawn.length > 1 ? 4 : 0;
  let offset = 0;

  return (
    <svg className="analytics-donut" viewBox="0 0 160 160" role="img" aria-label={`${total} requests by status`}>
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#efeae2" strokeWidth="16" />
      {total > 0 &&
        drawn.map((slice) => {
          const length = Math.max((slice.count / total) * circumference - gap, 0);
          const element = (
            <circle
              key={slice.id}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={STATUS_COLOR[slice.label] ?? "#0f766e"}
              strokeWidth="16"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 80 80)"
            />
          );
          offset += (slice.count / total) * circumference;
          return element;
        })}
      <text x="80" y="78" textAnchor="middle" className="analytics-donut-total">
        {total}
      </text>
      <text x="80" y="98" textAnchor="middle" className="analytics-donut-caption">
        total
      </text>
    </svg>
  );
}

function Bars({
  rows,
  colorFor,
  empty,
}: {
  rows: AnalyticsBucket[];
  colorFor: (row: AnalyticsBucket) => string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="muted analytics-empty">{empty}</p>;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <ul className="analytics-bars">
      {rows.map((row) => (
        <li key={row.id}>
          <div>
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </div>
          <div className="analytics-track" aria-hidden="true">
            <span
              style={{
                width: `${(row.count / max) * 100}%`,
                background: colorFor(row),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MonthChart({ rows }: { rows: AnalyticsBucket[] }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="analytics-months" role="img" aria-label="Requests created in the last 6 months">
      {rows.map((row) => (
        <div key={row.id} className="analytics-month">
          <span className="analytics-month-count">{row.count}</span>
          <div className="analytics-month-track">
            <span style={{ height: `${(row.count / max) * 100}%` }} />
          </div>
          <span className="analytics-month-label">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function openNote(slice: AnalyticsSlice): string {
  const fresh = slice.byStatus.find((item) => item.label === "New")?.count ?? 0;
  const working = slice.byStatus.find((item) => item.label === "In Progress")?.count ?? 0;
  const base = `${fresh} new · ${working} in progress`;
  if (slice.urgentOpen === 0) return base;
  return `${base} · ${slice.urgentOpen} urgent`;
}

function priorityColor(label: string): string {
  const key = label.toLowerCase();
  if (key === "urgent") return "#b91c1c";
  if (key === "low") return "#78716c";
  return "#0369a1";
}

function talkingPoints(slice: AnalyticsSlice, mode: Scope): string[] {
  if (slice.total === 0) {
    return [
      mode === "submitted"
        ? "You have not submitted a request yet. Send one and it will show up in these charts."
        : "Nothing is in this view yet.",
    ];
  }
  const points: string[] = [];
  if (slice.resolved === 0) {
    points.push(
      mode === "submitted"
        ? "None of your requests are resolved yet."
        : "Nothing in this view is resolved yet.",
    );
  } else {
    const percent = Math.round((slice.resolved / slice.total) * 100);
    points.push(
      mode === "submitted"
        ? `${percent}% of what you submitted is resolved.`
        : `${percent}% of this view is already resolved.`,
    );
  }
  if (slice.urgentOpen > 0) {
    points.push(
      `${slice.urgentOpen} urgent ${slice.urgentOpen === 1 ? "request is" : "requests are"} still open.`,
    );
  }
  if (mode === "queue" && slice.unclaimed > 0) {
    points.push(
      `${slice.unclaimed} open ${slice.unclaimed === 1 ? "request is" : "requests are"} waiting to be claimed.`,
    );
  } else if (mode === "queue" && slice.claimedByMe > 0) {
    points.push(
      `You have ${slice.claimedByMe} open ${slice.claimedByMe === 1 ? "request" : "requests"} claimed.`,
    );
  }
  const top = slice.byCategory[0];
  if (top) {
    points.push(
      mode === "submitted"
        ? `Most of yours are ${top.label} (${top.count}).`
        : `${top.label} is the busiest category (${top.count}).`,
    );
  }
  return points.slice(0, 3);
}
