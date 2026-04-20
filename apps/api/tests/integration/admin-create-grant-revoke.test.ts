import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Sequelize } from 'sequelize';
import { bootstrapTestStack } from './setup.js';
import type { SeededTestData } from './seed.js';

let app: Express;
let seeded: SeededTestData;
let sequelize: Sequelize;
let teardown: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const stack = await bootstrapTestStack();
  app = stack.app;
  sequelize = stack.sequelize;
  seeded = stack.seeded as SeededTestData;
  teardown = stack.teardown;
}, 120_000);

afterAll(async () => {
  if (teardown) await teardown();
});

async function loginAsAdmin(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@test.local', password: 'Test_Admin_Pass_007' });

  expect(res.status).toBe(200);
  const token = res.body?.accessToken ?? res.body?.data?.accessToken;
  expect(typeof token).toBe('string');
  return token as string;
}

describe('Admin create/grant/revoke endpoints', () => {
  it('POST /api/v1/auth/admin/create-user creates an internal account row', async () => {
    const token = await loginAsAdmin();
    const email = `spec44+${randomUUID()}@test.local`;

    const createRes = await request(app)
      .post('/api/v1/auth/admin/create-user')
      .set('authorization', `Bearer ${token}`)
      .send({
        email,
        password: 'AdminCreate_1234',
        name: 'Spec 44 Created',
        role: 'INDIVIDUAL',
        phone: '+6590011223',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body?.user?.email).toBe(email);
    const [rows] = await sequelize.query<{ email: string; provider: string; phone: string | null }>(
      'SELECT email, provider, phone FROM users WHERE email = :email LIMIT 1',
      { replacements: { email } },
    );
    expect(rows).toEqual([{ email, provider: 'internal', phone: '+6590011223' }]);
  });

  it('POST /api/v1/auth/admin/users/:id/capabilities inserts active user_capabilities row', async () => {
    const token = await loginAsAdmin();
    const targetUserId = seeded.users.individual.id;

    const grantRes = await request(app)
      .post(`/api/v1/auth/admin/users/${targetUserId}/capabilities`)
      .set('authorization', `Bearer ${token}`)
      .send({ capability: 'recruiter', reason: 'spec-44-test' });

    expect(grantRes.status).toBe(201);
    expect(Array.isArray(grantRes.body?.capabilities)).toBe(true);
    expect(grantRes.body.capabilities.some((c: { capability: string }) => c.capability === 'recruiter')).toBe(true);
    const [rows] = await sequelize.query<{ capability: string; expires_at: Date | null }>(
      `SELECT capability, expires_at
       FROM user_capabilities
       WHERE user_id = :userId AND capability = 'recruiter'
       ORDER BY granted_at DESC
       LIMIT 1`,
      { replacements: { userId: targetUserId } },
    );
    expect(rows[0]).toMatchObject({ capability: 'recruiter', expires_at: null });
  });

  it('DELETE /api/v1/auth/admin/users/:id/capabilities/:capability sets expires_at', async () => {
    const token = await loginAsAdmin();
    const targetUserId = seeded.users.individual.id;

    const grantRes = await request(app)
      .post(`/api/v1/auth/admin/users/${targetUserId}/capabilities`)
      .set('authorization', `Bearer ${token}`)
      .send({ capability: 'recruiter', reason: 'spec-44-test' });
    expect(grantRes.status).toBe(201);

    const revokeRes = await request(app)
      .delete(`/api/v1/auth/admin/users/${targetUserId}/capabilities/recruiter`)
      .set('authorization', `Bearer ${token}`);

    expect(revokeRes.status).toBe(200);
    expect(Array.isArray(revokeRes.body?.capabilities)).toBe(true);
    expect(revokeRes.body.capabilities.some((c: { capability: string }) => c.capability === 'recruiter')).toBe(false);
    const [rows] = await sequelize.query<{ expires_at: Date | null }>(
      `SELECT expires_at
       FROM user_capabilities
       WHERE user_id = :userId AND capability = 'recruiter'
       ORDER BY granted_at DESC
       LIMIT 1`,
      { replacements: { userId: targetUserId } },
    );
    expect(rows[0]?.expires_at).toBeTruthy();
  });
});
