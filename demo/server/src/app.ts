import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import type { Db } from './db/database.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import { createAnalyticsService } from './modules/analytics/analytics.service.js';
import { createExpensesRouter } from './modules/expenses/expenses.routes.js';
import { createExpenseService } from './modules/expenses/expenses.service.js';
import { createItemRepository } from './modules/items/items.repository.js';
import { createItemsRouter } from './modules/items/items.routes.js';
import { createItemService } from './modules/items/items.service.js';
import { createSalesRouter } from './modules/sales/sales.routes.js';
import { createSaleService } from './modules/sales/sales.service.js';

export interface AppOptions {
  /** Folder with the built React app. When it exists, Express serves the website too. */
  clientDistPath?: string;
}

/**
 * Builds the Express app around a database pool. Taking the pool as a parameter
 * (instead of importing a global) lets tests use their own database.
 *
 * Layering for every module: routes (HTTP) -> service (rules) -> repository (SQL).
 */
export function createApp(db: Db, options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // hosts like Render sit behind a proxy
  app.use(express.json({ limit: '100kb' }));

  const itemRepository = createItemRepository(db);
  const itemService = createItemService(itemRepository);
  // Sales and expenses keep inventory stock in sync on every write, so they
  // need the pool itself to run multi-table transactions, not a bound repository.
  const saleService = createSaleService(db);
  const expenseService = createExpenseService(db);
  const analyticsService = createAnalyticsService(db);

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  });
  app.use('/api/items', createItemsRouter(itemService));
  app.use('/api/sales', createSalesRouter(saleService));
  app.use('/api/expenses', createExpensesRouter(expenseService));
  app.use('/api/analytics', createAnalyticsRouter(analyticsService));
  app.use('/api', notFoundHandler);

  if (options.clientDistPath && fs.existsSync(path.join(options.clientDistPath, 'index.html'))) {
    serveClient(app, options.clientDistPath);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/**
 * Serves the built React app. Hashed asset files are cached long-term; every
 * other GET (e.g. /inventory) returns index.html so React Router can handle it.
 */
function serveClient(app: Express, distPath: string): void {
  const indexHtml = path.join(distPath, 'index.html');
  app.use(
    '/assets',
    express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' }),
  );
  app.use(express.static(distPath, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(indexHtml);
  });
}
