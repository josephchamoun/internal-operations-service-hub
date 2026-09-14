import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface LiveEvent {
  requestId: string;
  owningTeamId: string;
  requesterId: string;
  type: string;
  payload: unknown;
}

interface Subscriber {
  userId: string;
  role: string;
  teamIds: string[];
}

@Injectable()
export class LiveUpdatesService {
  private readonly events$ = new Subject<LiveEvent>();

  emit(
    requestId: string,
    owningTeamId: string,
    requesterId: string,
    type: string,
    payload: unknown,
  ): void {
    this.events$.next({ requestId, owningTeamId, requesterId, type, payload });
  }

  streamForRequest(requestId: string): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      filter((e) => e.requestId === requestId),
      map((e) => ({ data: { type: e.type, payload: e.payload } }) as MessageEvent),
    );
  }

  streamForUser(subscriber: Subscriber): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      filter(
        (e) =>
          subscriber.role === 'admin' ||
          subscriber.teamIds.includes(e.owningTeamId) ||
          e.requesterId === subscriber.userId,
      ),
      map((e) => ({ data: { type: e.type, requestId: e.requestId, payload: e.payload } }) as MessageEvent),
    );
  }
}