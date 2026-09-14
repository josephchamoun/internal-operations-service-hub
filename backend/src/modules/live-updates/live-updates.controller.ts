import { Controller, Sse, Param, Query, UnauthorizedException, ForbiddenException, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { LiveUpdatesService } from './live-updates.service';
import { RequestsRepository } from '../requests/requests.repository';
import { HubJwtPayload } from '../auth/auth.service';

@Controller('requests')
export class LiveUpdatesController {
  constructor(
    private readonly liveUpdatesService: LiveUpdatesService,
    private readonly jwtService: JwtService,
    private readonly requestsRepo: RequestsRepository,
  ) {}

  @Sse('stream/all')
  streamAll(@Query('token') token: string): Observable<MessageEvent> {
    const payload = this.verify(token);
    return this.liveUpdatesService.streamForUser({
      userId: payload.userId,
      role: payload.role,
      teamIds: payload.teamIds,
    });
  }

  @Sse(':id/stream')
  async stream(@Param('id') id: string, @Query('token') token: string): Promise<Observable<MessageEvent>> {
    const payload = this.verify(token);
    await this.assertCanAccess(id, payload);
    return this.liveUpdatesService.streamForRequest(id);
  }

  private verify(token: string): HubJwtPayload {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async assertCanAccess(id: string, actor: HubJwtPayload): Promise<void> {
    const request = await this.requestsRepo.findById(id);
    if (!request) return; // let the initial data fetch surface the 404

    const isRequester = request.requesterId === actor.userId;
    const isOwningTeamMember = actor.teamIds.includes(request.owningTeamId);
    const isAdmin = actor.role === 'admin';

    if (!isRequester && !isOwningTeamMember && !isAdmin) {
      throw new ForbiddenException('You do not have access to this request\'s live updates');
    }
  }
}