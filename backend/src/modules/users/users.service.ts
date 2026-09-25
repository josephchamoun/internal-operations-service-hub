import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { UserEntity } from './entities/user.entity';
import { v4 as uuid } from 'uuid';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TeamsService } from '../teams/teams.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly teamsService: TeamsService,
  ) {}

  findAll(): Promise<UserEntity[]> {
    return this.repo.findAll();
  }

  async findDirectory(): Promise<{ id: string; name: string; email: string }[]> {
    const users = await this.repo.findAll();
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));
  }

  async findOne(id: string): Promise<UserEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`User ${id} not found`);
    return found;
  }

  findById(id: string): Promise<UserEntity | undefined> {
    return this.repo.findById(id);
  }

  findByIdpSubjectId(idpSubjectId: string): Promise<UserEntity | undefined> {
    return this.repo.findByIdpSubjectId(idpSubjectId);
  }

  findByEmail(email: string): Promise<UserEntity | undefined> {
    return this.repo.findByEmail(email);
  }

  linkIdpSubjectId(id: string, idpSubjectId: string): Promise<UserEntity> {
    return this.repo.linkIdpSubjectId(id, idpSubjectId);
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const email = dto.email.trim();
    await this.assertEmailAvailable(email);
    const requested = dto.role ?? 'employee';
    const teamIds =
      requested === 'team_member'
        ? await this.requireTeams(dto.teamIds ?? [])
        : [];
    const role = resolveRole(requested, teamIds);
    return this.repo.create({
      id: uuid(),
      name: dto.name.trim(),
      email,
      role,
      teamIds,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.findOne(id);
    const email = dto.email?.trim() ?? existing.email;
    if (email.toLowerCase() !== existing.email.toLowerCase()) {
      await this.assertEmailAvailable(email);
    }
    const requested = dto.role ?? existing.role;
    let teamIds =
      dto.teamIds !== undefined
        ? await this.requireTeams(dto.teamIds)
        : existing.teamIds;
    if (dto.role === 'employee' || dto.role === 'admin') {
      teamIds = [];
    }
    const role = resolveRole(requested, teamIds);
    if (existing.role === 'admin' && role !== 'admin') {
      await this.assertNotLastAdmin();
    }
    const active = dto.active ?? existing.active;
    if (existing.role === 'admin' && role === 'admin' && existing.active && !active) {
      const activeAdmins = await this.repo.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new ConflictException('Cannot deactivate the last admin');
      }
    }
    return this.repo.update({
      id,
      name: dto.name?.trim() ?? existing.name,
      email,
      role,
      teamIds,
      active,
    });
  }

  async remove(id: string): Promise<UserEntity> {
    const existing = await this.findOne(id);
    if (existing.role === 'admin') {
      await this.assertNotLastAdmin();
    }
    const references = await this.repo.countReferences(id);
    if (references > 0) {
      throw new ConflictException(
        `User ${id} is still referenced by requests or related records`,
      );
    }
    await this.repo.remove(id);
    return existing;
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const match = await this.repo.findByEmail(email);
    if (match) {
      throw new ConflictException('A user with this email already exists');
    }
  }

  private async assertNotLastAdmin(): Promise<void> {
    const admins = await this.repo.countByRole(UserRole.admin);
    if (admins <= 1) {
      throw new ConflictException('Cannot remove or demote the last admin');
    }
  }

  private async requireTeams(teamIds: string[]): Promise<string[]> {
    const unique = [...new Set(teamIds)];
    for (const teamId of unique) {
      await this.teamsService.findOne(teamId);
    }
    return unique;
  }
}

export function resolveRole(
  requested: 'employee' | 'team_member' | 'admin',
  teamIds: string[],
): UserRole {
  if (requested === 'admin') return UserRole.admin;
  return teamIds.length > 0 ? UserRole.team_member : UserRole.employee;
}
