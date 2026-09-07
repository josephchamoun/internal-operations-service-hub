import { ForbiddenException, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { RequestEventsRepository } from './request-events.repository';
import { RequestEventEntity } from './entities/request-event.entity';
import { RequestEventType } from './enums/request-event-type.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class RequestEventsService {
  constructor(
    private readonly repo: RequestEventsRepository,
    private readonly usersService: UsersService,
  ) {}

  findByRequestId(requestId: string): Promise<RequestEventEntity[]> {
    return this.repo.findByRequestId(requestId);
  }

  async findAll(actorId: string): Promise<RequestEventEntity[]> {
    const actor = await this.usersService.findOne(actorId);
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view all request events');
    }
    return this.repo.findAll();
  }

  append(params: {
    requestId: string;
    eventType: RequestEventType;
    actorId: string | null;
    fromValue: string | null;
    toValue: string | null;
  }): Promise<RequestEventEntity> {
    const entity: RequestEventEntity = {
      id: uuid(),
      requestId: params.requestId,
      eventType: params.eventType,
      actorId: params.actorId,
      fromValue: params.fromValue,
      toValue: params.toValue,
      createdAt: new Date().toISOString(),
    };
    return this.repo.create(entity);
  }
}