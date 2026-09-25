import { RequestStatus } from '../requests/enums/request-status.enum';
import { MessagesService } from './messages.service';

jest.mock('uuid', () => ({ v4: () => 'msg-1' }));

describe('MessagesService message mail', () => {
  const request = {
    id: 'r1',
    requesterId: 'emp',
    owningTeamId: 'it',
    subject: 'Laptop',
    status: RequestStatus.NEW,
  };
  const created = {
    id: 'msg-1',
    body: 'more detail',
    attachments: [],
  };

  function build() {
    const notifications = {
      notifyTeam: jest.fn(),
      notifyUser: jest.fn(),
    };
    const service = new MessagesService(
      {
        createWithFiles: jest.fn(),
        findByRequestId: jest.fn().mockResolvedValue([created]),
      } as any,
      { findById: jest.fn().mockResolvedValue(request) } as any,
      { emit: jest.fn() } as any,
      notifications as any,
    );
    return { service, notifications };
  }

  const requester = {
    userId: 'emp',
    name: 'Sam',
    role: 'employee' as const,
    teamIds: [],
  };

  it('emails the team once, then skips further mail inside two minutes', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const { service, notifications } = build();

    await service.create('r1', requester, 'more detail', []);
    await service.create('r1', requester, 'and this', []);
    expect(notifications.notifyTeam).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 2 * 60 * 1000);
    await service.create('r1', requester, 'later', []);
    expect(notifications.notifyTeam).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
});
