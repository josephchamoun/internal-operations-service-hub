import { AccessLogsService } from './access-logs.service';

describe('AccessLogsService', () => {
  const userId = 'dev-manager';
  const requestId = 'req1';
  let repo: { findLatestForUserRequest: jest.Mock; create: jest.Mock };
  let service: AccessLogsService;

  beforeEach(() => {
    repo = {
      findLatestForUserRequest: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(async (entity) => entity),
    };
    service = new AccessLogsService(repo as any);
  });

  it('writes a log when this user has not opened the request before', async () => {
    await service.record(userId, requestId, new Date('2026-09-21T13:00:00.000Z'));
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('does not write again within an hour for the same user and request', async () => {
    repo.findLatestForUserRequest.mockResolvedValue({
      id: 'existing',
      userId,
      requestId,
      accessedAt: '2026-09-21T13:00:00.000Z',
    });
    const result = await service.record(
      userId,
      requestId,
      new Date('2026-09-21T13:30:00.000Z'),
    );
    expect(repo.create).not.toHaveBeenCalled();
    expect(result.id).toBe('existing');
  });

  it('writes again once an hour has elapsed', async () => {
    repo.findLatestForUserRequest.mockResolvedValue({
      id: 'existing',
      userId,
      requestId,
      accessedAt: '2026-09-21T13:00:00.000Z',
    });
    await service.record(userId, requestId, new Date('2026-09-21T14:00:00.000Z'));
    expect(repo.create).toHaveBeenCalledTimes(1);
  });
});
