import { Router } from 'express';
import type { NamedListService } from './namedLists.service.js';

/**
 * HTTP layer, mounted once per list (/api/channels, /api/expense-tags):
 *
 *   GET  /            every entry, oldest first (not paginated)
 *   POST /            { "name": "Etsy" }
 */
export function createNamedListRouter(service: NamedListService): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await service.list());
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.body));
  });

  return router;
}
