import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TEST_PASSWORD } from './test-database';

const EMAIL_BY_USER_ID: Record<string, string> = {
  u1: 'test-employee@test.local',
  'dev-manager': 'test-manager@test.local',
  'dev-employee': 'test-dev-employee@test.local',
  'admin-1': 'test-admin@test.local',
};

export async function login(
  app: INestApplication,
  userId: string,
): Promise<string> {
  const email = EMAIL_BY_USER_ID[userId];
  if (!email) {
    throw new Error(`No test email for ${userId}`);
  }
  const res = await request(app.getHttpServer())
    .post('/api/auth/password')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const cookie of cookies) {
    const match = /^access_token=([^;]+)/.exec(cookie);
    if (match) return decodeURIComponent(match[1]);
  }
  throw new Error('Password login did not set access_token');
}
