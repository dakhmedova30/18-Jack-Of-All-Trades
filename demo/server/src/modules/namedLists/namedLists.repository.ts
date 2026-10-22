import type { Queryable } from '../../db/database.js';

/** A short user-extendable list the forms pick from: sales channels, expense tags. */
export interface NamedEntry {
  id: number;
  name: string;
}

/** The tables shaped like this (id, unique-by-lower(name) name). Never user input. */
export type NamedListTable = 'channels' | 'expense_tags';

export function createNamedListRepository(db: Queryable, table: NamedListTable) {
  async function findAll(): Promise<NamedEntry[]> {
    const { rows } = await db.query<NamedEntry>(`SELECT id, name FROM ${table} ORDER BY id ASC`);
    return rows;
  }

  async function findById(id: number): Promise<NamedEntry | undefined> {
    const { rows } = await db.query<NamedEntry>(`SELECT id, name FROM ${table} WHERE id = $1`, [
      id,
    ]);
    return rows[0];
  }

  /** Case-insensitive, matching the unique index on lower(name). */
  async function findByName(name: string): Promise<NamedEntry | undefined> {
    const { rows } = await db.query<NamedEntry>(
      `SELECT id, name FROM ${table} WHERE lower(name) = lower($1)`,
      [name],
    );
    return rows[0];
  }

  async function insert(name: string): Promise<NamedEntry> {
    const { rows } = await db.query<NamedEntry>(
      `INSERT INTO ${table} (name) VALUES ($1) RETURNING id, name`,
      [name],
    );
    return rows[0]!;
  }

  return { findAll, findById, findByName, insert };
}

export type NamedListRepository = ReturnType<typeof createNamedListRepository>;
