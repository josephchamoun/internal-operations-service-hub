import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface LiveEvent {
  requestId: string;
  type: string;
  payload: unknown;
}

@Injectable()
export class LiveUpdatesService {
  private readonly events$ = new Subject<LiveEvent>();

  emit(requestId: string, type: string, payload: unknown): void {
    this.events$.next({ requestId, type, payload });
  }

  streamForRequest(requestId: string): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      filter((e) => e.requestId === requestId),
      map((e) => ({ data: { type: e.type, payload: e.payload } }) as MessageEvent),
    );
  }
}