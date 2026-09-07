import { Module } from '@nestjs/common';
import { PrioritiesController } from './priorities.controller';
import { PrioritiesService } from './priorities.service';
import { PrioritiesRepository } from './priorities.repository';

@Module({
  controllers: [PrioritiesController],
  providers: [PrioritiesService, PrioritiesRepository],
  exports: [PrioritiesService],
})
export class PrioritiesModule {}
