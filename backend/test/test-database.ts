import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const TEST_DB_PATH = 'file:./prisma/test.db';

/**
 * Returns a PrismaClient pointed at a dedicated, disposable test database
 * (prisma/test.db) — never the real development database (prisma/dev.db).
 * Applies the current schema to it via `prisma db push` before returning.
 */
export function createTestDatabase(): PrismaClient {
  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_DB_PATH },
    stdio: 'ignore',
  });

  return new PrismaClient({
    datasources: { db: { url: TEST_DB_PATH } },
  });
}

/**
 * Wipes the test database and re-inserts a small, known baseline of
 * reference data. Call this before every test so each one starts from an
 * identical, predictable state regardless of what earlier tests did.
 */
export async function resetFixtures(prisma: PrismaClient): Promise<void> {
  // Delete in FK-safe order: children before parents.
  await prisma.accessLog.deleteMany();
  await prisma.silence.deleteMany();
  await prisma.requestEvent.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.request.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.category.deleteMany();
  await prisma.priority.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  const now = new Date();

  await prisma.team.createMany({
    data: [
      { id: 'IT', name: 'IT', createdAt: now },
      { id: 'HR', name: 'HR', createdAt: now },
    ],
  });

  await prisma.category.createMany({
    data: [
      { categoryId: 'laptop-issue', name: 'Laptop Issue', defaultTeamId: 'IT', createdAt: now },
      { categoryId: 'other', name: 'Other', defaultTeamId: null, createdAt: now },
    ],
  });

  await prisma.priority.createMany({
    data: [
      { priorityId: 'Normal', name: 'Normal', escalationWindowMinutes: 1440 },
    ],
  });

  await prisma.user.createMany({
    data: [
      { userId: 'u1', idpSubjectId: null, name: 'Test Employee', email: 'test-employee@test.local', role: 'employee', createdAt: now },
      { userId: 'dev-manager', idpSubjectId: null, name: 'Test Manager', email: 'test-manager@test.local', role: 'team_member', createdAt: now },
      { userId: 'dev-employee', idpSubjectId: null, name: 'Test Dev Employee', email: 'test-dev-employee@test.local', role: 'employee', createdAt: now },
      { userId: 'admin-1', idpSubjectId: null, name: 'Test Admin', email: 'test-admin@test.local', role: 'admin', createdAt: now },
    ],
  });

  await prisma.teamMembership.create({
    data: { userId: 'dev-manager', teamId: 'IT', createdAt: now },
  });
}