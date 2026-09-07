import { Injectable, NotFoundException } from '@nestjs/common';
import { PrioritiesRepository } from './priorities.repository';
import { PriorityEntity } from './entities/priority.entity';

@Injectable()
export class PrioritiesService {
  constructor(private readonly repo: PrioritiesRepository) {}

  findAll(): Promise<PriorityEntity[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<PriorityEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`Priority ${id} not found`);
    return found;
  }
}
