import { z } from 'zod';
import { ANALYTICS_RANGES } from './analytics.service.js';

export const getSummaryQuerySchema = z.object({
  /** The page-wide "Show by" filter: week, month-to-date, year-to-date, or 12 months. */
  range: z.enum(ANALYTICS_RANGES).optional(),
});

export type GetSummaryQuery = z.infer<typeof getSummaryQuerySchema>;
