import { Injectable } from '@nestjs/common';
import { TeamMembership } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamMembershipEntity } from './entities/team-membership.entity';

@Injectable()
export class TeamMembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TeamMembershipEntity[]> {
    const rows = await this.prisma.teamMembership.findMany();
    return rows.map(toEntity);
  }

  async findByUserId(userId: string): Promise<TeamMembershipEntity[]> {
    const rows = await this.prisma.teamMembership.findMany({
      where: { userId },
    });
    return rows.map(toEntity);
  }

  async findByTeamId(teamId: string): Promise<TeamMembershipEntity[]> {
    const rows = await this.prisma.teamMembership.findMany({
      where: { teamId },
    });
    return rows.map(toEntity);
  }

  async findById(userId: string, teamId: string): Promise<TeamMembershipEntity | undefined> {
    const row = await this.prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    return row ? toEntity(row) : undefined;
  }
}

function toEntity(row: TeamMembership): TeamMembershipEntity {
  return {
    userId: row.userId,
    teamId: row.teamId,
    createdAt: row.createdAt.toISOString(),
  };
}
