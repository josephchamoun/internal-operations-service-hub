import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SilencesRepository } from './silences.repository';
import { RequestsRepository } from '../requests/requests.repository';
import { HubJwtPayload } from '../auth/auth.service';

@Injectable()
export class SilencesService {
  constructor(
    private readonly repo: SilencesRepository,
    private readonly requestsRepo: RequestsRepository,
  ) {}

  async get(
    requestId: string,
    actor: HubJwtPayload,
  ): Promise<{ silenced: boolean }> {
    await this.requireOwningTeamMember(requestId, actor);
    return { silenced: await this.repo.isSilenced(actor.userId, requestId) };
  }

  async silence(requestId: string, actor: HubJwtPayload): Promise<{ silenced: true }> {
    await this.requireOwningTeamMember(requestId, actor);
    await this.repo.create(actor.userId, requestId);
    return { silenced: true };
  }

  async unsilence(
    requestId: string,
    actor: HubJwtPayload,
  ): Promise<{ silenced: false }> {
    await this.requireOwningTeamMember(requestId, actor);
    await this.repo.remove(actor.userId, requestId);
    return { silenced: false };
  }

  private async requireOwningTeamMember(
    requestId: string,
    actor: HubJwtPayload,
  ) {
    const request = await this.requestsRepo.findById(requestId);
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    if (!actor.teamIds.includes(request.owningTeamId)) {
      throw new ForbiddenException(
        'Only a member of the owning team can silence reminders for this request',
      );
    }
    return request;
  }
}
