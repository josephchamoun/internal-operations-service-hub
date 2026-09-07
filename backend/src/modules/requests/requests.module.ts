import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RequestsRepository } from './requests.repository';
import { PrioritiesModule } from '../priorities/priorities.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { RequestEventsModule } from '../request-events/request-events.module';
import { AccessLogsModule } from '../access-logs/access-logs.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    PrioritiesModule,
    CategoriesModule,
    UsersModule,
    TeamsModule,
    RequestEventsModule,
    AccessLogsModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService, RequestsRepository],
})
export class RequestsModule {}
