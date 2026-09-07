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
import { ClaimRequestDto } from './dto/claim-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { PrioritiesService } from '../priorities/priorities.service';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { RequestEventsService } from '../request-events/request-events.service';
import { RequestEventType } from '../request-events/enums/request-event-type.enum';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { RequestEventEntity } from '../request-events/entities/request-event.entity';
import { TeamsService } from '../teams/teams.service';
import { ReassignRequestDto } from './dto/reassign-request.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';


const TERMINAL_STATUSES: RequestStatus[] = [RequestStatus.RESOLVED, RequestStatus.CANCELLED];


@Injectable()
export class RequestsService {
  constructor(
    private readonly repo: RequestsRepository,
    private readonly prioritiesService: PrioritiesService,
    private readonly categoriesService: CategoriesService,
    private readonly usersService: UsersService,
    private readonly teamsService: TeamsService,
    private readonly requestEventsService: RequestEventsService,
    private readonly accessLogsService: AccessLogsService,
  ) {}

  findAll(): Promise<RequestEntity[]> {
    return this.repo.findAll();
  }

  async findOne(id: string, actorId: string): Promise<RequestSummary> {
    const request = await this.requireRequest(id);
    const actor = await this.usersService.findOne(actorId);

    const isRequester = actor.id === request.requesterId;
    const isOwningTeamMember = actor.teamIds.includes(request.owningTeamId);
    const isAdmin = actor.role === 'admin';

    if (!isRequester && !isOwningTeamMember && !isAdmin) {
      throw new ForbiddenException('You do not have access to this request');
    }

    const { description, ...summary } = request;
    return summary;
  }

  async findFullDetails(id: string, actorId: string): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    const actor = await this.usersService.findOne(actorId);

    const isRequester = actor.id === request.requesterId;
    const isOwningTeamMember = actor.teamIds.includes(request.owningTeamId);
    const isAdmin = actor.role === 'admin';

    if (!isRequester && !isOwningTeamMember && !isAdmin) {
      throw new ForbiddenException('You do not have access to this request');
    }

    if (isOwningTeamMember && !isRequester) {
      await this.accessLogsService.record(actor.id, request.id);
    }

