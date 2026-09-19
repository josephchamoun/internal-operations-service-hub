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

  async countRequests(id: string): Promise<number> {
    return this.prisma.request.count({ where: { priorityId: id } });
  }

  async create(input: {
    id: string;
    name: string;
    escalationWindowMinutes: number;
  }): Promise<PriorityEntity> {
    const row = await this.prisma.priority.create({
      data: {
        priorityId: input.id,
        name: input.name,
        escalationWindowMinutes: input.escalationWindowMinutes,
      },
    });
    return toEntity(row);
  }

  async update(input: {
    id: string;
    name: string;
    escalationWindowMinutes: number;
  }): Promise<PriorityEntity> {
    const row = await this.prisma.priority.update({
      where: { priorityId: input.id },
      data: {
        name: input.name,
        escalationWindowMinutes: input.escalationWindowMinutes,
      },
    });
    return toEntity(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.priority.delete({ where: { priorityId: id } });
  }
}

function toEntity(row: Priority): PriorityEntity {
  return {
    id: row.priorityId,
    name: row.name,
    escalationWindowMinutes: row.escalationWindowMinutes,
  };
}
