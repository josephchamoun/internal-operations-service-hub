import {
  healthAuthOk,
  initialMonitorState,
  nextMonitorState,
  safeFailureReason,
} from './health';

describe('health monitor', () => {
  it('waits for three not-ok observations before an alert', () => {
    const first = nextMonitorState(initialMonitorState, false);
    const second = nextMonitorState(first.state, false);
    const third = nextMonitorState(second.state, false);
    expect(first.event).toBe('degraded');
    expect(second.event).toBe('degraded');
    expect(third.event).toBe('alert');
  });

  it('does not alert again while the failure continues', () => {
    const alerted = nextMonitorState(
      nextMonitorState(nextMonitorState(initialMonitorState, false).state, false)
        .state,
      false,
    );
    const stillDown = nextMonitorState(alerted.state, false);
    expect(stillDown.event).toBe('none');
    expect(stillDown.state.alertOpen).toBe(true);
  });

  it('resolves on the first ok after an alert', () => {
    const alerted = nextMonitorState(
      nextMonitorState(nextMonitorState(initialMonitorState, false).state, false)
        .state,
      false,
    );
    const resolved = nextMonitorState(alerted.state, true);
    expect(resolved.event).toBe('resolved');
    expect(resolved.state).toEqual(initialMonitorState);
  });

  it('clears a short failure without an alert or a resolve', () => {
    const degraded = nextMonitorState(initialMonitorState, false);
    const recovered = nextMonitorState(degraded.state, true);
    expect(recovered.event).toBe('none');
    expect(recovered.state.consecutiveNonOk).toBe(0);
  });
});

describe('health auth', () => {
  const header = `Basic ${Buffer.from('health:HealthCheck2026').toString('base64')}`;

  it('accepts the configured username and password', () => {
    expect(healthAuthOk(header, 'health', 'HealthCheck2026')).toBe(true);
  });

  it('rejects a missing or wrong password', () => {
    expect(healthAuthOk(undefined, 'health', 'HealthCheck2026')).toBe(false);
    expect(healthAuthOk(header, 'health', 'other')).toBe(false);
    expect(healthAuthOk(header, undefined, undefined)).toBe(false);
  });
});

describe('health logs', () => {
  it('removes a database url from a failure reason', () => {
    const reason = safeFailureReason(
      new Error('connect failed postgres://neondb_owner:secret@host/neondb'),
    );
    expect(reason).not.toContain('secret');
    expect(reason).toContain('[redacted]');
  });
});