    return request;
  }

  async findEvents(id: string, actorId: string): Promise<RequestEventEntity[]> {
    const request = await this.requireRequest(id);
    const actor = await this.usersService.findOne(actorId);

    const isRequester = actor.id === request.requesterId;
    const isOwningTeamMember = actor.teamIds.includes(request.owningTeamId);
    const isAdmin = actor.role === 'admin';

    if (!isRequester && !isOwningTeamMember && !isAdmin) {
      throw new ForbiddenException("You do not have access to this request's events");
    }

    return this.requestEventsService.findByRequestId(id);
  }

  async create(dto: CreateRequestDto): Promise<RequestEntity> {
    await this.usersService.findOne(dto.requesterId);
    const category = await this.categoriesService.findOne(dto.categoryId);

    if (!category.defaultTeamId) {
      throw new BadRequestException(
        `Category "${category.id}" has no default team; manual team selection isn't supported yet`,
      );
    }

    const priorityId = dto.priorityId ?? 'Normal';
    await this.prioritiesService.findOne(priorityId);

    const now = new Date().toISOString();
    const entity: RequestEntity = {
      id: uuid(),
      requesterId: dto.requesterId,
      categoryId: dto.categoryId,
      owningTeamId: category.defaultTeamId,
      priorityId,
      status: RequestStatus.NEW,
      claimedBy: null,
      subject: dto.subject,
      description: dto.description,
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.create(entity);
    // Later: notify every member of the owning team.
  }

  async claim(id: string, dto: ClaimRequestDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id); //get the request by id
    this.assertNotTerminal(request, 'claimed'); //check if request is cancelled or resolved

    if (request.claimedBy) { //if claimed by another user, throw conflict exception
      throw new ConflictException(`Request ${id} is already claimed by ${request.claimedBy}`);
    }

    const actor = await this.usersService.findOne(dto.actorId); //dto.actorId gets the actorid written in the request body, must be changed later when I apply real authentication
    this.assertBelongsToTeam(actor, request.owningTeamId);//check if the actor belongs to the team that owns the request

    const updated = (await this.repo.update(id, { claimedBy: actor.id })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.CLAIMED,
      actorId: actor.id,
      fromValue: null,
      toValue: actor.id,
    });
    return updated;
  }

  async unclaim(id: string, dto: ClaimRequestDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'unclaimed');

    if (!request.claimedBy) {
      throw new BadRequestException(`Request ${id} is not claimed`);
    }
    if (request.claimedBy !== dto.actorId) {
      throw new ForbiddenException('Only the current claimant can unclaim this request');
    }

    const previousClaimant = request.claimedBy;
    const updated = (await this.repo.update(id, { claimedBy: null })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.UNCLAIMED,
      actorId: dto.actorId,
      fromValue: previousClaimant,
      toValue: null,
    });
    return updated;
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'updated');

    if (!request.claimedBy) {
      throw new BadRequestException('Request must be claimed before its status can change');
    }
    if (request.claimedBy !== dto.actorId) {
      throw new ForbiddenException("Only the current claimant can change this request's status");
    }
    if (dto.status === RequestStatus.RESOLVED && dto.actorId === request.requesterId) {
      throw new ForbiddenException('The requester cannot mark their own request as Resolved');
    }

    const updated = (await this.repo.update(id, { status: dto.status })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.STATUS_CHANGE,
      actorId: dto.actorId,
      fromValue: request.status,
      toValue: dto.status,
    });
    return updated;
  }

  async cancel(id: string, dto: CancelRequestDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);

    if (request.requesterId !== dto.actorId) {
      throw new ForbiddenException('Only the requester can cancel their own request');
    }
    if (request.status !== RequestStatus.NEW && request.status !== RequestStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot cancel a request that is already ${request.status}`,
      );
    }

    const updated = (await this.repo.update(id, {
      status: RequestStatus.CANCELLED,
    })) as RequestEntity;
    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.STATUS_CHANGE,
      actorId: dto.actorId,
      fromValue: request.status,
      toValue: RequestStatus.CANCELLED,
    });
    return updated;
  }

  async reassign(id: string, dto: ReassignRequestDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'reassigned');

    const actor = await this.usersService.findOne(dto.actorId);
    this.assertBelongsToTeam(actor, request.owningTeamId);

    await this.teamsService.findOne(dto.newTeamId); // throws NotFoundException if the team doesn't exist

    if (dto.newTeamId === request.owningTeamId) {
      throw new BadRequestException('Request is already owned by this team');
    }

    const previousTeamId = request.owningTeamId;
    const updated = (await this.repo.update(id, {
      owningTeamId: dto.newTeamId,
      claimedBy: null,
    })) as RequestEntity;

    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.REASSIGNED,
      actorId: actor.id,
      fromValue: previousTeamId,
      toValue: dto.newTeamId,
    });

    return updated;
    // Later: notify every member of the new owning team.
  }

  private async requireRequest(id: string): Promise<RequestEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`Request ${id} not found`);
    return found;
  }


  async findAccessLogsForRequest(id: string, actorId: string) {
    const request = await this.requireRequest(id);
    const admin = await this.usersService.findOne(actorId);
    if (admin.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view this request\'s access logs');
    }

    const logs = await this.accessLogsService.findByRequestId(id);

    return Promise.all(
      logs.map(async (log) => {
        const viewer = await this.usersService.findOne(log.userId);
        const isLegit = viewer.id === request.requesterId || viewer.teamIds.includes(request.owningTeamId);
        return { ...log, wasOutOfTeam: !isLegit };
      }),
    );
  }

  async findMine(actorId: string): Promise<RequestEntity[]> {
    const actor = await this.usersService.findOne(actorId);
    const all = await this.repo.findAll();
    return all.filter((r) => r.requesterId === actor.id);
  }

  async findAllScoped(actorId: string): Promise<RequestEntity[]> {
    const actor = await this.usersService.findOne(actorId);
    if (actor.role === 'admin') {
      return this.repo.findAll();
    }
    const all = await this.repo.findAll();
    return all.filter((r) => actor.teamIds.includes(r.owningTeamId));
  }

  async updatePriority(id: string, dto: UpdatePriorityDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'updated');

    const actor = await this.usersService.findOne(dto.actorId);
    this.assertBelongsToTeam(actor, request.owningTeamId);

    await this.prioritiesService.findOne(dto.priorityId); // validates it's a real priority

    const previousPriorityId = request.priorityId;
    const updated = (await this.repo.update(id, { priorityId: dto.priorityId })) as RequestEntity;

    await this.requestEventsService.append({
      requestId: id,
      eventType: RequestEventType.PRIORITY_CHANGED, 
      actorId: actor.id,
      fromValue: previousPriorityId,
      toValue: dto.priorityId,
    });

    return updated;
  }

  private assertNotTerminal(request: RequestEntity, action: string): void {
    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new BadRequestException(
        `Request ${request.id} is ${request.status} and can no longer be ${action}`,
      );
    }
  }

  private assertBelongsToTeam(user: { id: string; teamIds: string[] }, teamId: string): void {
    if (!user.teamIds.includes(teamId)) {
      throw new ForbiddenException(`User ${user.id} is not a member of team ${teamId}`);
    }
  }
}
