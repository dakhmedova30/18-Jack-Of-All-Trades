import type { Db } from '../../db/database.js';
import { seedStarterNamedLists } from '../../db/starterNamedLists.js';
import { HttpError } from '../../utils/httpError.js';
import { hashPassword, verifyPassword } from '../../utils/passwords.js';
import { createAuthRepository, type Business } from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

export interface AuthResult {
  business: Business;
  sessionId: string;
  expiresAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

/** Business-owner accounts and sessions. Customer accounts are out of scope for now. */
export function createAuthService(db: Db) {
  const repository = createAuthRepository(db);

  async function register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await hashPassword(input.password);
    let business: Business;
    try {
      business = await repository.insertBusiness({
        name: input.name,
        email: input.email,
        passwordHash,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw HttpError.badRequest('An account with that email already exists');
      }
      throw error;
    }

    // Gives the new business the same starter channels/expense tags every
    // single-tenant database used to seed for free (see starterNamedLists.ts).
    await seedStarterNamedLists(db, business.id);

    const session = await repository.createSession(business.id);
    return { business, sessionId: session.id, expiresAt: session.expiresAt };
  }

  async function login(input: LoginInput): Promise<AuthResult> {
    const found = await repository.findBusinessByEmail(input.email);
    // Same message either way (unknown email vs. wrong password), so a failed
    // login never reveals whether an email is registered.
    if (!found || !(await verifyPassword(input.password, found.passwordHash))) {
      throw HttpError.unauthorized('Incorrect email or password');
    }

    const session = await repository.createSession(found.id);
    const { passwordHash: _passwordHash, ...business } = found;
    return { business, sessionId: session.id, expiresAt: session.expiresAt };
  }

  function logout(sessionId: string): Promise<void> {
    return repository.deleteSession(sessionId);
  }

  function getBusinessForSession(sessionId: string): Promise<Business | undefined> {
    return repository.findBusinessBySession(sessionId);
  }

  return { register, login, logout, getBusinessForSession };
}

export type AuthService = ReturnType<typeof createAuthService>;
