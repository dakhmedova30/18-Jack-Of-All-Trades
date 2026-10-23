import { Router } from 'express';
import { getSummaryQuerySchema } from './analytics.schema.js';
import type { AnalyticsService } from './analytics.service.js';

/**
 *   GET /api/analytics/summary?range=ytd
 *
 * One endpoint for the whole dashboard: it's logically a single view. `range`
 * is the page-wide "Show by" filter — one of week, month, ytd, 12months
 * (default) — and it drives every chart and total together (Revenue Overview,
 * Expenses Overview, the Sales Overview donut, Net Profit/Revenue/Expenses).
 * Mounted behind requireAuth, so req.business is always set.
 */
export function createAnalyticsRouter(service: AnalyticsService): Router {
  const router = Router();

  router.get('/summary', async (req, res) => {
    const { range } = getSummaryQuerySchema.parse(req.query);
    res.json(await service.getSummary(req.business!.id, { range }));
  });

  /** GET /api/analytics/inventory — current stock by first tag (a snapshot; no `range`). */
  router.get('/inventory', async (req, res) => {
    res.json(await service.getInventoryByTag(req.business!.id));
  });

  return router;
}
