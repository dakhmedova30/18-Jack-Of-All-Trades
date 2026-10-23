import pg from 'pg';
import { runMigrations } from './schema.js';

/**
 * PostgreSQL connection pool. Works with any hosted Postgres (AWS RDS, Neon,
 * Supabase, Render) or a local one; only DATABASE_URL changes.
 */
export type Db = pg.Pool;

/** Anything that can run a query: the pool, or a single client inside a transaction. */
export type Queryable = pg.Pool | pg.PoolClient;

/**
 * - disable: no SSL (local databases)
 * - require: encrypted, certificate not verified (simplest for RDS and most hosts)
 * - verify:  encrypted and certificate verified (needs a CA the host trusts)
 */
export type SslMode = 'disable' | 'require' | 'verify';

export interface DatabaseOptions {
  connectionString: string;
  /** Defaults to "disable" for localhost and "require" for everything else. */
  ssl?: SslMode;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function inferSslMode(url: URL): SslMode {
  return LOCAL_HOSTS.has(url.hostname) ? 'disable' : 'require';
}

/**
 * Host and local/online label for a DATABASE_URL, safe to log (never includes
 * the username or password). Lets `npm run dev`/`npm start` state plainly which
 * database they're talking to, instead of leaving that to whoever reads .env.
 */
export function describeConnectionTarget(connectionString: string): string {
  try {
    const { hostname } = new URL(connectionString);
    return `${hostname} (${LOCAL_HOSTS.has(hostname) ? 'local' : 'online'})`;
  } catch {
    return 'unknown host';
  }
}

function toPoolConfig({ connectionString, ssl }: DatabaseOptions): pg.PoolConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL (expected postgres://user:pass@host:5432/db)');
  }
  const mode = ssl ?? inferSslMode(url);

  // Providers often append ?sslmode=... to the URL. Drop it so the `ssl` option
  // below is the single source of truth (the pg driver would otherwise let it win).
  url.searchParams.delete('sslmode');

  return {
    connectionString: url.toString(),
    ssl: mode === 'disable' ? false : { rejectUnauthorized: mode === 'verify' },
    max: 5,
    connectionTimeoutMillis: 10_000,
  };
}

/** Connects, verifies the connection, and creates any missing tables. */
export async function connectDatabase(options: DatabaseOptions): Promise<Db> {
  const pool = new pg.Pool(toPoolConfig(options));
  pool.on('error', (error) => {
    // An idle client lost its connection (e.g. the database restarted). The pool
    // replaces it automatically; log instead of crashing the process.
    console.error('Postgres pool error:', error.message);
  });

  try {
    await runMigrations(pool);
  } catch (error) {
    await pool.end();
    throw error;
  }
  return pool;
}

/** Runs `work` atomically: everything is committed, or nothing is if it throws. */
export async function runInTransaction<T>(
  db: Db,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
