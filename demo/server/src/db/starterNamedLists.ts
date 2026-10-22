import type { Queryable } from './database.js';

/** The same starter channels/expense tags every single-tenant database used to
 *  seed for free (see the old global INSERTs this replaced in schema.ts). */
const STARTER_CHANNELS = ['In person', 'Online', 'Commission', 'Misc'];
const STARTER_EXPENSE_TAGS = ['supplier', 'supplies', 'rent', 'utilities', 'market'];

/**
 * Gives a business its starter channels/expense tags, but only for whichever
 * of the two lists it doesn't already have any rows in. Safe to call after a
 * migration backfill (which may have already given the business existing
 * rows reassigned from before accounts existed) as well as for a brand-new
 * business (always empty) — never creates duplicates either way.
 */
export async function seedStarterNamedLists(db: Queryable, businessId: number): Promise<void> {
  const channelCount = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM channels WHERE business_id = $1',
    [businessId],
  );
  if ((channelCount.rows[0]?.count ?? 0) === 0) {
    for (const name of STARTER_CHANNELS) {
      await db.query('INSERT INTO channels (business_id, name) VALUES ($1, $2)', [
        businessId,
        name,
      ]);
    }
  }

  const tagCount = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM expense_tags WHERE business_id = $1',
    [businessId],
  );
  if ((tagCount.rows[0]?.count ?? 0) === 0) {
    for (const name of STARTER_EXPENSE_TAGS) {
      await db.query('INSERT INTO expense_tags (business_id, name) VALUES ($1, $2)', [
        businessId,
        name,
      ]);
    }
  }
}
