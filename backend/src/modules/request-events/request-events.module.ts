import { Module } from '@nestjs/common';
import { RequestEventsController } from './request-events.controller';
import { RequestEventsService } from './request-events.service';
import { RequestEventsRepository } from './request-events.repository';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [RequestEventsController],
  providers: [RequestEventsService, RequestEventsRepository],
  exports: [RequestEventsService],
})
export class RequestEventsModule {}