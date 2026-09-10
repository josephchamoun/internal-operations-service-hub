import { Injectable } from '@nestjs/common';
import { AccessLog } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccessLogEntity } from './entities/access-log.entity';

@Injectable()
export class AccessLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AccessLogEntity[]> {
    const rows = await this.prisma.accessLog.findMany({
      orderBy: { accessedAt: 'asc' },
    });
    return rows.map(toEntity);
  }

  async create(entity: AccessLogEntity): Promise<AccessLogEntity> {
    const row = await this.prisma.accessLog.create({
      data: {
        accessId: entity.id,
        userId: entity.userId,
        requestId: entity.requestId,
        accessedAt: new Date(entity.accessedAt),
      },
    });
    return toEntity(row);
  }

  async findByRequestId(requestId: string): Promise<AccessLogEntity[]> {
    const rows = await this.prisma.accessLog.findMany({
      where: { requestId },
      orderBy: { accessedAt: 'asc' },
    });
    return rows.map(toEntity);
  }
}

function toEntity(row: AccessLog): AccessLogEntity {
  return {
    id: row.accessId,
    userId: row.userId,
    requestId: row.requestId,
    accessedAt: row.accessedAt.toISOString(),
  };
}
