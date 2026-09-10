import { Controller, Get, Param } from '@nestjs/common';
import { TeamMembershipsService } from './team-memberships.service';

@Controller('team-memberships')
export class TeamMembershipsController {
  constructor(private readonly teamMembershipsService: TeamMembershipsService) {}

  // GET /team-memberships
  @Get()
  findAll() {
    return this.teamMembershipsService.findAll();
  }

  // GET /team-memberships/user/:userId
  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.teamMembershipsService.findByUserId(userId);
  }

  // GET /team-memberships/team/:teamId
  @Get('team/:teamId')
  findByTeamId(@Param('teamId') teamId: string) {
    return this.teamMembershipsService.findByTeamId(teamId);
  }
}
