import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

/**
 * Every error response has the same shape so the frontend can handle it in one place:
 *   { "error": { "message": string, "details"?: [{ "field": string, "message": string }] } }
 */

/** Postgres error codes caused by bad input rather than a server bug. */
const POSTGRES_CLIENT_ERRORS: Record<string, string> = {
  '23503': 'Referenced record does not exist',
  '23505': 'A record with that value already exists',
  '23514': 'Value is not allowed',
  '22003': 'Number is out of range',
  '22P02': 'Invalid value',
};

/** Network-level failures reaching the database. */
const CONNECTION_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET']);

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }

  if (isJsonBodyParseError(err)) {
    res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
    return;
  }

  const code = getErrorCode(err);
  if (code && code in POSTGRES_CLIENT_ERRORS) {
    res.status(400).json({ error: { message: POSTGRES_CLIENT_ERRORS[code] } });
    return;
  }
  if (code && CONNECTION_ERROR_CODES.has(code)) {
    console.error('Database unreachable:', err);
    res.status(503).json({ error: { message: 'Database is unavailable, try again shortly' } });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const { code } = err as { code: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function isJsonBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === 'entity.parse.failed'
  );
}
