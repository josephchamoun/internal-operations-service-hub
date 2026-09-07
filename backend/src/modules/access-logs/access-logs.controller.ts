import { Controller, Get, Query } from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';

@Controller('access-logs')
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Get()
  findAll(@Query('actorId') actorId: string) {
    return this.accessLogsService.findAll(actorId);
  }
}