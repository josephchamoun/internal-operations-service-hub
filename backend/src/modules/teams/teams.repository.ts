import { Injectable } from '@nestjs/common';
import { Team } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamEntity } from './entities/team.entity';

@Injectable()
export class TeamsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TeamEntity[]> {
    const rows = await this.prisma.team.findMany();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<TeamEntity | undefined> {
    const row = await this.prisma.team.findUnique({ where: { id } });
    return row ? toEntity(row) : undefined;
  }

  async countUsage(id: string): Promise<number> {
    const [requests, memberships, categories] = await Promise.all([
      this.prisma.request.count({ where: { owningTeamId: id } }),
      this.prisma.teamMembership.count({ where: { teamId: id } }),
      this.prisma.category.count({ where: { defaultTeamId: id } }),
    ]);
    return requests + memberships + categories;
  }

  async create(id: string, name: string): Promise<TeamEntity> {
    const row = await this.prisma.team.create({
      data: { id, name, createdAt: new Date() },
    });
    return toEntity(row);
  }

  async update(id: string, name: string): Promise<TeamEntity> {
    const row = await this.prisma.team.update({
      where: { id },
      data: { name },
    });
    return toEntity(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.team.delete({ where: { id } });
  }
}

function toEntity(row: Team): TeamEntity {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}
