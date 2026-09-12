import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequestEventsService } from './request-events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('request-events')
export class RequestEventsController {
  constructor(private readonly requestEventsService: RequestEventsService) {}

  @Get()
  findAll(@CurrentUser() actor: HubJwtPayload) {
    return this.requestEventsService.findAll(actor);
  }
}