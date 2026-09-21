import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      clearSilence: jest.fn(),
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
    expect(mockRepo.clearSilence).toHaveBeenCalledWith('req1', 'dev-manager');
  });
});

describe('RequestsService — unclaim returns the request to New', () => {
  let service: RequestsService;
  let mockRepo: any;
  let mockRequestEventsService: any;
  let mockNotificationsService: any;
  let mockLiveUpdatesService: any;

  const claimant = { userId: 'dev-manager', role: 'team_member', teamIds: ['IT'] };

  beforeEach(() => {
    mockRepo = { findById: jest.fn(), update: jest.fn(), clearSilence: jest.fn() };
    mockRequestEventsService = { append: jest.fn() };
    mockNotificationsService = { notifyTeam: jest.fn(), notifyUser: jest.fn() };
    mockLiveUpdatesService = { emit: jest.fn() };
    service = new RequestsService(
      mockRepo,
      {} as any,
      {} as any,
      {} as any,
      mockRequestEventsService,
      {} as any,
      mockNotificationsService,
      mockLiveUpdatesService,
    );
  });

  it('clears the claim and sets status back to New when it was In Progress', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'req1',
      owningTeamId: 'IT',
      requesterId: 'dev-employee',
      claimedBy: 'dev-manager',
      status: RequestStatus.IN_PROGRESS,
      subject: 'Laptop',
    });
    mockRepo.update.mockResolvedValue({
      id: 'req1',
      owningTeamId: 'IT',
      requesterId: 'dev-employee',
      claimedBy: null,
      status: RequestStatus.NEW,
      subject: 'Laptop',
    });

    const result = await service.unclaim('req1', claimant as any);

    expect(result.status).toBe(RequestStatus.NEW);
    expect(result.claimedBy).toBeNull();
    expect(mockRepo.update).toHaveBeenCalledWith('req1', {
      claimedBy: null,
      status: RequestStatus.NEW,
    });
    expect(mockRequestEventsService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'status_change',
        fromValue: RequestStatus.IN_PROGRESS,
        toValue: RequestStatus.NEW,
      }),
    );
  });

  it('does not write a status event when the request was already New', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'req1',
      owningTeamId: 'IT',
      requesterId: 'dev-employee',
      claimedBy: 'dev-manager',
      status: RequestStatus.NEW,
      subject: 'Laptop',
    });
    mockRepo.update.mockResolvedValue({
      id: 'req1',
      owningTeamId: 'IT',
      requesterId: 'dev-employee',
      claimedBy: null,
      status: RequestStatus.NEW,
      subject: 'Laptop',
    });

    await service.unclaim('req1', claimant as any);

    expect(mockRepo.update).toHaveBeenCalledWith('req1', { claimedBy: null });
    expect(mockRequestEventsService.append).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'status_change' }),
    );
  });
});

describe('RequestsService — edit details rule', () => {
  let service: RequestsService;
  let mockRepo: any;

  const newUnclaimed = {
    id: 'req1',
    requesterId: 'dev-employee',
    owningTeamId: 'IT',
    claimedBy: null,
    status: RequestStatus.NEW,
    subject: 'Old subject',
    description: 'Old description',
  };

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(newUnclaimed),
      update: jest.fn(),
      clearSilence: jest.fn(),
    };

    service = new RequestsService(
      mockRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { notifyTeam: jest.fn(), notifyUser: jest.fn() } as any,
      { emit: jest.fn() } as any,
    );
  });

  it('allows the requester to edit a New unclaimed request', async () => {
    mockRepo.update.mockResolvedValue({
      ...newUnclaimed,
      subject: 'Updated subject',
      description: 'Updated description',
    });

    const requester = { userId: 'dev-employee', role: 'employee', teamIds: [] };

    const result = await service.updateDetails(
      'req1',
      { subject: 'Updated subject', description: 'Updated description' },
      requester as any,
    );

    expect(result.subject).toBe('Updated subject');
    expect(mockRepo.update).toHaveBeenCalledWith('req1', {
      subject: 'Updated subject',
      description: 'Updated description',
    });
  });

  it('rejects an edit from someone who is not the requester', async () => {
    const actorOnTeam = { userId: 'dev-manager', role: 'team_member', teamIds: ['IT'] };

    await expect(
      service.updateDetails(
        'req1',
        { subject: 'Updated subject', description: 'Updated description' },
        actorOnTeam as any,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('rejects an edit once the request has been claimed', async () => {
    mockRepo.findById.mockResolvedValue({
      ...newUnclaimed,
      claimedBy: 'dev-manager',
    });

    const requester = { userId: 'dev-employee', role: 'employee', teamIds: [] };

    await expect(
      service.updateDetails(
        'req1',
        { subject: 'Updated subject', description: 'Updated description' },
        requester as any,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('rejects an edit once the request has left New', async () => {
    mockRepo.findById.mockResolvedValue({
      ...newUnclaimed,
      status: RequestStatus.IN_PROGRESS,
    });

    const requester = { userId: 'dev-employee', role: 'employee', teamIds: [] };

    await expect(
      service.updateDetails(
        'req1',
        { subject: 'Updated subject', description: 'Updated description' },
        requester as any,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});

describe('RequestsService — list summaries and resolve rule', () => {
  let service: RequestsService;
  let mockRepo: any;
  let mockAccessLogsService: any;
  let mockLiveUpdatesService: any;
  let mockRequestEventsService: any;

  beforeEach(() => {
    mockRepo = { findAll: jest.fn(), findById: jest.fn(), update: jest.fn() };
    mockAccessLogsService = { findLatestForUserRequest: jest.fn() };
    mockLiveUpdatesService = { emit: jest.fn() };
    mockRequestEventsService = { append: jest.fn() };
    service = new RequestsService(
      mockRepo,
      {} as any,
      {} as any,
      {} as any,
      mockRequestEventsService,
      mockAccessLogsService,
      { notifyTeam: jest.fn(), notifyUser: jest.fn() } as any,
      mockLiveUpdatesService,
    );
  });

  it('strips description from list results', async () => {
    mockRepo.findAll.mockResolvedValue([
      {
        id: 'req1',
        requesterId: 'dev-employee',
        owningTeamId: 'IT',
        subject: 'Laptop',
        description: 'secret',
        status: RequestStatus.NEW,
      },
    ]);
    const admin = { userId: 'admin', role: 'admin', teamIds: [] };
    const result = await service.findAll(admin as any);
    expect(result[0]).not.toHaveProperty('description');
    expect(result[0].subject).toBe('Laptop');
  });

  it('rejects Resolve from a requester who is not on the owning team', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'req1',
      requesterId: 'dev-employee',
      owningTeamId: 'IT',
      claimedBy: 'dev-employee',
      status: RequestStatus.IN_PROGRESS,
      subject: 'Laptop',
    });
    const requester = {
      userId: 'dev-employee',
      role: 'employee',
      teamIds: [],
    };
    await expect(
      service.updateStatus(
        'req1',
        { status: RequestStatus.RESOLVED },
        requester as any,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});