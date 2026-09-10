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
}

function toEntity(row: Team): TeamEntity {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}
