import { MESSAGE_MAIL_QUIET_MS, MessageMailWindow } from './message-mail-window';

describe('MessageMailWindow', () => {
  const start = 1_000_000;

  it('sends the first message mail and skips another inside two minutes', () => {
    const window = new MessageMailWindow();
    expect(window.allow('r1', 'team', start)).toBe(true);
    expect(window.allow('r1', 'team', start + 30_000)).toBe(false);
    expect(window.allow('r1', 'team', start + MESSAGE_MAIL_QUIET_MS)).toBe(true);
  });

  it('keeps the two directions and two requests on separate clocks', () => {
    const window = new MessageMailWindow();
    expect(window.allow('r1', 'team', start)).toBe(true);
    expect(window.allow('r1', 'requester', start)).toBe(true);
    expect(window.allow('r2', 'team', start)).toBe(true);
    expect(window.allow('r1', 'team', start + 1_000)).toBe(false);
  });
});
