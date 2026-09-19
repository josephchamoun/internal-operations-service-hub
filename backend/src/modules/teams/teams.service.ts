import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { TeamsRepository } from './teams.repository';
import { TeamEntity } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly repo: TeamsRepository) {}

  findAll(): Promise<TeamEntity[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<TeamEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`Team ${id} not found`);
    return found;
  }

  async create(dto: CreateTeamDto): Promise<TeamEntity> {
    return this.repo.create(uuid(), dto.name.trim());
  }

  async update(id: string, dto: UpdateTeamDto): Promise<TeamEntity> {
    await this.findOne(id);
    return this.repo.update(id, dto.name.trim());
  }

  async remove(id: string): Promise<TeamEntity> {
    const existing = await this.findOne(id);
    const usage = await this.repo.countUsage(id);
    if (usage > 0) {
      throw new ConflictException(
        `Team ${id} is still used by requests, memberships, or categories`,
      );
    }
    await this.repo.remove(id);
    return existing;
  }
}
