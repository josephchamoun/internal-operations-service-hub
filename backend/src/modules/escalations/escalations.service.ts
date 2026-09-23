import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestsRepository } from '../requests/requests.repository';
import { RequestEventsService } from '../request-events/request-events.service';
import { RequestEventType } from '../request-events/enums/request-event-type.enum';
import { PrioritiesService } from '../priorities/priorities.service';
import { SilencesRepository } from '../silences/silences.repository';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EscalationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationsService.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly requestsRepo: RequestsRepository,
    private readonly requestEventsService: RequestEventsService,
    private readonly prioritiesService: PrioritiesService,
    private readonly silencesRepo: SilencesRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID) return;
    const ms = Number(
      this.configService.get<string>('ESCALATION_CHECK_INTERVAL_MS') ?? '7200000',
    );
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.timer = setInterval(() => {
      void this.runSweep().catch((err) =>
        this.logger.error(`Escalation sweep failed: ${err}`),
      );
    }, ms);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runSweep(now = new Date()): Promise<{ reminded: string[] }> {
    const candidates = await this.requestsRepo.findNewUnclaimed();
    const reminded: string[] = [];

    for (const request of candidates) {
      const priority = await this.prioritiesService.findOne(request.priorityId);
      const lastReminder = await this.requestEventsService.findLatestOfType(
        request.id,
        RequestEventType.ESCALATION_REMINDER,
      );
      const baseline = lastReminder
        ? new Date(lastReminder.createdAt)
        : new Date(request.createdAt);
      const elapsedMs = now.getTime() - baseline.getTime();
      const windowMs = priority.escalationWindowMinutes * 60 * 1000;
      if (elapsedMs < windowMs) continue;

      const silenced = await this.silencesRepo.listUserIds(request.id);
      const result = await this.notificationsService.notifyTeamExcept(
        request.owningTeamId,
        silenced,
        `Reminder: ${request.subject} is still unclaimed`,
        `This request is still New and unclaimed.\n\nSubject: ${request.subject}`,
      );
      if (result && result.recipients > 0 && result.sent === 0) {
        continue;
      }

      await this.requestEventsService.append({
        requestId: request.id,
        eventType: RequestEventType.ESCALATION_REMINDER,
        actorId: null,
        fromValue: null,
        toValue: null,
      });
      reminded.push(request.id);
    }

    return { reminded };
  }
}
