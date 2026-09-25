export const MESSAGE_MAIL_QUIET_MS = 2 * 60 * 1000;

export type MessageMailSide = 'team' | 'requester';

/*
  One email per request per receiving side inside the quiet window.
  The map lives in this process. A restart allows the next message to email again.
 */
export class MessageMailWindow {
  private readonly sentAt = new Map<string, number>();

  constructor(private readonly quietMs = MESSAGE_MAIL_QUIET_MS) {}

  allow(requestId: string, side: MessageMailSide, now = Date.now()): boolean {
    const key = `${requestId}:${side}`;
    const last = this.sentAt.get(key);
    if (last !== undefined && now - last < this.quietMs) return false;
    this.sentAt.set(key, now);
    return true;
  }
}
