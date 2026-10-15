import { Router } from 'express';
import { parseIdParam } from '../../utils/parseIdParam.js';
import {
  bulkDeleteSalesSchema,
  createSaleSchema,
  listSalesQuerySchema,
  updateSaleSchema,
} from './sales.schema.js';
import type { SaleService } from './sales.service.js';

/**
 * HTTP layer: parse + validate input, call the service, shape the response.
 *
 *   GET    /api/sales?page=1&pageSize=10&search=soap
 *   GET    /api/sales/:id
 *   POST   /api/sales               { soldAt, tags?, items: [{ itemId, quantity }] }
 *   PATCH  /api/sales/:id           replaces soldAt, tags and the whole item list
 *   DELETE /api/sales/:id
 *   POST   /api/sales/bulk-delete   { "ids": [1, 2, 3] }
 */
export function createSalesRouter(service: SaleService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.listSales(listSalesQuerySchema.parse(req.query)));
  });

  router.post('/bulk-delete', async (req, res) => {
    const { ids } = bulkDeleteSalesSchema.parse(req.body);
    res.json(await service.bulkDeleteSales(ids));
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.getSale(parseIdParam(req.params.id, 'sale id')));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.recordSale(createSaleSchema.parse(req.body)));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseIdParam(req.params.id, 'sale id');
    res.json(await service.updateSale(id, updateSaleSchema.parse(req.body)));
  });

  router.delete('/:id', async (req, res) => {
    await service.deleteSale(parseIdParam(req.params.id, 'sale id'));
    res.status(204).end();
  });

  return router;
}
