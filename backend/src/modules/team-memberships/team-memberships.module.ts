import { Module } from '@nestjs/common';
import { TeamMembershipsController } from './team-memberships.controller';
import { TeamMembershipsService } from './team-memberships.service';
import { TeamMembershipsRepository } from './team-memberships.repository';
import { UsersModule } from '../users/users.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [UsersModule, TeamsModule],
  controllers: [TeamMembershipsController],
  providers: [TeamMembershipsService, TeamMembershipsRepository],
  exports: [TeamMembershipsService],
})
export class TeamMembershipsModule {}
