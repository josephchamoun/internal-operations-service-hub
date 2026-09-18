import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RequestsRepository } from './requests.repository';
import { LiveUpdatesController } from '../live-updates/live-updates.controller';
import { PrioritiesModule } from '../priorities/priorities.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { RequestEventsModule } from '../request-events/request-events.module';
import { AccessLogsModule } from '../access-logs/access-logs.module';
import { TeamsModule } from '../teams/teams.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LiveUpdatesModule } from '../live-updates/live-updates.module';
import { IntakeAiModule } from '../intake-ai/intake-ai.module';

@Module({
  imports: [
    PrioritiesModule,
    CategoriesModule,
    UsersModule,
    TeamsModule,
    RequestEventsModule,
    AccessLogsModule,
    NotificationsModule,
    LiveUpdatesModule,
    IntakeAiModule,
  ],
  controllers: [RequestsController, LiveUpdatesController],
  providers: [RequestsService, RequestsRepository],
})
export class RequestsModule {}