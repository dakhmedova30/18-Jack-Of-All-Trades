import { hashPassword } from '../utils/passwords.js';
import type { Queryable } from './database.js';

/**
 * The one business that owns pre-existing demo data: rows seeded (or recorded)
 * before auth existed, backfilled to it by the migration in schema.ts, and
 * every `npm run seed` item/sale/expense going forward. Lets the team log into
 * the already-deployed demo without losing any of its data.
 */
export const DEMO_BUSINESS_NAME = 'Demo Business';
export const DEMO_BUSINESS_EMAIL = 'demo@jackofalltrades.test';
export const DEMO_BUSINESS_PASSWORD = 'ChangeMe123!';

/** Creates the demo business if it doesn't exist yet, and returns its id either way. */
export async function ensureDemoBusiness(db: Queryable): Promise<number> {
  const existing = await db.query<{ id: number }>('SELECT id FROM businesses WHERE email = $1', [
    DEMO_BUSINESS_EMAIL,
  ]);
  if (existing.rows[0]) return existing.rows[0].id;

  // Only hash (deliberately slow) when actually inserting, not on every startup.
  const passwordHash = await hashPassword(DEMO_BUSINESS_PASSWORD);
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO businesses (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [DEMO_BUSINESS_NAME, DEMO_BUSINESS_EMAIL, passwordHash],
  );
  return rows[0]!.id;
}
