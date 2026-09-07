import { Injectable, NotFoundException } from '@nestjs/common';
import { TeamsRepository } from './teams.repository';
import { TeamEntity } from './entities/team.entity';

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
}
