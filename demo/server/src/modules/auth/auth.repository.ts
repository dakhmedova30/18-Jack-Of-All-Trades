import { randomBytes } from 'node:crypto';
import type { Queryable } from '../../db/database.js';

/** Business as returned by the API (camelCase). Never includes the password hash. */
export interface Business {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface BusinessRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

function toBusiness(row: BusinessRow): Business {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at.toISOString() };
}

/** 30 days. Matches the cookie's `expires` (set alongside the session row). */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function createAuthRepository(db: Queryable) {
  async function findBusinessByEmail(
    email: string,
  ): Promise<(Business & { passwordHash: string }) | undefined> {
    const { rows } = await db.query<BusinessRow>('SELECT * FROM businesses WHERE email = $1', [
      email,
    ]);
    const row = rows[0];
    return row ? { ...toBusiness(row), passwordHash: row.password_hash } : undefined;
  }

  async function insertBusiness(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<Business> {
    const { rows } = await db.query<BusinessRow>(
      `INSERT INTO businesses (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [input.name, input.email, input.passwordHash],
    );
    return toBusiness(rows[0]!);
  }

  async function createSession(businessId: number): Promise<{ id: string; expiresAt: Date }> {
    const id = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.query('INSERT INTO sessions (id, business_id, expires_at) VALUES ($1, $2, $3)', [
      id,
      businessId,
      expiresAt,
    ]);
    return { id, expiresAt };
  }

  /** The logged-in business for a session id, or undefined if it's missing or expired. */
  async function findBusinessBySession(sessionId: string): Promise<Business | undefined> {
    const { rows } = await db.query<BusinessRow>(
      `SELECT b.* FROM sessions s
       JOIN businesses b ON b.id = s.business_id
       WHERE s.id = $1 AND s.expires_at > now()`,
      [sessionId],
    );
    return rows[0] ? toBusiness(rows[0]) : undefined;
  }

  async function deleteSession(sessionId: string): Promise<void> {
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  return {
    findBusinessByEmail,
    insertBusiness,
    createSession,
    findBusinessBySession,
    deleteSession,
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
