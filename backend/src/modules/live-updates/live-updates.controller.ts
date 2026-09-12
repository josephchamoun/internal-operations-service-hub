import { Controller, Sse, Param, Query, UnauthorizedException, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { LiveUpdatesService } from './live-updates.service';

@Controller('requests')
export class LiveUpdatesController {
  constructor(
    private readonly liveUpdatesService: LiveUpdatesService,
    private readonly jwtService: JwtService,
  ) {}

  @Sse(':id/stream')
  stream(@Param('id') id: string, @Query('token') token: string): Observable<MessageEvent> {
    try {
      this.jwtService.verify(token); // throws if invalid/expired
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return this.liveUpdatesService.streamForRequest(id);
  }
}