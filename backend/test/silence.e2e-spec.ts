import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { LLM_CLIENT } from '../src/modules/intake-ai/intake-ai.types';
import { createTestDatabase, resetFixtures, useTestDatabaseUrl } from './test-database';

describe('Silence and escalation (e2e)', () => {
  let app: INestApplication;
  let notifyTeamExcept: jest.Mock;
  let employeeToken: string;
  let managerToken: string;
  let adminToken: string;
  let requestId: string;

  beforeAll(async () => {
    useTestDatabaseUrl();
    process.env.ESCALATION_CHECK_INTERVAL_MS = '0';
    const testPrisma = createTestDatabase();
    await resetFixtures(testPrisma);
    await testPrisma.user.create({
      data: {
        userId: 'it-agent-2',
        name: 'Second IT',
        email: 'second-it@test.local',
        role: 'team_member',
        createdAt: new Date(),
      },
    });
    await testPrisma.teamMembership.create({
      data: { userId: 'it-agent-2', teamId: 'IT', createdAt: new Date() },
    });
    await testPrisma.$disconnect();

    notifyTeamExcept = jest.fn().mockResolvedValue({ recipients: 1, sent: 1 });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NotificationsService)
      .useValue({
        notifyTeam: jest.fn(),
        notifyUser: jest.fn(),
        notifyTeamExcept,
      })
      .overrideProvider(LLM_CLIENT)
      .useValue({ complete: async () => '{}' })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/dev-login')
        .send({ userId: 'admin-1' })
    ).body.accessToken;

    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        categoryId: 'laptop-issue',
        subject: 'Waiting on parts',
        description: 'Do not rush this',
      })
      .expect(201);
    requestId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets an owning-team member silence and un-silence themselves', async () => {
    await request(app.getHttpServer())
      .get(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200)
      .expect({ silenced: false });

    await request(app.getHttpServer())
      .put(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200)
      .expect({ silenced: true });

    await request(app.getHttpServer())
      .get(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200)
      .expect({ silenced: true });

    await request(app.getHttpServer())
      .delete(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200)
      .expect({ silenced: false });
  });

  it('rejects silence from the requester and from an admin who is not on the team', async () => {
    await request(app.getHttpServer())
      .put(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .put(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('skips silenced members when a reminder fires', async () => {
    await request(app.getHttpServer())
      .put(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    notifyTeamExcept.mockClear();
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/escalations/run')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ now: future })
      .expect(201);

    expect(res.body.reminded).toContain(requestId);
    expect(notifyTeamExcept).toHaveBeenCalledWith(
      'IT',
      ['dev-manager'],
      expect.any(String),
      expect.any(String),
    );
  });

  it('does not remind again before the window elapses', async () => {
    notifyTeamExcept.mockClear();
    const res = await request(app.getHttpServer())
      .post('/escalations/run')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ now: new Date().toISOString() })
      .expect(201);
    expect(res.body.reminded).not.toContain(requestId);
    expect(notifyTeamExcept).not.toHaveBeenCalled();
  });

  it('clears that member silence when they claim the request', async () => {
    await request(app.getHttpServer())
      .put(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/requests/${requestId}/claim`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/requests/${requestId}/silence`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200)
      .expect({ silenced: false });
  });
});
