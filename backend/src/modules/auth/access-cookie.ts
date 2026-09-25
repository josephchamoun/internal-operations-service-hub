import { Response } from 'express';

export const ACCESS_COOKIE = 'access_token';

const cookieBase = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
};

function cookieMaxAgeMs(): number {
  const raw = process.env.JWT_EXPIRES_IN ?? '1h';
  const match = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!match) return 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (unitMs[match[2]] ?? 3_600_000);
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE, token, {
    ...cookieBase,
    maxAge: cookieMaxAgeMs(),
  });
}

export function clearAccessCookie(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, cookieBase);
}

export function accessTokenFromCookie(req: {
  headers?: { cookie?: string | string[] };
} | undefined): string | null {
  const header = req?.headers?.cookie;
  if (!header) return null;
  const raw = Array.isArray(header) ? header.join(';') : header;
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    const prefix = `${ACCESS_COOKIE}=`;
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}
