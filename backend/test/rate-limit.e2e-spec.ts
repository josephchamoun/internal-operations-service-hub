import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { LLM_CLIENT } from '../src/modules/intake-ai/intake-ai.types';
import { createTestDatabase, resetFixtures } from './test-database';

describe('Write rate limits (e2e)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let managerToken: string;
  let threadId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'file:./prisma/test.db';
    const testPrisma = createTestDatabase();
    await resetFixtures(testPrisma);
    await testPrisma.$disconnect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NotificationsService)
      .useValue({
        notifyTeam: jest.fn(),
        notifyUser: jest.fn(),
        notifyTeamExcept: jest.fn(),
      })
      .overrideProvider(LLM_CLIENT)
      .useValue({ complete: async () => '{}' })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    employeeToken = (
      await request(app.getHttpServer())
        .post('/auth/dev-login')
        .send({ userId: 'dev-employee' })
    ).body.accessToken;
    managerToken = (
      await request(app.getHttpServer())
        .post('/auth/dev-login')
        .send({ userId: 'dev-manager' })
    ).body.accessToken;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  function createRequest(token: string, subject: string) {
    return request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: 'laptop-issue',
        subject,
        description: 'Rate limit check',
      });
  }

  it('allows five request creates per person per minute and refuses the sixth', async () => {
    for (let i = 1; i <= 5; i++) {
      const created = await createRequest(employeeToken, `Burst ${i}`).expect(201);
      if (i === 1) threadId = created.body.id as string;
    }
    const blocked = await createRequest(employeeToken, 'Burst 6').expect(429);
    expect(blocked.body.message).toBe(
      'Too many in a short time. Wait a minute and try again.',
    );

    await createRequest(managerToken, 'Other person').expect(201);
  });

  it('allows five messages per person per minute and refuses the sixth', async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app.getHttpServer())
        .post(`/requests/${threadId}/messages`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .field('body', `note ${i}`)
        .expect(201);
    }

    const blocked = await request(app.getHttpServer())
      .post(`/requests/${threadId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('body', 'note 6')
      .expect(429);
    expect(blocked.body.message).toBe(
      'Too many in a short time. Wait a minute and try again.',
    );

    await request(app.getHttpServer())
      .post(`/requests/${threadId}/messages`)
      .set('Authorization', `Bearer ${managerToken}`)
      .field('body', 'team reply')
      .expect(201);
  });
});
