import { Controller, Get, Param, ForbiddenException, UseGuards } from '@nestjs/common';
import { TeamMembershipsService } from './team-memberships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('team-memberships')
export class TeamMembershipsController {
  constructor(private readonly teamMembershipsService: TeamMembershipsService) {}

  @Get()
  findAll(@CurrentUser() actor: HubJwtPayload) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view all team memberships');
    }
    return this.teamMembershipsService.findAll();
  }

  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string, @CurrentUser() actor: HubJwtPayload) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view another user\'s team memberships');
    }
    return this.teamMembershipsService.findByUserId(userId);
  }

  @Get('team/:teamId')
  findByTeamId(@Param('teamId') teamId: string, @CurrentUser() actor: HubJwtPayload) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view a team\'s membership list');
    }
    return this.teamMembershipsService.findByTeamId(teamId);
  }
}