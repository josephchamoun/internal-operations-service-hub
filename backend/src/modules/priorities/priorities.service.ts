import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrioritiesRepository } from './priorities.repository';
import { PriorityEntity } from './entities/priority.entity';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';

const DEFAULT_PRIORITY_ID = 'Normal';

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

  async create(dto: CreatePriorityDto): Promise<PriorityEntity> {
    return this.repo.create({
      id: uuid(),
      name: dto.name.trim(),
      escalationWindowMinutes: dto.escalationWindowMinutes,
    });
  }

  async update(id: string, dto: UpdatePriorityDto): Promise<PriorityEntity> {
    const existing = await this.findOne(id);
    return this.repo.update({
      id,
      name: dto.name?.trim() ?? existing.name,
      escalationWindowMinutes:
        dto.escalationWindowMinutes ?? existing.escalationWindowMinutes,
    });
  }

  async remove(id: string): Promise<PriorityEntity> {
    if (id === DEFAULT_PRIORITY_ID) {
      throw new ConflictException('The Normal priority cannot be deleted');
    }
    const existing = await this.findOne(id);
    const usage = await this.repo.countRequests(id);
    if (usage > 0) {
      throw new ConflictException(`Priority ${id} is still used by requests`);
    }
    await this.repo.remove(id);
    return existing;
  }
}
