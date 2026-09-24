import { RequestStatus } from '@prisma/client';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const prisma = {
    priority: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
    team: { findMany: jest.fn() },
    request: { findMany: jest.fn() },
  };
  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.priority.findMany.mockResolvedValue([
      { priorityId: 'Low', name: 'Low' },
      { priorityId: 'Normal', name: 'Normal' },
      { priorityId: 'Urgent', name: 'Urgent' },
    ]);
    prisma.category.findMany.mockResolvedValue([
      { categoryId: 'laptop-issue', name: 'Laptop Issue' },
      { categoryId: 'hr-approval', name: 'HR Approval' },
    ]);
    prisma.team.findMany.mockResolvedValue([
      { id: 'IT', name: 'IT' },
      { id: 'HR', name: 'HR' },
    ]);
    service = new AnalyticsService(prisma as never);
  });

  function row(partial: Partial<{
    status: RequestStatus;
    priorityId: string;
    categoryId: string;
    owningTeamId: string;
    claimedBy: string | null;
    createdAt: Date;
  }> = {}) {
    return {
      status: RequestStatus.New,
      priorityId: 'Normal',
      categoryId: 'laptop-issue',
      owningTeamId: 'IT',
      claimedBy: null,
      createdAt: new Date(),
      ...partial,
    };
  }

  it('counts only what the signed-in user submitted', async () => {
    prisma.request.findMany.mockResolvedValueOnce([
      row(),
      row({
        status: RequestStatus.Resolved,
        priorityId: 'Urgent',
        categoryId: 'hr-approval',
        owningTeamId: 'HR',
      }),
    ]);

    const report = await service.report({ userId: 'u1', role: 'employee', teamIds: [] });

    expect(prisma.request.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterId: 'u1' } }),
    );
    expect(report.queue).toBeNull();
    expect(report.submitted.total).toBe(2);
    expect(report.submitted.open).toBe(1);
    expect(report.submitted.resolved).toBe(1);
    expect(report.submitted.urgentOpen).toBe(0);
    expect(report.submitted.byStatus.find((item) => item.label === 'New')?.count).toBe(1);
    expect(report.submitted.byCategory.find((item) => item.id === 'hr-approval')?.count).toBe(1);
    expect(report.submitted.byPriority).toHaveLength(3);
  });

  it('limits a team queue to that member’s teams and ignores closed unclaimed rows', async () => {
    prisma.request.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      row({
        status: RequestStatus.InProgress,
        priorityId: 'Urgent',
        claimedBy: 'it-agent-1',
      }),
      row({ priorityId: 'Urgent' }),
      row({ status: RequestStatus.Resolved, claimedBy: null }),
    ]);

    const report = await service.report({
      userId: 'it-agent-1',
      role: 'team_member',
      teamIds: ['IT'],
    });

    expect(prisma.request.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { owningTeamId: { in: ['IT'] } } }),
    );
    expect(report.queue?.total).toBe(3);
    expect(report.queue?.unclaimed).toBe(1);
    expect(report.queue?.claimedByMe).toBe(1);
    expect(report.queue?.urgentOpen).toBe(2);
    expect(report.submitted.total).toBe(0);
  });

  it('gives an admin the whole hub as the queue', async () => {
    prisma.request.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row()]);

    const report = await service.report({ userId: 'admin-1', role: 'admin', teamIds: [] });

    expect(prisma.request.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: {} }),
    );
    expect(report.queue?.total).toBe(1);
  });
});
