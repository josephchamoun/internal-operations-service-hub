import { Injectable } from '@nestjs/common';
import { Prisma, Request as RequestRow, RequestStatus as PrismaRequestStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestEntity } from './entities/request.entity';
import { RequestStatus } from './enums/request-status.enum';

@Injectable()
export class RequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RequestEntity[]> {
    const rows = await this.prisma.request.findMany();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<RequestEntity | undefined> {
    const row = await this.prisma.request.findUnique({ where: { requestId: id } });
    return row ? toEntity(row) : undefined;
  }

  async create(entity: RequestEntity): Promise<RequestEntity> {
    const row = await this.prisma.request.create({
      data: {
        requestId: entity.id,
        requesterId: entity.requesterId,
        categoryId: entity.categoryId,
        owningTeamId: entity.owningTeamId,
        priorityId: entity.priorityId,
        status: toPrismaStatus(entity.status),
        claimedBy: entity.claimedBy,
        subject: entity.subject,
        description: entity.description,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
    });
    return toEntity(row);
  }

  async update(id: string, patch: Partial<RequestEntity>): Promise<RequestEntity | undefined> {
    const existing = await this.prisma.request.findUnique({ where: { requestId: id } });
    if (!existing) return undefined;

    const data: Prisma.RequestUncheckedUpdateInput = {
      updatedAt: new Date(),
    };

    if (patch.requesterId !== undefined) data.requesterId = patch.requesterId;
    if (patch.categoryId !== undefined) data.categoryId = patch.categoryId;
    if (patch.owningTeamId !== undefined) data.owningTeamId = patch.owningTeamId;
    if (patch.priorityId !== undefined) data.priorityId = patch.priorityId;
    if (patch.status !== undefined) data.status = toPrismaStatus(patch.status);
    if (patch.claimedBy !== undefined) data.claimedBy = patch.claimedBy;
    if (patch.subject !== undefined) data.subject = patch.subject;
    if (patch.description !== undefined) data.description = patch.description;

    const row = await this.prisma.request.update({
      where: { requestId: id },
      data,
    });
    return toEntity(row);
  }
}

function toPrismaStatus(status: RequestStatus): PrismaRequestStatus {
  if (status === RequestStatus.IN_PROGRESS) return PrismaRequestStatus.InProgress;
  if (status === RequestStatus.NEW) return PrismaRequestStatus.New;
  if (status === RequestStatus.RESOLVED) return PrismaRequestStatus.Resolved;
  return PrismaRequestStatus.Cancelled;
}

function toEntityStatus(status: PrismaRequestStatus): RequestStatus {
  if (status === PrismaRequestStatus.InProgress) return RequestStatus.IN_PROGRESS;
  if (status === PrismaRequestStatus.New) return RequestStatus.NEW;
  if (status === PrismaRequestStatus.Resolved) return RequestStatus.RESOLVED;
  return RequestStatus.CANCELLED;
}

function toEntity(row: RequestRow): RequestEntity {
  return {
    id: row.requestId,
    requesterId: row.requesterId,
    categoryId: row.categoryId,
    owningTeamId: row.owningTeamId,
    priorityId: row.priorityId,
    status: toEntityStatus(row.status),
    claimedBy: row.claimedBy,
    subject: row.subject,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
