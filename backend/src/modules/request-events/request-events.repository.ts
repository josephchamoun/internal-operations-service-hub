import { Injectable } from '@nestjs/common';
import { RequestEvent } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestEventEntity } from './entities/request-event.entity';
import { RequestEventType } from './enums/request-event-type.enum';

@Injectable()
export class RequestEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RequestEventEntity[]> {
    const rows = await this.prisma.requestEvent.findMany();
    return rows.map(toEntity);
  }

  async findAllForTeams(teamIds: string[]): Promise<RequestEventEntity[]> {
    const rows = await this.prisma.requestEvent.findMany({
      where: { request: { owningTeamId: { in: teamIds } } },
    });
    return rows.map(toEntity);
  }

  async findByRequestId(requestId: string): Promise<RequestEventEntity[]> {
    const rows = await this.prisma.requestEvent.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toEntity);
  }

  async create(entity: RequestEventEntity): Promise<RequestEventEntity> {
    const row = await this.prisma.requestEvent.create({
      data: {
        eventId: entity.id,
        requestId: entity.requestId,
        eventType: entity.eventType,
        actorId: entity.actorId,
        fromValue: entity.fromValue,
        toValue: entity.toValue,
        createdAt: new Date(entity.createdAt),
      },
    });
    return toEntity(row);
  }
}

function toEntity(row: RequestEvent): RequestEventEntity {
  return {
    id: row.eventId,
    requestId: row.requestId,
    eventType: row.eventType as RequestEventType,
    actorId: row.actorId,
    fromValue: row.fromValue,
    toValue: row.toValue,
    createdAt: row.createdAt.toISOString(),
  };
}