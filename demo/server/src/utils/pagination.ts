import { z } from 'zod';

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export function toOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function buildPage<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
): Paginated<T> {
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Largest value a Postgres INTEGER column can hold. */
export const MAX_INT = 2_147_483_647;
