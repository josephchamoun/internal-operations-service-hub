import { Module } from '@nestjs/common';
import { SilencesController } from './silences.controller';
import { SilencesService } from './silences.service';
import { SilencesRepository } from './silences.repository';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [RequestsModule],
  controllers: [SilencesController],
  providers: [SilencesService, SilencesRepository],
  exports: [SilencesRepository],
})
export class SilencesModule {}
