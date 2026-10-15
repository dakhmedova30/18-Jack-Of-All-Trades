import { z } from 'zod';
import { HttpError } from './httpError.js';
import { MAX_INT } from './pagination.js';

const idSchema = z.coerce.number().int().positive().max(MAX_INT);

/** Parses a route `:id` parameter, throwing a 400 when it is not a positive integer. */
export function parseIdParam(rawId: string | undefined, resource = 'id'): number {
  const result = idSchema.safeParse(rawId);
  if (!result.success) {
    throw HttpError.badRequest(`Invalid ${resource}: "${rawId}"`);
  }
  return result.data;
}
