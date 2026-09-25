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
        active: true,
        teamIds: [],
      }),
      countByRole: jest.fn().mockResolvedValue(1),
    };
    const service = new UsersService(repo as any, { findOne: jest.fn() } as any);

    await expect(
      service.update('admin-1', { role: 'employee' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects deactivating the last admin', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        id: 'admin-1',
        name: 'Jordan',
        email: 'admin@test.local',
        role: 'admin',
        active: true,
        teamIds: [],
      }),
      countByRole: jest.fn().mockResolvedValue(1),
      countActiveAdmins: jest.fn().mockResolvedValue(1),
      update: jest.fn(),
    };
    const service = new UsersService(repo as any, { findOne: jest.fn() } as any);

    await expect(
      service.update('admin-1', { active: false }),
    ).rejects.toThrow(ConflictException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('saves an inactive employee without touching their history', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        email: 'alice@test.local',
        role: 'employee',
        active: true,
        teamIds: [],
      }),
      update: jest.fn().mockResolvedValue({ id: 'u1', active: false }),
    };
    const service = new UsersService(repo as any, { findOne: jest.fn() } as any);

    await service.update('u1', { active: false });

    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', active: false, role: UserRole.employee }),
    );
  });
});
