import {
  BadRequestException,
  ConflictException,
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
const OTHER_CATEGORY_ID = 'other';

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

  findMine(actorId: string): Promise<RequestEntity[]> {
    // Convenience filter, not a security boundary — GET /requests already
    // shows everyone every request, this just narrows the view.
    return this.repo.findAll().then((all) => all.filter((r) => r.requesterId === actorId));
  }

  async findOne(id: string): Promise<RequestSummary> {
    const request = await this.requireRequest(id);
    const { description, ...summary } = request;
    return summary;
  }

  async findFullDetails(id: string, actorId?: string): Promise<RequestEntity> {
    const request = await this.requireRequest(id);

    if (actorId) {
      await this.usersService.findOne(actorId); // confirms the id is a real user
      await this.accessLogsService.record(actorId, request.id);
    }

    return request;
  }

  async findEvents(id: string): Promise<RequestEventEntity[]> {
    await this.requireRequest(id);
    return this.requestEventsService.findByRequestId(id);
  }

  async create(dto: CreateRequestDto): Promise<RequestEntity> {
    await this.usersService.findOne(dto.requesterId);
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
      await this.teamsService.findOne(dto.teamId); // confirms it's a real team
      owningTeamId = dto.teamId;
    }

    const priorityId = dto.priorityId ?? 'Normal';
    await this.prioritiesService.findOne(priorityId);

    const now = new Date().toISOString();
    const entity: RequestEntity = {
      id: uuid(),
      requesterId: dto.requesterId,
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
    return this.repo.create(entity);
  }

  async claim(id: string, dto: ClaimRequestDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'claimed');

    if (request.claimedBy) {
      throw new ConflictException(`Request ${id} is already claimed by ${request.claimedBy}`);
    }

    const actor = await this.usersService.findOne(dto.actorId); // confirms actorId is real

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

  const actor = await this.usersService.findOne(dto.actorId); // confirms actorId is real

  const previousClaimant = request.claimedBy;
  const updated = (await this.repo.update(id, { claimedBy: null })) as RequestEntity;
  await this.requestEventsService.append({
    requestId: id,
    eventType: RequestEventType.UNCLAIMED,
    actorId: actor.id,
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

  const actor = await this.usersService.findOne(dto.actorId); // confirms actorId is real

  const updated = (await this.repo.update(id, { status: dto.status })) as RequestEntity;
  await this.requestEventsService.append({
    requestId: id,
    eventType: RequestEventType.STATUS_CHANGE,
    actorId: actor.id,
    fromValue: request.status,
    toValue: dto.status,
  });
  return updated;
}

async cancel(id: string, dto: CancelRequestDto): Promise<RequestEntity> {
  const request = await this.requireRequest(id);

  if (request.status !== RequestStatus.NEW && request.status !== RequestStatus.IN_PROGRESS) {
    throw new BadRequestException(
      `Cannot cancel a request that is already ${request.status}`,
    );
  }

  const actor = await this.usersService.findOne(dto.actorId); // confirms actorId is real

  const updated = (await this.repo.update(id, {
    status: RequestStatus.CANCELLED,
  })) as RequestEntity;
  await this.requestEventsService.append({
    requestId: id,
    eventType: RequestEventType.STATUS_CHANGE,
    actorId: actor.id,
    fromValue: request.status,
    toValue: RequestStatus.CANCELLED,
  });
  return updated;
}

  async reassign(id: string, dto: ReassignRequestDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'reassigned');

    const actor = await this.usersService.findOne(dto.actorId);
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
      actorId: actor.id,
      fromValue: previousTeamId,
      toValue: dto.newTeamId,
    });

    if (newCategoryId !== previousCategoryId) {
      await this.requestEventsService.append({
        requestId: id,
        eventType: RequestEventType.CATEGORY_CHANGED,
        actorId: actor.id,
        fromValue: previousCategoryId,
        toValue: newCategoryId,
      });
    }

    return updated;
    // Later: notify every member of the new owning team.
  }

  async updatePriority(id: string, dto: UpdatePriorityDto): Promise<RequestEntity> {
    const request = await this.requireRequest(id);
    this.assertNotTerminal(request, 'updated');

    const actor = await this.usersService.findOne(dto.actorId); // confirms actorId is real
    await this.prioritiesService.findOne(dto.priorityId); // confirms it's a real priority

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

  async findAccessLogsForRequest(id: string) {
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
