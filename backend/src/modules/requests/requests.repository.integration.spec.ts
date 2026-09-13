import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestsRepository } from './requests.repository';
import { RequestEntity } from './entities/request.entity';
import { RequestStatus } from './enums/request-status.enum';

describe('RequestsRepository — integration with real database', () => {
  let prisma: PrismaService;
  let repo: RequestsRepository;
  const testRequestId = uuid();

  beforeAll(() => {
    prisma = new PrismaService();
    repo = new RequestsRepository(prisma);
  });

  afterAll(async () => {
    // Clean up the row this test created, so re-running tests (or demoing
    // the app afterward) doesn't leave fake data behind.
    await prisma.request.deleteMany({ where: { requestId: testRequestId } });
    await prisma.$disconnect();
  });

  it('persists a request and reads back exactly what was written', async () => {
    const now = new Date().toISOString();
    const entity: RequestEntity = {
      id: testRequestId,
      requesterId: 'u1', // seeded in seed.ts
      categoryId: 'laptop-issue', // seeded in seed.ts
      owningTeamId: 'IT', // seeded in seed.ts
      priorityId: 'Normal', // seeded in seed.ts
      status: RequestStatus.NEW,
      claimedBy: null,
      subject: 'Integration test request',
      description: 'Created by an automated test, should be deleted after.',
      createdAt: now,
      updatedAt: now,
    };

    await repo.create(entity);

    const found = await repo.findById(testRequestId);

    expect(found).toBeDefined();
    expect(found?.subject).toBe('Integration test request');
    expect(found?.requesterId).toBe('u1');
    expect(found?.owningTeamId).toBe('IT');
    expect(found?.status).toBe(RequestStatus.NEW);
  });
});