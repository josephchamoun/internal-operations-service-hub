import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentMeta } from './attachment.entity';
import { assertAllowedFile, StoredUpload } from './file-rules';
import { RequestsRepository } from '../requests/requests.repository';
import { RequestEntity } from '../requests/entities/request.entity';
import { RequestStatus } from '../requests/enums/request-status.enum';
import { HubJwtPayload } from '../auth/auth.service';
import { LiveUpdatesService } from '../live-updates/live-updates.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly repo: AttachmentsRepository,
    private readonly requestsRepo: RequestsRepository,
    private readonly liveUpdatesService: LiveUpdatesService,
  ) {}

  async listForRequest(
    requestId: string,
    actor: HubJwtPayload,
  ): Promise<AttachmentMeta[]> {
    const request = await this.requireVisible(requestId, actor);
    return this.repo.findByRequestId(request.id);
  }

  async download(
    requestId: string,
    attachmentId: string,
    actor: HubJwtPayload,
  ): Promise<{ file: StreamableFile; fileName: string; contentType: string }> {
    await this.requireVisible(requestId, actor);
    const row = await this.repo.findById(attachmentId);
    if (!row || row.requestId !== requestId) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    return {
      file: new StreamableFile(row.fileRef),
      fileName: row.fileName,
      contentType: row.contentType,
    };
  }

  async addToRequest(
    requestId: string,
    actor: HubJwtPayload,
    files: StoredUpload[],
  ): Promise<AttachmentMeta[]> {
    const request = await this.requireRequest(requestId);
    this.assertCanPost(request, actor);
    this.assertUnlockedForNewRequestFiles(request);
    if (!files.length) {
      throw new BadRequestException('Attach at least one file');
    }
    for (const file of files) {
      assertAllowedFile(file);
    }
    const saved: AttachmentMeta[] = [];
    for (const file of files) {
      saved.push(await this.save(request, actor.userId, null, file));
    }
    this.liveUpdatesService.emit(
      request.id,
      request.owningTeamId,
      request.requesterId,
      'attachment',
      { attachments: saved },
    );
    return saved;
  }

  async saveForMessage(
    request: RequestEntity,
    uploaderId: string,
    messageId: string,
    files: StoredUpload[],
  ): Promise<AttachmentMeta[]> {
    const saved: AttachmentMeta[] = [];
    for (const file of files) {
      saved.push(await this.save(request, uploaderId, messageId, file));
    }
    return saved;
  }

  async replace(
    requestId: string,
    attachmentId: string,
    actor: HubJwtPayload,
    file: StoredUpload | undefined,
  ): Promise<AttachmentMeta> {
    if (!file) {
      throw new BadRequestException('Attach a replacement file');
    }
    const request = await this.requireRequest(requestId);
    const row = await this.repo.findById(attachmentId);
    if (!row || row.requestId !== requestId) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    this.assertCanMutate(request, row.uploaderId, actor);
    assertAllowedFile(file);
    const updated = await this.repo.replaceFile(
      attachmentId,
      file.buffer,
      file.originalname,
      file.mimetype,
      file.size,
    );
    this.liveUpdatesService.emit(
      request.id,
      request.owningTeamId,
      request.requesterId,
      'attachment',
      { attachments: [updated] },
    );
    return updated;
  }

  async remove(
    requestId: string,
    attachmentId: string,
    actor: HubJwtPayload,
  ): Promise<AttachmentMeta> {
    const request = await this.requireRequest(requestId);
    const row = await this.repo.findById(attachmentId);
    if (!row || row.requestId !== requestId) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    this.assertCanMutate(request, row.uploaderId, actor);
    await this.repo.removeAndDropEmptyMessage(attachmentId);
    this.liveUpdatesService.emit(
      request.id,
      request.owningTeamId,
      request.requesterId,
      'attachment',
      { deletedId: attachmentId },
    );
    return {
      id: row.id,
      requestId: row.requestId,
      messageId: row.messageId,
      uploaderId: row.uploaderId,
      fileName: row.fileName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    };
  }

  private async save(
    request: RequestEntity,
    uploaderId: string,
    messageId: string | null,
    file: StoredUpload,
  ): Promise<AttachmentMeta> {
    assertAllowedFile(file);
    return this.repo.create({
      id: uuid(),
      requestId: request.id,
      messageId,
      uploaderId,
      fileRef: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
    });
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
        'Only the requester or owning team can add attachments',
      );
    }
  }

  private assertUnlockedForNewRequestFiles(request: RequestEntity): void {
    if (request.status !== RequestStatus.NEW || request.claimedBy) {
      throw new BadRequestException(
        'Request-level files can only be added while the request is New and unclaimed',
      );
    }
  }

  private assertCanMutate(
    request: RequestEntity,
    uploaderId: string,
    actor: HubJwtPayload,
  ): void {
    if (actor.userId !== uploaderId) {
      throw new ForbiddenException('Only the uploader can change this file');
    }
    if (request.status !== RequestStatus.NEW || request.claimedBy) {
      throw new BadRequestException(
        'Attachments become read-only once the request is claimed or leaves New',
      );
    }
  }
}
