import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import type { Db } from '../db/database.js';
import { createAuthService } from '../modules/auth/auth.service.js';

/** Registers a fresh test business directly (no HTTP) and returns its id, for repository/service-level tests. */
export async function createTestBusiness(db: Db): Promise<number> {
  const auth = createAuthService(db);
  const { business } = await auth.register({
    name: 'Test Business',
    email: `test-${randomUUID()}@example.com`,
    password: 'password123',
  });
  return business.id;
}

/**
 * A supertest agent registered and logged in as a fresh test business; its
 * session cookie persists across every call made with it, like a real browser.
 */
export async function createAuthedAgent(app: Express): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .send({
      name: 'Test Business',
      email: `test-${randomUUID()}@example.com`,
      password: 'password123',
    })
    .expect(201);
  return agent;
}
