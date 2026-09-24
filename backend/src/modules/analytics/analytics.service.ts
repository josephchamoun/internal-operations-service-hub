import { Injectable } from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HubJwtPayload } from '../auth/auth.service';

const STATUS_ORDER: { id: RequestStatus; label: string }[] = [
  { id: RequestStatus.New, label: 'New' },
  { id: RequestStatus.InProgress, label: 'In Progress' },
  { id: RequestStatus.Resolved, label: 'Resolved' },
  { id: RequestStatus.Cancelled, label: 'Cancelled' },
];

const OPEN_STATUSES = new Set<RequestStatus>([
  RequestStatus.New,
  RequestStatus.InProgress,
]);

const factSelect = {
  status: true,
  priorityId: true,
  categoryId: true,
  owningTeamId: true,
  claimedBy: true,
  createdAt: true,
} satisfies Prisma.RequestSelect;

type Fact = Prisma.RequestGetPayload<{ select: typeof factSelect }>;

export type AnalyticsBucket = { id: string; label: string; count: number };

export type AnalyticsSlice = {
  total: number;
  open: number;
  resolved: number;
  cancelled: number;
  unclaimed: number;
  claimedByMe: number;
  urgentOpen: number;
  byStatus: AnalyticsBucket[];
  byPriority: AnalyticsBucket[];
  byCategory: AnalyticsBucket[];
  byTeam: AnalyticsBucket[];
  byMonth: AnalyticsBucket[];
};

export type AnalyticsReport = {
  submitted: AnalyticsSlice;
  queue: AnalyticsSlice | null;
};

type Labels = {
  priority: Map<string, string>;
  category: Map<string, string>;
  team: Map<string, string>;
  urgentIds: Set<string>;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(actor: HubJwtPayload): Promise<AnalyticsReport> {
    const [priorities, categories, teams] = await Promise.all([
      this.prisma.priority.findMany(),
      this.prisma.category.findMany(),
      this.prisma.team.findMany(),
    ]);
    const labels: Labels = {
      priority: new Map(priorities.map((row) => [row.priorityId, row.name])),
      category: new Map(categories.map((row) => [row.categoryId, row.name])),
      team: new Map(teams.map((row) => [row.id, row.name])),
      urgentIds: new Set(
        priorities
          .filter(
            (row) =>
              row.priorityId.toLowerCase() === 'urgent' ||
              row.name.toLowerCase() === 'urgent',
          )
          .map((row) => row.priorityId),
      ),
    };

    const submittedRows = await this.prisma.request.findMany({
      where: { requesterId: actor.userId },
      select: factSelect,
    });

    const canSeeQueue = actor.role === 'admin' || actor.teamIds.length > 0;
    if (!canSeeQueue) {
      return { submitted: summarize(submittedRows, actor.userId, labels), queue: null };
    }

    const where: Prisma.RequestWhereInput =
      actor.role === 'admin' ? {} : { owningTeamId: { in: actor.teamIds } };
    const queueRows = await this.prisma.request.findMany({ where, select: factSelect });

    return {
      submitted: summarize(submittedRows, actor.userId, labels),
      queue: summarize(queueRows, actor.userId, labels),
    };
  }
}

function summarize(rows: Fact[], actorId: string, labels: Labels): AnalyticsSlice {
  const statusCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const teamCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  let open = 0;
  let resolved = 0;
  let cancelled = 0;
  let unclaimed = 0;
  let claimedByMe = 0;
  let urgentOpen = 0;

  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    priorityCounts.set(row.priorityId, (priorityCounts.get(row.priorityId) ?? 0) + 1);
    categoryCounts.set(row.categoryId, (categoryCounts.get(row.categoryId) ?? 0) + 1);
    teamCounts.set(row.owningTeamId, (teamCounts.get(row.owningTeamId) ?? 0) + 1);
    const key = monthKey(row.createdAt);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);

    const isOpen = OPEN_STATUSES.has(row.status);
    if (isOpen) {
      open += 1;
      if (labels.urgentIds.has(row.priorityId)) urgentOpen += 1;
      if (!row.claimedBy) unclaimed += 1;
      if (row.claimedBy === actorId) claimedByMe += 1;
    }
    if (row.status === RequestStatus.Resolved) resolved += 1;
    if (row.status === RequestStatus.Cancelled) cancelled += 1;
  }

  const byPriority = [...labels.priority.entries()].map(([id, label]) => ({
    id,
    label,
    count: priorityCounts.get(id) ?? 0,
  }));
  for (const [id, count] of priorityCounts) {
    if (!labels.priority.has(id)) byPriority.push({ id, label: id, count });
  }
  byPriority.sort(
    (a, b) =>
      priorityRank(a.label) - priorityRank(b.label) ||
      b.count - a.count ||
      a.label.localeCompare(b.label),
  );

  const byCategory = [...categoryCounts.entries()]
    .map(([id, count]) => ({ id, label: labels.category.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const byTeam = [...teamCounts.entries()]
    .map(([id, count]) => ({ id, label: labels.team.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const months = lastSixMonths();

  return {
    total: rows.length,
    open,
    resolved,
    cancelled,
    unclaimed,
    claimedByMe,
    urgentOpen,
    byStatus: STATUS_ORDER.map((status) => ({
      id: status.id,
      label: status.label,
      count: statusCounts.get(status.id) ?? 0,
    })),
    byPriority,
    byCategory,
    byTeam,
    byMonth: months.map((month) => ({
      id: month.id,
      label: month.label,
      count: monthCounts.get(month.id) ?? 0,
    })),
  };
}

function priorityRank(label: string): number {
  const key = label.toLowerCase();
  if (key === 'urgent') return 0;
  if (key === 'normal') return 1;
  if (key === 'low') return 2;
  return 3;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastSixMonths(now = new Date()): { id: string; label: string }[] {
  const months: { id: string; label: string }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push({
      id: monthKey(date),
      label: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    });
  }
  return months;
}
