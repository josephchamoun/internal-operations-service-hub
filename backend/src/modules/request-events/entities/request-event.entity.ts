import { RequestEventType } from '../enums/request-event-type.enum';

export class RequestEventEntity {
  id!: string;
  requestId!: string;
  eventType!: RequestEventType;
  actorId!: string | null;
  fromValue!: string | null;
  toValue!: string | null;
  createdAt!: string;
}
