import { config } from 'dotenv';
import {
  HealthReport,
  initialMonitorState,
  MonitorState,
  nextMonitorState,
} from './health';

config();

const intervalMs = Number(process.env.MONITOR_INTERVAL_MS ?? 2000);
const port = process.env.PORT ?? '3000';
const healthUrl =
  process.env.HEALTH_URL?.trim() || `http://127.0.0.1:${port}/health`;
const username = process.env.HEALTH_USER?.trim();
const password = process.env.HEALTH_PASSWORD?.trim();

if (!username || !password) {
  console.error('HEALTH_USER and HEALTH_PASSWORD are required.');
  process.exit(1);
}
if (!Number.isFinite(intervalMs) || intervalMs < 200) {
  console.error('MONITOR_INTERVAL_MS must be at least 200.');
  process.exit(1);
}

function unreachableReason(error: unknown): string {
  const record =
    error instanceof Error
      ? (error as Error & { cause?: { code?: unknown; message?: unknown } })
      : undefined;
  const code = record?.cause ? String(record.cause.code ?? '') : '';
  if (code === 'ECONNREFUSED' || record?.message === 'fetch failed') {
    return 'the API could not be reached';
  }
  if (typeof record?.cause?.message === 'string' && record.cause.message) {
    return record.cause.message;
  }
  if (record?.message) return record.message;
  return 'the API could not be reached';
}

const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
let state: MonitorState = initialMonitorState;

async function observe(): Promise<{ ok: boolean; line: string }> {
  try {
    const response = await fetch(healthUrl, {
      headers: { Authorization: authorization },
    });
    if (response.status === 401) {
      return { ok: false, line: 'HTTP 401 health request was rejected' };
    }
    const body = (await response.json()) as HealthReport;
    const database = body.checks?.database ?? 'not-ok';
    const ai = body.checks?.ai ?? 'not-ok';
    return {
      ok: response.ok && body.status === 'ok',
      line: `HTTP ${response.status} database=${database} ai=${ai}`,
    };
  } catch (error) {
    return { ok: false, line: unreachableReason(error) };
  }
}

function stamp(label: string, detail: string): void {
  console.log(`${new Date().toISOString()} ${label} ${detail}`);
}

async function tick(): Promise<void> {
  const observation = await observe();
  const next = nextMonitorState(state, observation.ok);
  state = next.state;
  if (next.event === 'alert') {
    stamp(
      'ALERT',
      'Ops Hub has not been ok for 3 checks in a row (degraded)',
    );
    return;
  }
  if (next.event === 'resolved') {
    stamp('RESOLVED', observation.line);
    return;
  }
  stamp(observation.ok ? 'ok' : 'degraded', observation.line);
}

console.log(
  `Local monitoring rehearsal: checking ${healthUrl} every ${intervalMs / 1000}s. Ctrl+C to stop.`,
);

async function loop(): Promise<void> {
  await tick();
  setTimeout(() => {
    void loop();
  }, intervalMs);
}

void loop();
