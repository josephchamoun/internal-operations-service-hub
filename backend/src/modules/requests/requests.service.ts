import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { RequestsRepository } from './requests.repository';
import { RequestEntity, RequestSummary } from './entities/request.entity';
import { RequestStatus } from './enums/request-status.enum';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { PrioritiesService } from '../priorities/priorities.service';
import { CategoriesService } from '../categories/categories.service';
import { RequestEventsService } from '../request-events/request-events.service';
import { RequestEventType } from '../request-events/enums/request-event-type.enum';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { RequestEventEntity } from '../request-events/entities/request-event.entity';
import { TeamsService } from '../teams/teams.service';
import { ReassignRequestDto } from './dto/reassign-request.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { HubJwtPayload } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LiveUpdatesService } from '../live-updates/live-updates.service';

const TERMINAL_STATUSES: RequestStatus[] = [RequestStatus.RESOLVED, RequestStatus.CANCELLED];
const OTHER_CATEGORY_ID = 'other';

export interface LimitedRequestView {
  id: string;
  categoryId: string;
  requesterId: string;
  createdAt: string;
  subject: string;
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly repo: RequestsRepository,
    private readonly prioritiesService: PrioritiesService,
    private readonly categoriesService: CategoriesService,
    private readonly teamsService: TeamsService,
    private readonly requestEventsService: RequestEventsService,
    private readonly accessLogsService: AccessLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly liveUpdatesService: LiveUpdatesService,
  ) {}

  findAll(actor: HubJwtPayload): Promise<RequestEntity[]> {
    if (actor.role === 'admin') {
      return this.repo.findAll();
    }

    if (actor.teamIds.length > 0) {
      return this.repo
        .findAll()
        .then((all) => all.filter((r) => actor.teamIds.includes(r.owningTeamId)));
    }

    return this.repo
      .findAll()
      .then((all) => all.filter((r) => r.requesterId === actor.userId));
  }

  findMine(actor: HubJwtPayload): Promise<RequestEntity[]> {
    return this.repo.findAll().then((all) => all.filter((r) => r.requesterId === actor.userId));
  }

  async findOne(id: string): Promise<RequestSummary> {
    const request = await this.requireRequest(id);
    const { description, ...summary } = request;
    return summary;
  }

  async findFullDetails(
    id: string,
    actor: HubJwtPayload,
  ): Promise<RequestEntity | LimitedRequestView> {
    const request = await this.requireRequest(id);

    const isRequester = request.requesterId === actor.userId;
    const isOwningTeamMember = actor.teamIds.includes(request.owningTeamId);

    if (isRequester || isOwningTeamMember) {
      return request;
    }

    await this.accessLogsService.record(actor.userId, request.id);

    return {
      id: request.id,
      categoryId: request.categoryId,
      requesterId: request.requesterId,
      createdAt: request.createdAt,
      subject: request.subject,
    };
  }

  async findEvents(id: string, actor: HubJwtPayload): Promise<RequestEventEntity[]> {
    const request = await this.requireRequest(id);

    const isRequester = request.requesterId === actor.userId;
    const isOwningTeamMember = actor.teamIds.includes(request.owningTeamId);
    const isAdmin = actor.role === 'admin';

    if (!isRequester && !isOwningTeamMember && !isAdmin) {
      throw new ForbiddenException('You do not have access to this request\'s events');
    }

    return this.requestEventsService.findByRequestId(id);
  }

  async create(dto: CreateRequestDto, actor: HubJwtPayload): Promise<RequestEntity> {
    const category = await this.categoriesService.findOne(dto.categoryId);

    let owningTeamId: string;
    if (category.defaultTeamId) {
      owningTeamId = category.defaultTeamId;
    } else {
      if (!dto.teamId) {
        throw new BadRequestException(
          `Category "${category.id}" has no default team; a teamId must be provided`,
        );
      }
      await this.teamsService.findOne(dto.teamId);
      owningTeamId = dto.teamId;
    }

    const priorityId = dto.priorityId ?? 'Normal';
    await this.prioritiesService.findOne(priorityId);

    const now = new Date().toISOString();
    const entity: RequestEntity = {
      id: uuid(),
      requesterId: actor.userId,
      categoryId: dto.categoryId,
      owningTeamId,
      priorityId,
      status: RequestStatus.NEW,
      claimedBy: null,
      subject: dto.subject,
      description: dto.description,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.repo.create(entity);
    void this.notificationsService.notifyTeam(
      created.owningTeamId,
      `New request: ${created.subject}`,
      `A new request has landed in your team's queue.\n\nSubject: ${created.subject}\nCategory: ${created.categoryId}`,
    );

    return created;
  }

  async claim(id: string, actor: HubJwtPayload): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'claimed');

    if (request.claimedBy) {
      throw new ConflictException(`Request ${id} is already claimed by ${request.claimedBy}`);
    }

    if (!actor.teamIds.includes(request.owningTeamId)) {
      throw new ForbiddenException('Only a member of the owning team can claim this request');
    }

    const updated = (await this.repo.update(id, { claimedBy: actor.userId })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.CLAIMED,
      actorId: actor.userId,
      fromValue: null,
      toValue: actor.userId,
    });

    this.liveUpdatesService.emit(id, 'claimed', { claimedBy: actor.userId });
    // Per product-spec.md: claiming itself does not trigger an external
    // notification, since the live push above already reflects it for
    // anyone currently watching the request.
    return updated;
  }

  async unclaim(id: string, actor: HubJwtPayload): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'unclaimed');

    if (!request.claimedBy) {
      throw new BadRequestException(`Request ${id} is not claimed`);
    }

    if (request.claimedBy !== actor.userId) {
      throw new ForbiddenException('Only the current claimant can unclaim this request');
    }

    const previousClaimant = request.claimedBy;
    const updated = (await this.repo.update(id, { claimedBy: null })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.UNCLAIMED,
      actorId: actor.userId,
      fromValue: previousClaimant,
      toValue: null,
    });

    this.liveUpdatesService.emit(id, 'unclaimed', { previousClaimant });

    void this.notificationsService.notifyTeam(
      updated.owningTeamId,
      `Request unclaimed: ${updated.subject}`,
      `A request has been unclaimed and is back in your team's queue.\n\nSubject: ${updated.subject}`,
    );

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    actor: HubJwtPayload,
  ): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'updated');

    if (!request.claimedBy) {
      throw new BadRequestException('Request must be claimed before its status can change');
    }

    if (request.claimedBy !== actor.userId) {
      throw new ForbiddenException('Only the current claimant can change this request\'s status');
    }

    const updated = (await this.repo.update(id, { status: dto.status })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.STATUS_CHANGE,
      actorId: actor.userId,
      fromValue: request.status,
      toValue: dto.status,
    });

    this.liveUpdatesService.emit(id, 'status_changed', { status: dto.status });

    void this.notificationsService.notifyUser(
      updated.requesterId,
      `Your request status changed: ${updated.subject}`,
      `Your request is now: ${updated.status}\n\nSubject: ${updated.subject}`,
    );

    return updated;
  }

  async cancel(id: string, actor: HubJwtPayload): Promise<RequestEntity> {
    const request = await this.requireRequest(id);

    if (request.status !== RequestStatus.NEW && request.status !== RequestStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot cancel a request that is already ${request.status}`,
      );
    }

    if (request.requesterId !== actor.userId) {
      throw new ForbiddenException('Only the requester can cancel this request');
    }

    const updated = (await this.repo.update(id, {
      status: RequestStatus.CANCELLED,
    })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.STATUS_CHANGE,
      actorId: actor.userId,
      fromValue: request.status,
      toValue: RequestStatus.CANCELLED,
    });
    return updated;
  }

  async reassign(
    id: string,
    dto: ReassignRequestDto,
    actor: HubJwtPayload,
  ): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'reassigned');

    if (!actor.teamIds.includes(request.owningTeamId)) {
      throw new ForbiddenException(
        'Only a member of the current owning team can reassign this request',
      );
    }

    await this.teamsService.findOne(dto.newTeamId);

    if (dto.newTeamId === request.owningTeamId) {
      throw new BadRequestException('Request is already owned by this team');
    }

    const previousTeamId = request.owningTeamId;
    const previousCategoryId = request.categoryId;

    let newCategoryId: string;
    if (dto.categoryId) {
      const category = await this.categoriesService.findOne(dto.categoryId);
      if (category.defaultTeamId && category.defaultTeamId !== dto.newTeamId) {
        throw new BadRequestException(
          `Category "${category.id}" does not belong to team "${dto.newTeamId}"`,
        );
      }
      newCategoryId = category.id;
    } else {
      newCategoryId = OTHER_CATEGORY_ID;
    }

    const updated = (await this.repo.update(id, {
      owningTeamId: dto.newTeamId,
      claimedBy: null,
      categoryId: newCategoryId,
    })) as RequestEntity;

    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.REASSIGNED,
      actorId: actor.userId,
      fromValue: previousTeamId,
      toValue: dto.newTeamId,
    });

    if (newCategoryId !== previousCategoryId) {
      await this.requestEventsService.append({
        requestId: id,
        eventType: RequestEventType.CATEGORY_CHANGED,
        actorId: actor.userId,
        fromValue: previousCategoryId,
        toValue: newCategoryId,
      });
    }

    void this.notificationsService.notifyTeam(
      updated.owningTeamId,
      `New request: ${updated.subject}`,
      `A request has been reassigned to your team's queue.\n\nSubject: ${updated.subject}`,
    );

    return updated;
  }

  async updatePriority(
    id: string,
    dto: UpdatePriorityDto,
    actor: HubJwtPayload,
  ): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'updated');

    if (!actor.teamIds.includes(request.owningTeamId)) {
      throw new ForbiddenException(
        'Only a member of the owning team can change this request\'s priority',
      );
    }

    await this.prioritiesService.findOne(dto.priorityId);

    const previousPriorityId = request.priorityId;
    const updated = (await this.repo.update(id, { priorityId: dto.priorityId })) as RequestEntity;

    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.PRIORITY_CHANGED,
      actorId: actor.userId,
      fromValue: previousPriorityId,
      toValue: dto.priorityId,
    });

    return updated;
  }

  async findAccessLogsForRequest(id: string, actor: HubJwtPayload) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view access logs');
    }
    await this.requireRequest(id);
    return this.accessLogsService.findByRequestId(id);
  }

  private async requireRequest(id: string): Promise<RequestEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`Request ${id} not found`);
    return found;
  }

  private assertNotTerminal(request: RequestEntity, action: string): void {
    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new BadRequestException(
        `Request ${request.id} is ${request.status} and can no longer be ${action}`,
      );
    }
  }
}