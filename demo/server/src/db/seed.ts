import { loadConfig } from '../config.js';
import { connectDatabase, describeConnectionTarget } from './database.js';
import { seedSampleItems } from './sampleData.js';

/**
 * Fills the database in DATABASE_URL with sample inventory.
 *   npm run seed            -> only seeds an empty database
 *   npm run seed -- --force -> wipes items and sales first
 */
async function main(): Promise<void> {
  const config = loadConfig();
  console.log(`Seeding: ${describeConnectionTarget(config.databaseUrl)}`);
  const db = await connectDatabase({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl,
  });
  try {
    const result = await seedSampleItems(db, { force: process.argv.includes('--force') });
    if ('skipped' in result) {
      console.log(
        `Database already has ${result.existing} items. Run "npm run seed -- --force" to reset it.`,
      );
    } else {
      console.log(
        `Seeded ${result.seeded} items, ${result.sales} sales, ${result.expenses} expenses.`,
      );
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seeding failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
