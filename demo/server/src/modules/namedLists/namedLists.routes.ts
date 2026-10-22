import { Router } from 'express';
import type { NamedListService } from './namedLists.service.js';

/**
 * HTTP layer, mounted once per list (/api/channels, /api/expense-tags), behind
 * requireAuth so req.business is always set:
 *
 *   GET  /            every entry for this business, oldest first (not paginated)
 *   POST /            { "name": "Etsy" }
 */
export function createNamedListRouter(service: NamedListService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.list(req.business!.id));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.business!.id, req.body));
  });

  return router;
}
