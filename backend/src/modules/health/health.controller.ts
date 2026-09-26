import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { HealthAuthGuard } from './health-auth.guard';
import { HealthService } from './health.service';

@Controller('health')
@UseGuards(HealthAuthGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const report = await this.healthService.report();
    res.status(report.status === 'ok' ? 200 : 503);
    return report;
  }
}
