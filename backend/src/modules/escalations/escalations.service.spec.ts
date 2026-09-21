import { EscalationsService } from './escalations.service';
import { RequestEventType } from '../request-events/enums/request-event-type.enum';

describe('EscalationsService', () => {
  const request = {
    id: 'req1',
    owningTeamId: 'IT',
    priorityId: 'Normal',
    subject: 'Stale laptop',
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  let requestsRepo: any;
  let requestEventsService: any;
  let prioritiesService: any;
  let silencesRepo: any;
  let notificationsService: any;
  let service: EscalationsService;

  beforeEach(() => {
    requestsRepo = { findNewUnclaimed: jest.fn().mockResolvedValue([request]) };
    requestEventsService = {
      findLatestOfType: jest.fn().mockResolvedValue(undefined),
      append: jest.fn(),
    };
    prioritiesService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'Normal',
        escalationWindowMinutes: 1440,
      }),
    };
    silencesRepo = { listUserIds: jest.fn().mockResolvedValue(['dev-manager']) };
    notificationsService = {
      notifyTeamExcept: jest.fn().mockResolvedValue({ recipients: 1, sent: 1 }),
    };
    service = new EscalationsService(
      { get: () => '0' } as any,
      requestsRepo,
      requestEventsService,
      prioritiesService,
      silencesRepo,
      notificationsService,
    );
  });

  it('does not remind when the priority window has not elapsed', async () => {
    const result = await service.runSweep(new Date('2026-09-01T01:00:00.000Z'));
    expect(result.reminded).toEqual([]);
    expect(requestEventsService.append).not.toHaveBeenCalled();
    expect(notificationsService.notifyTeamExcept).not.toHaveBeenCalled();
  });

  it('reminds the team except silenced members once the window has elapsed', async () => {
    const result = await service.runSweep(new Date('2026-09-02T01:00:00.000Z'));
    expect(result.reminded).toEqual(['req1']);
    expect(requestEventsService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req1',
        eventType: RequestEventType.ESCALATION_REMINDER,
        actorId: null,
      }),
    );
    expect(notificationsService.notifyTeamExcept).toHaveBeenCalledWith(
      'IT',
      ['dev-manager'],
      expect.any(String),
      expect.any(String),
    );
    expect(
      notificationsService.notifyTeamExcept.mock.invocationCallOrder[0],
    ).toBeLessThan(requestEventsService.append.mock.invocationCallOrder[0]);
  });

  it('does not record a reminder when every intended recipient failed to send', async () => {
    notificationsService.notifyTeamExcept.mockResolvedValue({
      recipients: 2,
      sent: 0,
    });
    const result = await service.runSweep(new Date('2026-09-02T01:00:00.000Z'));
    expect(result.reminded).toEqual([]);
    expect(requestEventsService.append).not.toHaveBeenCalled();
  });

  it('uses the last reminder time, not createdAt, for the next window', async () => {
    requestEventsService.findLatestOfType.mockResolvedValue({
      createdAt: '2026-09-03T00:00:00.000Z',
    });
    const tooSoon = await service.runSweep(new Date('2026-09-03T12:00:00.000Z'));
    expect(tooSoon.reminded).toEqual([]);
    const due = await service.runSweep(new Date('2026-09-04T01:00:00.000Z'));
    expect(due.reminded).toEqual(['req1']);
  });
});
