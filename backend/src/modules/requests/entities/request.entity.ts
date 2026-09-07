import { RequestStatus } from '../enums/request-status.enum';

/* Mirrors the Request entity from data-model.md. */
export class RequestEntity {
  id!: string;
  requesterId!: string;
  categoryId!: string;
  owningTeamId!: string;
  priorityId!: string;
  status!: RequestStatus;
  claimedBy!: string | null;
  subject!: string;
  description!: string;
  createdAt!: string;
  updatedAt!: string;
}

// Everything except description, what "opening" a request shows
// before someone chooses to go further and see full details.
export type RequestSummary = Omit<RequestEntity, 'description'>;
