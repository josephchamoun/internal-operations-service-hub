import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { EscalationsService } from './escalations.service';
import { RunEscalationDto } from './dto/run-escalation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('escalations')
export class EscalationsController {
  constructor(private readonly escalationsService: EscalationsService) {}

  // TEST-ONLY — lets you fire a reminder sweep without waiting for the
  // interval. Optional `now` is a simulated clock so you can test windows
  // without waiting hours. Gated off in production.
  @Post('run')
  @UseGuards(JwtAuthGuard)
  run(@Body() dto: RunEscalationDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Manual escalation runs are disabled in production');
    }
    const now = dto.now ? new Date(dto.now) : new Date();
    return this.escalationsService.runSweep(now);
  }
}
