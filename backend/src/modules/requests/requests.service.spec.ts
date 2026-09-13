import { ForbiddenException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestStatus } from './enums/request-status.enum';

describe('RequestsService — claim authorization rule', () => {
  let service: RequestsService;
  let mockRepo: any;
  let mockNotificationsService: any;
  let mockLiveUpdatesService: any;
  let mockRequestEventsService: any;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    mockNotificationsService = {
      notifyTeam: jest.fn(),
      notifyUser: jest.fn(),
    };
    mockLiveUpdatesService = {
      emit: jest.fn(),
    };
    mockRequestEventsService = {
      append: jest.fn(),
    };

    service = new RequestsService(
      mockRepo,
      {} as any, // prioritiesService — unused by claim()
      {} as any, // categoriesService — unused by claim()
      {} as any, // teamsService — unused by claim()
      mockRequestEventsService,
      {} as any, // accessLogsService — unused by claim()
      mockNotificationsService,
      mockLiveUpdatesService,
    );
  });

  // This also serves as regression protection: "a request cannot be
  // claimed by someone outside the owning team" was introduced this week
  // alongside authentication, replacing the Week 2 behavior where any
  // actorId could claim anything.
  it('rejects a claim from an actor who is not on the owning team', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'req1',
      owningTeamId: 'IT',
      claimedBy: null,
      status: RequestStatus.NEW,
    });

    const actorNotOnTeam = { userId: 'u1', role: 'employee', teamIds: [] };

    await expect(service.claim('req1', actorNotOnTeam as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('allows a claim from an actor who is on the owning team', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'req1',
      owningTeamId: 'IT',
      claimedBy: null,
      status: RequestStatus.NEW,
    });
    mockRepo.update.mockResolvedValue({
      id: 'req1',
      owningTeamId: 'IT',
      claimedBy: 'dev-manager',
      status: RequestStatus.NEW,
    });

    const actorOnTeam = { userId: 'dev-manager', role: 'team_member', teamIds: ['IT'] };

    const result = await service.claim('req1', actorOnTeam as any);

    expect(result.claimedBy).toBe('dev-manager');
    expect(mockRepo.update).toHaveBeenCalledWith('req1', { claimedBy: 'dev-manager' });
  });
});