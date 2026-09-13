import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Requests lifecycle (e2e)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let managerToken: string;
  let createdRequestId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Log in as both test identities via dev-login (same JWT-issuing path
    // as a real Entra ID login — see auth.service.ts).
    const employeeRes = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ userId: 'dev-employee' });
    employeeToken = employeeRes.body.accessToken;

    const managerRes = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ userId: 'dev-manager' });
    managerToken = managerRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a request as the employee', async () => {
    const res = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        categoryId: 'laptop-issue',
        subject: 'E2E test request',
        description: 'Created by an automated e2e test.',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('New');
    createdRequestId = res.body.id;
  });

  it('denies claim from an actor not on the owning team', async () => {
    await request(app.getHttpServer())
      .patch(`/requests/${createdRequestId}/claim`)
      .set('Authorization', `Bearer ${employeeToken}`) // dev-employee has no team
      .expect(403);
  });

  it('allows claim from an actor on the owning team', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/requests/${createdRequestId}/claim`)
      .set('Authorization', `Bearer ${managerToken}`) // dev-manager is on IT
      .expect(200);

    expect(res.body.claimedBy).toBe('dev-manager');
  });

  it('rejects requests with no auth token at all', async () => {
    await request(app.getHttpServer()).get('/requests').expect(401);
  });
});