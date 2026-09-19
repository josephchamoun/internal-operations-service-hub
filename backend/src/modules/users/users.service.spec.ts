import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService, resolveRole } from './users.service';

describe('UsersService role and last-admin rules', () => {
  it('keeps admin even with no teams', () => {
    expect(resolveRole('admin', [])).toBe(UserRole.admin);
  });

  it('sets team_member when any team is assigned', () => {
    expect(resolveRole('employee', ['IT'])).toBe(UserRole.team_member);
  });

  it('sets employee when all teams are cleared', () => {
    expect(resolveRole('team_member', [])).toBe(UserRole.employee);
  });

  it('rejects demoting the last admin', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        id: 'admin-1',
        name: 'Jordan',
        email: 'admin@test.local',
        role: 'admin',
        teamIds: [],
      }),
      countByRole: jest.fn().mockResolvedValue(1),
    };
    const service = new UsersService(repo as any, { findOne: jest.fn() } as any);

    await expect(
      service.update('admin-1', { role: 'employee' }),
    ).rejects.toThrow(ConflictException);
  });
});
