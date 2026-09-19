import { Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { SilencesService } from './silences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('requests/:requestId/silence')
export class SilencesController {
  constructor(private readonly silencesService: SilencesService) {}

  @Get()
  get(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.silencesService.get(requestId, actor);
  }

  @Put()
  silence(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.silencesService.silence(requestId, actor);
  }

  @Delete()
  unsilence(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.silencesService.unsilence(requestId, actor);
  }
}
