import { Module } from '@nestjs/common';
import { StorageModule } from './common/storage/storage.module';
import { RequestsModule } from './modules/requests/requests.module';
import { TeamsModule } from './modules/teams/teams.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { PrioritiesModule } from './modules/priorities/priorities.module';
import { UsersModule } from './modules/users/users.module';
import { RequestEventsModule } from './modules/request-events/request-events.module';
import { AccessLogsModule } from './modules/access-logs/access-logs.module';

@Module({
  imports: [
    StorageModule,
    RequestsModule,
    TeamsModule,
    CategoriesModule,
    PrioritiesModule,
    UsersModule,
    RequestEventsModule,
    AccessLogsModule,
  ],
})
export class AppModule {}
