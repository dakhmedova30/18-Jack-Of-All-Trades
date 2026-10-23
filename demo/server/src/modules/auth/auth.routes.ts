import { Router } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '../../utils/cookies.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import type { AuthService } from './auth.service.js';

/**
 *   POST /api/auth/register   { name, email, password } -> business, sets the session cookie
 *   POST /api/auth/login      { email, password }        -> business, sets the session cookie
 *   POST /api/auth/logout                                 -> clears the session cookie
 *   GET  /api/auth/me                                      -> business, or 401 if not logged in
 */
export function createAuthRouter(service: AuthService): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const result = await service.register(registerSchema.parse(req.body));
    setSessionCookie(req, res, result.sessionId, result.expiresAt);
    res.status(201).json(result.business);
  });

  router.post('/login', async (req, res) => {
    const result = await service.login(loginSchema.parse(req.body));
    setSessionCookie(req, res, result.sessionId, result.expiresAt);
    res.json(result.business);
  });

  router.post('/logout', async (req, res) => {
    const sessionId = readSessionCookie(req);
    if (sessionId) await service.logout(sessionId);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', async (req, res) => {
    const sessionId = readSessionCookie(req);
    const business = sessionId ? await service.getBusinessForSession(sessionId) : undefined;
    if (!business) throw HttpError.unauthorized('Not logged in');
    res.json(business);
  });

  return router;
}
