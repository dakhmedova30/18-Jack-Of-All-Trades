import type pg from 'pg';

/**
 * Idempotent schema setup, run on every startup. Money is always stored as
 * integer cents to avoid floating-point rounding errors.
 *
 * When the schema needs to change after the team has real data, switch this to
 * numbered migration files (or adopt a migration tool) instead of editing these
 * CREATE statements.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS items (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             TEXT        NOT NULL,
    quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    tags             TEXT[]      NOT NULL DEFAULT '{}',
    note             TEXT        NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_items_name ON items (name);

  -- A sale is one transaction (one checkout); its line items are in sale_items.
  CREATE TABLE IF NOT EXISTS sales (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sold_at    TIMESTAMPTZ NOT NULL,
    tags       TEXT[]      NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

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

/** Arbitrary key so two server instances starting at once don't race on CREATE TABLE. */
const MIGRATION_LOCK_KEY = 704_2026;

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(DROP_LEGACY_SALES_TABLE);
    await client.query(SCHEMA);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
