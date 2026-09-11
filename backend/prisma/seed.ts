import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

type TeamRow = { id: string; name: string };
type CategoryRow = { id: string; name: string; defaultTeamId: string | null };
type PriorityRow = { id: string; name: string; escalationWindowMinutes: number };
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamIds: string[];
};

const teams: TeamRow[] = [
  { id: 'IT', name: 'IT' },
  { id: 'HR', name: 'HR' },
];

const categories: CategoryRow[] = [
  { id: 'laptop-issue', name: 'Laptop Issue', defaultTeamId: 'IT' },
  { id: 'software-issue', name: 'Software Issue', defaultTeamId: 'IT' },
  { id: 'account-access', name: 'Account / Access Request', defaultTeamId: 'IT' },
  { id: 'hr-approval', name: 'HR Approval', defaultTeamId: 'HR' },
  { id: 'policy-question', name: 'Policy Question', defaultTeamId: 'HR' },
  { id: 'other', name: 'Other', defaultTeamId: null },
];

const priorities: PriorityRow[] = [
  { id: 'Low', name: 'Low', escalationWindowMinutes: 2880 },
  { id: 'Normal', name: 'Normal', escalationWindowMinutes: 1440 },
  { id: 'Urgent', name: 'Urgent', escalationWindowMinutes: 120 },
];

const users: UserRow[] = [
  { id: 'u1', name: 'Alice Employee', email: 'alice@company.com', role: 'employee', teamIds: [] },
  { id: 'u2', name: 'Ben Employee', email: 'ben@company.com', role: 'employee', teamIds: [] },
  { id: 'it-agent-1', name: 'Sam IT', email: 'sam@company.com', role: 'team_member', teamIds: ['IT'] },
  { id: 'it-agent-2', name: 'Riley IT', email: 'riley@company.com', role: 'team_member', teamIds: ['IT'] },
  { id: 'hr-agent-1', name: 'Maya HR', email: 'maya@company.com', role: 'team_member', teamIds: ['HR'] },
  { id: 'admin-1', name: 'Jordan Admin', email: 'jordan@company.com', role: 'admin', teamIds: [] },
  { id: 'main-agent-1', name: 'HR/IT agent', email: 'main@company.com', role: 'team_member', teamIds: ['IT', 'HR'] },
];

async function main() {
  const createdAt = new Date();

  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name },
      create: { id: team.id, name: team.name, createdAt },
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { categoryId: category.id },
      update: { name: category.name, defaultTeamId: category.defaultTeamId },
      create: {
        categoryId: category.id,
        name: category.name,
        defaultTeamId: category.defaultTeamId,
        createdAt,
      },
    });
  }

  for (const priority of priorities) {
    await prisma.priority.upsert({
      where: { priorityId: priority.id },
      update: {
        name: priority.name,
        escalationWindowMinutes: priority.escalationWindowMinutes,
      },
      create: {
        priorityId: priority.id,
        name: priority.name,
        escalationWindowMinutes: priority.escalationWindowMinutes,
      },
    });
  }

  for (const user of users) {
    await prisma.user.upsert({
      where: { userId: user.id },
      update: {
        idpSubjectId: null,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      create: {
        userId: user.id,
        idpSubjectId: null,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt,
      },
    });

    for (const teamId of user.teamIds) {
      await prisma.teamMembership.upsert({
        where: { userId_teamId: { userId: user.id, teamId } },
        update: {},
        create: { userId: user.id, teamId, createdAt },
      });
    }
  }
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