import type { NextFunction, Request, Response } from 'express';
import type { Business } from '../modules/auth/auth.repository.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import { HttpError } from '../utils/httpError.js';
import { readSessionCookie } from '../utils/cookies.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireAuth; the business whose session cookie the request carried. */
    business?: Business;
  }
}

/** Attaches `req.business` from the session cookie, or responds 401. */
export function createRequireAuth(authService: AuthService) {
  return async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const sessionId = readSessionCookie(req);
    const business = sessionId ? await authService.getBusinessForSession(sessionId) : undefined;
    if (!business) {
      next(HttpError.unauthorized('Log in to continue'));
      return;
    }
    req.business = business;
    next();
  };
}
