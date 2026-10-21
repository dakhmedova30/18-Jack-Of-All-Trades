import { Router } from 'express';
import { parseIdParam } from '../../utils/parseIdParam.js';
import {
  bulkDeleteSchema,
  createItemSchema,
  listItemsQuerySchema,
  updateItemSchema,
} from './items.schema.js';
import type { ItemService } from './items.service.js';

/**
 * HTTP layer: parse + validate input, call the service, shape the response.
 * Thrown errors (validation, 404s, database errors) are handled by the error
 * middleware; Express 5 forwards rejected promises from async handlers to it.
 *
 *   GET    /api/items?page=1&pageSize=10&search=soap
 *   GET    /api/items/low-stock     count + the 5 lowest items at or below the threshold
 *   GET    /api/items/:id
 *   POST   /api/items
 *   PATCH  /api/items/:id
 *   DELETE /api/items/:id
 *   POST   /api/items/bulk-delete   { "ids": [1, 2, 3] }
 */
export function createItemsRouter(service: ItemService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.listItems(listItemsQuerySchema.parse(req.query)));
  });

  router.post('/bulk-delete', async (req, res) => {
    const { ids } = bulkDeleteSchema.parse(req.body);
    res.json(await service.bulkDeleteItems(ids));
  });

  // Must stay above GET /:id, or "low-stock" would be parsed as an item id.
  router.get('/low-stock', async (_req, res) => {
    res.json(await service.getLowStock());
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.getItem(parseIdParam(req.params.id, 'item id')));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.createItem(createItemSchema.parse(req.body)));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseIdParam(req.params.id, 'item id');
    res.json(await service.updateItem(id, updateItemSchema.parse(req.body)));
  });

  router.delete('/:id', async (req, res) => {
    await service.deleteItem(parseIdParam(req.params.id, 'item id'));
    res.status(204).end();
  });

  return router;
}
