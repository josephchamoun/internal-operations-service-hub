import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { RequestsModule } from './modules/requests/requests.module';
import { TeamsModule } from './modules/teams/teams.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { PrioritiesModule } from './modules/priorities/priorities.module';
import { UsersModule } from './modules/users/users.module';
import { TeamMembershipsModule } from './modules/team-memberships/team-memberships.module';
import { RequestEventsModule } from './modules/request-events/request-events.module';
import { AccessLogsModule } from './modules/access-logs/access-logs.module';

@Module({
  imports: [
    PrismaModule,
    RequestsModule,
    TeamsModule,
    CategoriesModule,
    PrioritiesModule,
    UsersModule,
    TeamMembershipsModule,
    RequestEventsModule,
    AccessLogsModule,
  ],
})
export class AppModule {}
