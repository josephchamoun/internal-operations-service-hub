import { v4 as uuid } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { RequestsRepository } from './requests.repository';
import { RequestEntity } from './entities/request.entity';
import { RequestStatus } from './enums/request-status.enum';
import { createTestDatabase, resetFixtures } from '../../../test/test-database';

describe('RequestsRepository — integration with real database', () => {
  let prisma: PrismaClient;
  let repo: RequestsRepository;

  beforeAll(() => {
    prisma = createTestDatabase();
    repo = new RequestsRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists a request and reads back exactly what was written', async () => {
    const now = new Date().toISOString();
    const entity: RequestEntity = {
      id: uuid(),
      requesterId: 'u1',
      categoryId: 'laptop-issue',
      owningTeamId: 'IT',
      priorityId: 'Normal',
      status: RequestStatus.NEW,
      claimedBy: null,
      subject: 'Integration test request',
      description: 'Created by an automated test against the isolated test database.',
      createdAt: now,
      updatedAt: now,
    };

    await repo.create(entity);
    const found = await repo.findById(entity.id);

    expect(found).toBeDefined();
    expect(found?.subject).toBe('Integration test request');
    expect(found?.requesterId).toBe('u1');
    expect(found?.owningTeamId).toBe('IT');
    expect(found?.status).toBe(RequestStatus.NEW);
  });
});