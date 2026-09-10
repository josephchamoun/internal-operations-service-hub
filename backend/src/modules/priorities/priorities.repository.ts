import { Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PriorityEntity } from './entities/priority.entity';

@Injectable()
export class PrioritiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PriorityEntity[]> {
    const rows = await this.prisma.priority.findMany();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<PriorityEntity | undefined> {
    const row = await this.prisma.priority.findUnique({ where: { priorityId: id } });
    return row ? toEntity(row) : undefined;
  }
}

function toEntity(row: Priority): PriorityEntity {
  return {
    id: row.priorityId,
    name: row.name,
    escalationWindowMinutes: row.escalationWindowMinutes,
  };
}
