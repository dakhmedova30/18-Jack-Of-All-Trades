import { Router } from 'express';
import { parseIdParam } from '../../utils/parseIdParam.js';
import {
  bulkDeleteExpensesSchema,
  createExpenseSchema,
  listExpensesQuerySchema,
  updateExpenseSchema,
} from './expenses.schema.js';
import type { ExpenseService } from './expenses.service.js';

/**
 * HTTP layer: parse + validate input, call the service, shape the response.
 *
 *   GET    /api/expenses?page=1&pageSize=10&search=soap
 *   GET    /api/expenses/month-breakdown   this month's restock vs running-cost spending
 *   GET    /api/expenses/:id
 *   POST   /api/expenses               { incurredAt, tags?, items: [{ itemId?, description?, quantity, unitCostCents }] }
 *   PATCH  /api/expenses/:id           replaces incurredAt, tags and the whole item list
 *   DELETE /api/expenses/:id
 *   POST   /api/expenses/bulk-delete   { "ids": [1, 2, 3] }
 */
export function createExpensesRouter(service: ExpenseService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.listExpenses(listExpensesQuerySchema.parse(req.query)));
  });

  router.post('/bulk-delete', async (req, res) => {
    const { ids } = bulkDeleteExpensesSchema.parse(req.body);
    res.json(await service.bulkDeleteExpenses(ids));
  });

  // Must stay above GET /:id, or "month-breakdown" would be parsed as an expense id.
  router.get('/month-breakdown', async (_req, res) => {
    res.json(await service.getMonthBreakdown());
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.getExpense(parseIdParam(req.params.id, 'expense id')));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.recordExpense(createExpenseSchema.parse(req.body)));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseIdParam(req.params.id, 'expense id');
    res.json(await service.updateExpense(id, updateExpenseSchema.parse(req.body)));
  });

  router.delete('/:id', async (req, res) => {
    await service.deleteExpense(parseIdParam(req.params.id, 'expense id'));
    res.status(204).end();
  });

  return router;
}
