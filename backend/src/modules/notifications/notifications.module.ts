import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UsersModule } from '../users/users.module';
import { TeamMembershipsModule } from '../team-memberships/team-memberships.module';

@Module({
  imports: [UsersModule, TeamMembershipsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}