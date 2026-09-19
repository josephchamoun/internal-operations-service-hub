import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { RequestsModule } from '../requests/requests.module';
import { LiveUpdatesModule } from '../live-updates/live-updates.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RequestsModule, LiveUpdatesModule, NotificationsModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
