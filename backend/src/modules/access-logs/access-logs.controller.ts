import { Controller, Get, ForbiddenException, UseGuards } from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('access-logs')
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Get()
  findAll(@CurrentUser() actor: HubJwtPayload) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view access logs');
    }
    return this.accessLogsService.findAll();
  }
}