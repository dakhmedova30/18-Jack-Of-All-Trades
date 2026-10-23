import type pg from 'pg';
import { ensureDemoBusiness } from './demoBusiness.js';
import { seedStarterNamedLists } from './starterNamedLists.js';

/**
 * Idempotent schema setup, run on every startup. Money is always stored as
 * integer cents to avoid floating-point rounding errors.
 *
 * When the schema needs to change after the team has real data, switch this to
 * numbered migration files (or adopt a migration tool) instead of editing these
 * CREATE statements.
 */

/**
 * businesses/sessions must exist (and any pre-existing rows in the tables below
 * must already have a business_id) before the CREATE TABLE statements below run,
 * since those reference businesses(id). See ensureBusinessScoping.
 */
const BUSINESSES_AND_SESSIONS = `
  CREATE TABLE IF NOT EXISTS businesses (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_business_id ON sessions (business_id);
`;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS items (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id      INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    tags             TEXT[]      NOT NULL DEFAULT '{}',
    note             TEXT        NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_items_business_id ON items (business_id);
  CREATE INDEX IF NOT EXISTS idx_items_name ON items (name);

  -- Where a sale happened (in person, online, ...). Each business has its own
  -- list and can add their own; new businesses get a starter set (see
  -- auth.service#register), the same four every single-tenant database used to
  -- get for free from this file.
  CREATE TABLE IF NOT EXISTS channels (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_business_name
    ON channels (business_id, lower(name));

  -- A sale is one transaction (one checkout); its line items are in sale_items.
  CREATE TABLE IF NOT EXISTS sales (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    sold_at     TIMESTAMPTZ NOT NULL,
    tags        TEXT[]      NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Added after sales first shipped, so ALTER rather than CREATE keeps existing
  -- databases working. channel_id is nullable only for sales recorded before it
  -- existed; the API requires it on every new or edited sale. Don't rename it to
  -- "channel": DROP_LEGACY_SALES_TABLE below treats that column as the old schema.
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS channel_id  INTEGER REFERENCES channels (id);
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

  CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales (business_id);
  CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales (sold_at);

  CREATE TABLE IF NOT EXISTS sale_items (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id          INTEGER     NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    -- item_id is kept nullable, and item_name is snapshotted, so a sale's history
    -- stays intact (and still displays a name) even if the item is later renamed or deleted.
    item_id          INTEGER     REFERENCES items (id) ON DELETE SET NULL,
    item_name        TEXT        NOT NULL,
    quantity         INTEGER     NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    total_cents      INTEGER     NOT NULL DEFAULT 0 CHECK (total_cents >= 0)
  );

  CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
  CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items (item_id);

  -- An expense is one transaction (e.g. a supplier order or a bill); its lines
  -- are in expense_items. A line either restocks an inventory item (item_id set,
  -- quantity added back to stock) or is a free-text cost with no stock effect.
  CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    incurred_at TIMESTAMPTZ NOT NULL,
    tags        TEXT[]      NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Added later, like sales.description; blank on expenses recorded before it.
  ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

  CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses (business_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_incurred_at ON expenses (incurred_at);

  -- The choices in the expense form's Tag dropdown; same per-business model as
  -- channels. An expense still stores its tag in expenses.tags, so charts and
  -- search are unchanged.
  CREATE TABLE IF NOT EXISTS expense_tags (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_tags_business_name
    ON expense_tags (business_id, lower(name));

  CREATE TABLE IF NOT EXISTS expense_items (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_id      INTEGER     NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
    -- item_id is kept nullable, and item_name is snapshotted, same reasoning as
    -- sale_items. A line with item_id null is a free-text expense (e.g. "Rent").
    item_id         INTEGER     REFERENCES items (id) ON DELETE SET NULL,
    item_name       TEXT        NOT NULL,
    quantity        INTEGER     NOT NULL CHECK (quantity > 0),
    unit_cost_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
    total_cents     INTEGER     NOT NULL DEFAULT 0 CHECK (total_cents >= 0)
  );

  CREATE INDEX IF NOT EXISTS idx_expense_items_expense_id ON expense_items (expense_id);
  CREATE INDEX IF NOT EXISTS idx_expense_items_item_id ON expense_items (item_id);
`;

/**
 * One-time compatibility step for databases created before sales held line items
 * (when a sale was one item/amount/channel/location row). Detected by the
 * now-removed "channel" column. There's no real sales data yet anywhere this
 * runs, so dropping and letting the CREATE statements above rebuild it is safe.
 * Remove this once the team adopts numbered migrations.
 */
const DROP_LEGACY_SALES_TABLE = `
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'channel'
    ) THEN
      DROP TABLE sales CASCADE;
    END IF;
  END $$;
`;

/**
 * One-time compatibility step for databases that have items/sales/expenses/
 * channels/expense_tags from before business accounts existed. Backfills every
 * existing row onto one "Demo Business" (see demoBusiness.ts) so no data is
 * orphaned or lost, then makes business_id required. A brand-new database
 * never hits this: its tables are created by SCHEMA above with business_id
 * required from the start.
 */
async function ensureBusinessScoping(client: pg.PoolClient): Promise<number | undefined> {
  const { rows } = await client.query<{ needs_migration: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'items'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'items' AND column_name = 'business_id'
    ) AS needs_migration
  `);
  if (!rows[0]?.needs_migration) return undefined;

  const businessId = await ensureDemoBusiness(client);
  for (const table of ['items', 'sales', 'expenses']) {
    await client.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses (id) ON DELETE CASCADE`,
    );
    await client.query(`UPDATE ${table} SET business_id = $1 WHERE business_id IS NULL`, [
      businessId,
    ]);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN business_id SET NOT NULL`);
  }

  // channels/expense_tags predate business accounts too, and had a global
  // unique-by-name index; drop it before backfilling so the new per-business
  // one (in SCHEMA) can be created without a leftover conflicting index.
  for (const { table, legacyIndex } of [
    { table: 'channels', legacyIndex: 'idx_channels_name' },
    { table: 'expense_tags', legacyIndex: 'idx_expense_tags_name' },
  ]) {
    const exists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
      [table],
    );
    if (!exists.rows[0]?.exists) continue;

    await client.query(`DROP INDEX IF EXISTS ${legacyIndex}`);
    await client.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses (id) ON DELETE CASCADE`,
    );
    await client.query(`UPDATE ${table} SET business_id = $1 WHERE business_id IS NULL`, [
      businessId,
    ]);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN business_id SET NOT NULL`);
  }

  return businessId;
}

/** Arbitrary key so two server instances starting at once don't race on CREATE TABLE. */
const MIGRATION_LOCK_KEY = 704_2026;

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(BUSINESSES_AND_SESSIONS);
    const migratedBusinessId = await ensureBusinessScoping(client);
    await client.query(DROP_LEGACY_SALES_TABLE);
    await client.query(SCHEMA);
    // Only after SCHEMA has run: channels/expense_tags may not have existed
    // yet (a database from before those tables shipped), and a migrated
    // business still needs starter rows whenever it didn't already have any.
    if (migratedBusinessId !== undefined) {
      await seedStarterNamedLists(client, migratedBusinessId);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
