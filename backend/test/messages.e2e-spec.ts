import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { LLM_CLIENT } from '../src/modules/intake-ai/intake-ai.types';
import { createTestDatabase, resetFixtures } from './test-database';

describe('Messages and attachments (e2e)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let managerToken: string;
  let adminToken: string;
  let requestId: string;

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
        subject: 'Need a screenshot',
        description: 'Thread test',
      })
      .expect(201);
    requestId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets the requester send a text message', async () => {
    const res = await request(app.getHttpServer())
      .post(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('body', 'Here is more context')
      .expect(201);
    expect(res.body.body).toBe('Here is more context');
    expect(res.body.attachments).toEqual([]);
  });

  it('lets any owning-team member send a file-only message', async () => {
    const res = await request(app.getHttpServer())
      .post(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${managerToken}`)
      .attach('files', Buffer.from('hello'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    expect(res.body.body).toBe('');
    expect(res.body.attachments[0].fileName).toBe('note.txt');
  });

  it('drops a file-only message when its last attachment is deleted', async () => {
    const created = await request(app.getHttpServer())
      .post(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('files', Buffer.from('only-file'), {
        filename: 'solo.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const messageId = created.body.id as string;
    const attachmentId = created.body.attachments[0].id as string;

    await request(app.getHttpServer())
      .delete(`/requests/${requestId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(list.body.some((item: { id: string }) => item.id === messageId)).toBe(
      false,
    );
  });

  it('rejects an admin who is not the requester or on the team', async () => {
    await request(app.getHttpServer())
      .post(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('body', 'Admin should not post')
      .expect(403);
  });

  it('rejects an empty post', async () => {
    await request(app.getHttpServer())
      .post(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('body', '   ')
      .expect(400);
  });

  it('rejects a bad attachment without saving an empty message', async () => {
    await request(app.getHttpServer())
      .post(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('body', 'should not be saved')
      .attach('files', Buffer.from('MZ'), {
        filename: 'bad.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);

    const list = await request(app.getHttpServer())
      .get(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(list.body.some((item: { body: string }) => item.body === 'should not be saved')).toBe(
      false,
    );
  });

  it('blocks messages after the request is cancelled', async () => {
    await request(app.getHttpServer())
      .patch(`/requests/${requestId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/requests/${requestId}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('body', 'too late')
      .expect(400);
  });
});
