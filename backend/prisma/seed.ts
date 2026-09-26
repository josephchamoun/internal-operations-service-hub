import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const ADMIN_ID = 'admin-1';
const ADMIN_EMAIL = 'admin-1@chamounjoseph2022outlook.onmicrosoft.com';
const ADMIN_PASSWORD = 'OpsHub2026';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ userId: ADMIN_ID }, { email: ADMIN_EMAIL }] },
  });
  if (existing) {
    console.log('Admin already exists. Skipping seed.');
    return;
  }

  await prisma.user.create({
    data: {
      userId: ADMIN_ID,
      idpSubjectId: null,
      name: 'Jordan Admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      passwordHash: hashSync(ADMIN_PASSWORD, 10),
      createdAt: new Date(),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
