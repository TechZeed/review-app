import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import type { Express } from 'express';
import type { Sequelize } from 'sequelize';
import { bootstrapTestStack } from './setup.js';

let app: Express;
let sequelize: Sequelize;
let teardown: (() => Promise<void>) | undefined;

const USER_ID = '55555555-5555-4555-8555-555555555555';
const SUB_ID = '66666666-6666-4666-8666-666666666666';
const EMAIL = 'recon-tier-only@test.local';
const PASSWORD = 'Recon_Test_Pass_007';

beforeAll(async () => {
  const stack = await bootstrapTestStack();
  app = stack.app;
  sequelize = stack.sequelize;
  teardown = stack.teardown;
}, 120_000);

afterAll(async () => {
  if (sequelize) {
    await sequelize.query(`DELETE FROM user_capabilities WHERE user_id = :userId`, {
      replacements: { userId: USER_ID },
    });
    await sequelize.query(`DELETE FROM subscriptions WHERE user_id = :userId`, {
      replacements: { userId: USER_ID },
    });
    await sequelize.query(`DELETE FROM users WHERE id = :userId`, {
      replacements: { userId: USER_ID },
    });
  }
  if (teardown) await teardown();
});

describe('GET /api/v1/subscriptions/me reconciliation self-heal', () => {
  it('self-heals missing capability for active paid tier and returns consistent response', async () => {
    const now = new Date();
    const periodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    await sequelize.query(`DELETE FROM user_capabilities WHERE user_id = :userId`, {
      replacements: { userId: USER_ID },
    });
    await sequelize.query(`DELETE FROM subscriptions WHERE user_id = :userId`, {
      replacements: { userId: USER_ID },
    });
    await sequelize.query(`DELETE FROM users WHERE id = :userId`, {
      replacements: { userId: USER_ID },
    });

    await sequelize.query(
      `INSERT INTO users
        (id, firebase_uid, email, phone, display_name, role, status, avatar_url, last_login_at, provider, password_hash, created_at, updated_at)
       VALUES
        (:id, NULL, :email, NULL, :name, 'INDIVIDUAL', 'active', NULL, NULL, 'internal', :passwordHash, :now, :now)`,
      {
        replacements: {
          id: USER_ID,
          email: EMAIL,
          name: 'Reconciliation User',
          passwordHash,
          now,
        },
      },
    );

    await sequelize.query(
      `INSERT INTO subscriptions
        (id, user_id, tier, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at)
       VALUES
        (:id, :userId, 'recruiter', NULL, NULL, 'active', :now, :periodEnd, :now, :now)`,
      {
        replacements: {
          id: SUB_ID,
          userId: USER_ID,
          now,
          periodEnd,
        },
      },
    );

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);

    const token = login.body.accessToken as string;
    const me = await request(app)
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.reconciliation).toEqual({
      consistent: false,
      issues: ['tier-without-capability'],
    });
    expect(Array.isArray(me.body.capabilities)).toBe(true);
    expect(me.body.capabilities.some((c: { capability: string }) => c.capability === 'recruiter')).toBe(true);

    const [rows] = await sequelize.query(
      `SELECT capability, source, subscription_id, expires_at
       FROM user_capabilities
       WHERE user_id = :userId AND capability = 'recruiter'
       ORDER BY granted_at DESC`,
      { replacements: { userId: USER_ID } },
    );

    const healedRows = rows as Array<{
      capability: string;
      source: string;
      subscription_id: string | null;
      expires_at: Date | string | null;
    }>;
    expect(healedRows.length).toBeGreaterThan(0);
    expect(healedRows[0]?.source).toBe('subscription');
    expect(healedRows[0]?.subscription_id).toBe(SUB_ID);
    expect(healedRows[0]?.expires_at).toBeTruthy();
    const healedExpiry = new Date(healedRows[0]!.expires_at as string);
    expect(healedExpiry.getTime()).toBeGreaterThan(now.getTime());
    expect(healedExpiry.toISOString()).toBe(periodEnd.toISOString());

    const meAfterHeal = await request(app)
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meAfterHeal.status).toBe(200);
    expect(meAfterHeal.body.reconciliation).toEqual({ consistent: true, issues: [] });
  });
});
