import { timingSafeEqual } from 'crypto';
import { execSync } from 'child_process';

export type CheckState = 'ok' | 'not-ok';

export interface HealthReport {
  status: CheckState;
  version: string;
  checks: {
    database: CheckState;
    ai: CheckState;
  };
}

export interface MonitorState {
  consecutiveNonOk: number;
  alertOpen: boolean;
}

export type MonitorEvent = 'none' | 'degraded' | 'alert' | 'resolved';

export const initialMonitorState: MonitorState = {
  consecutiveNonOk: 0,
  alertOpen: false,
};

export function releaseSha(): string {
  const fromEnv = [
    process.env.GIT_SHA,
    process.env.RENDER_GIT_COMMIT,
    process.env.GITHUB_SHA,
  ].find((value) => value && value.trim());
  if (fromEnv) return fromEnv.trim();
  try {
    return execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export function safeFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown failure';
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 300);
}

export function readBasicAuth(
  header: string | undefined,
): { username: string; password: string } | null {
  if (!header?.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  const splitAt = decoded.indexOf(':');
  if (splitAt < 0) return null;
  return {
    username: decoded.slice(0, splitAt),
    password: decoded.slice(splitAt + 1),
  };
}

function sameSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function healthAuthOk(
  header: string | undefined,
  username: string | undefined,
  password: string | undefined,
): boolean {
  const expectedUser = username?.trim();
  const expectedPassword = password?.trim();
  if (!expectedUser || !expectedPassword) return false;
  const parsed = readBasicAuth(header);
  if (!parsed) return false;
  return (
    sameSecret(parsed.username, expectedUser) &&
    sameSecret(parsed.password, expectedPassword)
  );
}

/**
 * One or two failed observations stay degraded.
 * The third in a row opens an alert. The next ok closes it.
 */
export function nextMonitorState(
  state: MonitorState,
  ok: boolean,
): { state: MonitorState; event: MonitorEvent } {
  if (ok) {
    if (state.alertOpen) {
      return { state: initialMonitorState, event: 'resolved' };
    }
    return { state: initialMonitorState, event: 'none' };
  }

  const consecutiveNonOk = state.consecutiveNonOk + 1;
  if (!state.alertOpen && consecutiveNonOk >= 3) {
    return {
      state: { consecutiveNonOk, alertOpen: true },
      event: 'alert',
    };
  }
  if (state.alertOpen) {
    return {
      state: { consecutiveNonOk, alertOpen: true },
      event: 'none',
    };
  }
  return {
    state: { consecutiveNonOk, alertOpen: false },
    event: 'degraded',
  };
}
