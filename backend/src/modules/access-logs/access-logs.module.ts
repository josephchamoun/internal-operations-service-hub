import { Module } from '@nestjs/common';
import { AccessLogsController } from './access-logs.controller';
import { AccessLogsService } from './access-logs.service';
import { AccessLogsRepository } from './access-logs.repository';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AccessLogsController],
  providers: [AccessLogsService, AccessLogsRepository],
  exports: [AccessLogsService],
})
export class AccessLogsModule {}