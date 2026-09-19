import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { MessagesRepository } from './messages.repository';
import { MessageEntity } from './message.entity';
import { RequestsRepository } from '../requests/requests.repository';
import { RequestEntity } from '../requests/entities/request.entity';
import { RequestStatus } from '../requests/enums/request-status.enum';
import { HubJwtPayload } from '../auth/auth.service';
import { assertAllowedFiles, StoredUpload } from '../attachments/file-rules';
import { LiveUpdatesService } from '../live-updates/live-updates.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly repo: MessagesRepository,
    private readonly requestsRepo: RequestsRepository,
    private readonly liveUpdatesService: LiveUpdatesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(requestId: string, actor: HubJwtPayload): Promise<MessageEntity[]> {
    await this.requireVisible(requestId, actor);
    const rows = await this.repo.findByRequestId(requestId);
    return rows.filter(
      (item) => item.body.trim() !== '' || item.attachments.length > 0,
    );
  }

  async create(
    requestId: string,
    actor: HubJwtPayload,
    body: string,
    files: StoredUpload[],
  ): Promise<MessageEntity> {
    const request = await this.requireRequest(requestId);
    this.assertCanPost(request, actor);
    if (
      request.status === RequestStatus.RESOLVED ||
      request.status === RequestStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot send messages on a resolved or cancelled request',
      );
    }
    const text = body.trim();
    if (!text && files.length === 0) {
      throw new BadRequestException('Send a message, a file, or both');
    }
    assertAllowedFiles(files);
    const id = uuid();
    await this.repo.createWithFiles({
      id,
      requestId: request.id,
      senderId: actor.userId,
      body: text,
      files: files.map((file) => ({
        fileName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        fileRef: file.buffer,
      })),
    });
    const [created] = (await this.repo.findByRequestId(request.id)).filter(
      (item) => item.id === id,
    );
    this.liveUpdatesService.emit(
      request.id,
      request.owningTeamId,
      request.requesterId,
      'message',
      { message: created },
    );
    this.notifyOtherSide(request, actor);
    return created;
  }

  private notifyOtherSide(request: RequestEntity, actor: HubJwtPayload): void {
    const preview = `New message on: ${request.subject}`;
    if (actor.userId === request.requesterId) {
      void this.notificationsService.notifyTeam(
        request.owningTeamId,
        preview,
        `The requester sent a message on "${request.subject}".`,
      );
      return;
    }
    void this.notificationsService.notifyUser(
      request.requesterId,
      preview,
      `The owning team sent a message on "${request.subject}".`,
    );
  }

  private async requireVisible(
    requestId: string,
    actor: HubJwtPayload,
  ): Promise<RequestEntity> {
    const request = await this.requireRequest(requestId);
    const isRequester = request.requesterId === actor.userId;
    const isTeam = actor.teamIds.includes(request.owningTeamId);
    const isAdmin = actor.role === 'admin';
    if (!isRequester && !isTeam && !isAdmin) {
      throw new ForbiddenException('You do not have access to this request');
    }
    return request;
  }

  private async requireRequest(requestId: string): Promise<RequestEntity> {
    const request = await this.requestsRepo.findById(requestId);
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    return request;
  }

  private assertCanPost(request: RequestEntity, actor: HubJwtPayload): void {
    const isRequester = request.requesterId === actor.userId;
    const isTeam = actor.teamIds.includes(request.owningTeamId);
    if (!isRequester && !isTeam) {
      throw new ForbiddenException(
        'Only the requester or owning team can send messages',
      );
    }
  }
}
