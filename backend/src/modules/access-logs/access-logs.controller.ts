import { Controller, Get } from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';

@Controller('access-logs')
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Get()
  findAll() {
    return this.accessLogsService.findAll();
  }
}