import { Router } from 'express';
import { parseIdParam } from '../../utils/parseIdParam.js';
import {
  bulkDeleteSchema,
  createItemSchema,
  listItemsQuerySchema,
  lowStockQuerySchema,
  updateItemSchema,
} from './items.schema.js';
import type { ItemService } from './items.service.js';

/**
 * HTTP layer: parse + validate input, call the service, shape the response.
 * Mounted behind requireAuth, so req.business is always set. Thrown errors
 * (validation, 404s, database errors) are handled by the error middleware;
 * Express 5 forwards rejected promises from async handlers to it.
 *
 *   GET    /api/items?page=1&pageSize=10&search=soap&sort=name&order=desc
 *   GET    /api/items/insights      stock value + this month's top 3 sellers
 *   GET    /api/items/low-stock?limit=5   count + the `limit` lowest items at or below the threshold
 *   GET    /api/items/:id
 *   POST   /api/items
 *   PATCH  /api/items/:id
 *   DELETE /api/items/:id
 *   POST   /api/items/bulk-delete   { "ids": [1, 2, 3] }
 */
export function createItemsRouter(service: ItemService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.listItems(req.business!.id, listItemsQuerySchema.parse(req.query)));
  });

  router.post('/bulk-delete', async (req, res) => {
    const { ids } = bulkDeleteSchema.parse(req.body);
    res.json(await service.bulkDeleteItems(req.business!.id, ids));
  });

  // These must stay above GET /:id, or "low-stock"/"insights" would be parsed as an item id.
  router.get('/insights', async (req, res) => {
    res.json(await service.getInsights(req.business!.id));
  });

  router.get('/low-stock', async (req, res) => {
    const { limit } = lowStockQuerySchema.parse(req.query);
    res.json(await service.getLowStock(req.business!.id, limit));
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.getItem(req.business!.id, parseIdParam(req.params.id, 'item id')));
  });

  router.post('/', async (req, res) => {
    res
      .status(201)
      .json(await service.createItem(req.business!.id, createItemSchema.parse(req.body)));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseIdParam(req.params.id, 'item id');
    res.json(await service.updateItem(req.business!.id, id, updateItemSchema.parse(req.body)));
  });

  router.delete('/:id', async (req, res) => {
    await service.deleteItem(req.business!.id, parseIdParam(req.params.id, 'item id'));
    res.status(204).end();
  });

  return router;
}
