import { Controller, Get, Query } from '@nestjs/common';
import { RequestEventsService } from './request-events.service';

@Controller('request-events')
export class RequestEventsController {
  constructor(private readonly requestEventsService: RequestEventsService) {}

  @Get()
  findAll(@Query('actorId') actorId: string) {
    return this.requestEventsService.findAll(actorId);
  }
}