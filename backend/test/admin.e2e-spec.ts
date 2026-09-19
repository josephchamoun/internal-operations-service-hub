import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { LLM_CLIENT } from '../src/modules/intake-ai/intake-ai.types';
import { createTestDatabase, resetFixtures } from './test-database';

describe('Admin reference-data CRUD (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;

  beforeAll(async () => {
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
      .useValue({ complete: async () => '{}' })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    const adminRes = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ userId: 'admin-1' });
    adminToken = adminRes.body.accessToken;

    const employeeRes = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ userId: 'dev-employee' });
    employeeToken = employeeRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects non-admin writes', async () => {
    await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: "Legal" })
      .expect(403);
  });

  it("creates and deletes an unused team", async () => {
    const created = await request(app.getHttpServer())
      .post("/teams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Legal" })
      .expect(201);
    expect(created.body.id).toBeDefined();
    expect(created.body.name).toBe("Legal");

    await request(app.getHttpServer())
      .delete(`/teams/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("forbids editing or deleting Other, and deleting Normal", async () => {
    await request(app.getHttpServer())
      .patch("/categories/other")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Something else" })
      .expect(409);
    await request(app.getHttpServer())
      .delete('/categories/other')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete('/priorities/Normal')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('rejects a duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: "Dup",
        email: "TEST-EMPLOYEE@test.local",
      })
      .expect(409);
  });

  it('lets an employee claim after being added to the owning team without logging in again', async () => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        categoryId: 'laptop-issue',
        subject: 'Need IT after membership change',
        description: 'Created to prove live memberships.',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/requests/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch('/users/dev-employee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamIds: ['IT'] })
      .expect(200);
    expect(updated.body.role).toBe('team_member');
    expect(updated.body.teamIds).toEqual(['IT']);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(me.body.role).toBe('team_member');
    expect(me.body.teamIds).toEqual(['IT']);

    const claimed = await request(app.getHttpServer())
      .patch(`/requests/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(claimed.body.claimedBy).toBe('dev-employee');
  });
});
