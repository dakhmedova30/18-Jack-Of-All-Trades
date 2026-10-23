import type { Queryable } from '../../db/database.js';

/** A short user-extendable list the forms pick from: sales channels, expense tags. */
export interface NamedEntry {
  id: number;
  name: string;
}

/** The tables shaped like this (id, business_id, unique-by-(business_id, lower(name)) name). Never user input. */
export type NamedListTable = 'channels' | 'expense_tags';

export function createNamedListRepository(db: Queryable, table: NamedListTable) {
  async function findAll(businessId: number): Promise<NamedEntry[]> {
    const { rows } = await db.query<NamedEntry>(
      `SELECT id, name FROM ${table} WHERE business_id = $1 ORDER BY id ASC`,
      [businessId],
    );
    return rows;
  }

  async function findById(businessId: number, id: number): Promise<NamedEntry | undefined> {
    const { rows } = await db.query<NamedEntry>(
      `SELECT id, name FROM ${table} WHERE id = $1 AND business_id = $2`,
      [id, businessId],
    );
    return rows[0];
  }

  /** Case-insensitive, matching the unique index on (business_id, lower(name)). */
  async function findByName(businessId: number, name: string): Promise<NamedEntry | undefined> {
    const { rows } = await db.query<NamedEntry>(
      `SELECT id, name FROM ${table} WHERE business_id = $1 AND lower(name) = lower($2)`,
      [businessId, name],
    );
    return rows[0];
  }

  async function insert(businessId: number, name: string): Promise<NamedEntry> {
    const { rows } = await db.query<NamedEntry>(
      `INSERT INTO ${table} (business_id, name) VALUES ($1, $2) RETURNING id, name`,
      [businessId, name],
    );
    return rows[0]!;
  }

  return { findAll, findById, findByName, insert };
}

export type NamedListRepository = ReturnType<typeof createNamedListRepository>;
