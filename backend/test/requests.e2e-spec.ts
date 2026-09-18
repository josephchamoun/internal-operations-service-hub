import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { LLM_CLIENT } from '../src/modules/intake-ai/intake-ai.types';
import { createTestDatabase, resetFixtures } from './test-database';

describe('Requests lifecycle (e2e)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let managerToken: string;
  let createdRequestId: string;

  beforeAll(async () => {
    // Point Prisma at the isolated test database, not dev.db. Must happen
    // before AppModule (and PrismaService within it) is compiled.
    process.env.DATABASE_URL = 'file:./prisma/test.db';

    const testPrisma = createTestDatabase();
    await resetFixtures(testPrisma);
    await testPrisma.$disconnect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NotificationsService)
      .useValue({ notifyTeam: jest.fn(), notifyUser: jest.fn() })
      .overrideProvider(LLM_CLIENT)
      .useValue({
        complete: async () =>
          JSON.stringify({
            summary: 'Laptop will not power on',
            categoryId: 'laptop-issue',
            priorityId: 'Urgent',
            suggestedOwningTeamId: 'IT',
            suggestedNextStep:
              'Submit this as a Laptop Issue. It will land unclaimed in IT’s queue.',
            selfServeHint: 'Check the charger first.',
            needsClarification: false,
            clarificationQuestion: null,
            confidence: 'high',
          }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    const employeeRes = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ userId: 'dev-employee' });
    employeeToken = employeeRes.body.accessToken;

    const managerRes = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ userId: 'dev-manager' });
    managerToken = managerRes.body.accessToken;
  },  30000);

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

  it('allows the requester to edit a New unclaimed request', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/requests/${createdRequestId}/details`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        subject: 'E2E test request (edited)',
        description: 'Updated by an automated e2e test.',
      })
      .expect(200);

    expect(res.body.subject).toBe('E2E test request (edited)');
    expect(res.body.description).toBe('Updated by an automated e2e test.');
  });

  it('denies an edit from an actor who is not the requester', async () => {
    await request(app.getHttpServer())
      .patch(`/requests/${createdRequestId}/details`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        subject: 'Should not apply',
        description: 'Should not apply',
      })
      .expect(403);
  });

  it('denies claim from an actor not on the owning team', async () => {
    await request(app.getHttpServer())
      .patch(`/requests/${createdRequestId}/claim`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('allows claim from an actor on the owning team', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/requests/${createdRequestId}/claim`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body.claimedBy).toBe('dev-manager');
  });

  it('rejects an edit after the request has been claimed', async () => {
    await request(app.getHttpServer())
      .patch(`/requests/${createdRequestId}/details`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        subject: 'Too late',
        description: 'Too late',
      })
      .expect(400);
  });

  it('rejects requests with no auth token at all', async () => {
    await request(app.getHttpServer()).get('/requests').expect(401);
  });

  it('returns a structured intake suggestion without creating a request', async () => {
    const res = await request(app.getHttpServer())
      .post('/requests/interpret')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ draft: 'my laptop is shut down and wont open' })
      .expect(200);

    expect(res.body.categoryId).toBe('laptop-issue');
    expect(res.body.requestType).toBe('IT');
    expect(res.body.suggestedOwningTeamId).toBe('IT');
    expect(res.body.summary).toBeDefined();
    expect(res.body.suggestedNextStep).toBeDefined();
  });

  it('rejects interpret without auth', async () => {
    await request(app.getHttpServer())
      .post('/requests/interpret')
      .send({ draft: 'my laptop is shut down and wont open' })
      .expect(401);
  });
});