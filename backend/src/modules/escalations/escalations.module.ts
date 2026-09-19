import { Module } from '@nestjs/common';
import { EscalationsService } from './escalations.service';
import { EscalationsController } from './escalations.controller';
import { RequestsModule } from '../requests/requests.module';
import { RequestEventsModule } from '../request-events/request-events.module';
import { PrioritiesModule } from '../priorities/priorities.module';
import { SilencesModule } from '../silences/silences.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    RequestsModule,
    RequestEventsModule,
    PrioritiesModule,
    SilencesModule,
    NotificationsModule,
  ],
  controllers: [EscalationsController],
  providers: [EscalationsService],
})
export class EscalationsModule {}
