import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './db/database.js';
import { seedSampleItems } from './db/sampleData.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = await connectDatabase({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl,
  });
  console.log('Connected to Postgres');

  if (config.seedIfEmpty) {
    const result = await seedSampleItems(db);
    if ('seeded' in result) {
      console.log(
        `Seeded ${result.seeded} sample items, ${result.sales} sales, ${result.expenses} expenses`,
      );
    }
  }

  const app = createApp(db, { clientDistPath: config.clientDistPath });

  const server = app.listen(config.port, (error?: Error) => {
    if (error) {
      console.error(`Could not start the server on port ${config.port}:`, error.message);
      void db.end().finally(() => process.exit(1));
      return;
    }
    console.log(`Server listening on http://localhost:${config.port}`);
  });

  function shutdown(signal: NodeJS.Signals): void {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      void db.end().finally(() => process.exit(0));
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error('Failed to start:', error instanceof Error ? error.message : error);
  console.error(
    'Check that DATABASE_URL is correct and that the database accepts connections from this machine.',
  );
  process.exit(1);
});
