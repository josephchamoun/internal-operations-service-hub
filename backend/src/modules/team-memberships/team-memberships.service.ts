import { Injectable } from '@nestjs/common';
import { TeamMembershipsRepository } from './team-memberships.repository';
import { TeamMembershipEntity } from './entities/team-membership.entity';
import { UsersService } from '../users/users.service';
import { TeamsService } from '../teams/teams.service';

@Injectable()
export class TeamMembershipsService {
  constructor(
    private readonly repo: TeamMembershipsRepository,
    private readonly usersService: UsersService,
    private readonly teamsService: TeamsService,
  ) {}

  findAll(): Promise<TeamMembershipEntity[]> {
    return this.repo.findAll();
  }

  async findByUserId(userId: string): Promise<TeamMembershipEntity[]> {
    await this.usersService.findOne(userId);
    return this.repo.findByUserId(userId);
  }

  async findByTeamId(teamId: string): Promise<TeamMembershipEntity[]> {
    await this.teamsService.findOne(teamId);
    return this.repo.findByTeamId(teamId);
  }
}
