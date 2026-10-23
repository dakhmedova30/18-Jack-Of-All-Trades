import type { Request, Response } from 'express';

const COOKIE_NAME = 'jack_session';

/** Reads the session id from the request's Cookie header, if present. */
export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== COOKIE_NAME) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * `expires` matches the session row's own expiry, so the cookie and the
 * database never disagree about when a session is still valid. `secure` is
 * derived from `req.secure`, which respects X-Forwarded-Proto because
 * app.ts sets `trust proxy` (Render sits behind one).
 */
export function setSessionCookie(
  req: Request,
  res: Response,
  sessionId: string,
  expires: Date,
): void {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    expires,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}
