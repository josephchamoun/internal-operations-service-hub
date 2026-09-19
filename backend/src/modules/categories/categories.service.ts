import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CategoriesRepository } from './categories.repository';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { TeamsService } from '../teams/teams.service';

const OTHER_CATEGORY_ID = 'other';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly repo: CategoriesRepository,
    private readonly teamsService: TeamsService,
  ) {}

  findAll(): Promise<CategoryEntity[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<CategoryEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`Category ${id} not found`);
    return found;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const id = uuid();
    const defaultTeamId = await this.requireDefaultTeam(id, dto.defaultTeamId);
    return this.repo.create({
      id,
      name: dto.name.trim(),
      defaultTeamId,
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    if (id === OTHER_CATEGORY_ID) {
      throw new ConflictException('The Other category cannot be edited');
    }
    const existing = await this.findOne(id);
    const nextTeam =
      dto.defaultTeamId === undefined ? existing.defaultTeamId : dto.defaultTeamId;
    const defaultTeamId = await this.requireDefaultTeam(id, nextTeam);
    return this.repo.update({
      id,
      name: dto.name?.trim() ?? existing.name,
      defaultTeamId,
    });
  }

  async remove(id: string): Promise<CategoryEntity> {
    if (id === OTHER_CATEGORY_ID) {
      throw new ConflictException('The Other category cannot be deleted');
    }
    const existing = await this.findOne(id);
    const usage = await this.repo.countRequests(id);
    if (usage > 0) {
      throw new ConflictException(`Category ${id} is still used by requests`);
    }
    await this.repo.remove(id);
    return existing;
  }

  private async requireDefaultTeam(
    categoryId: string,
    defaultTeamId: string | null | undefined,
  ): Promise<string | null> {
    if (categoryId === OTHER_CATEGORY_ID) {
      if (defaultTeamId) {
        throw new BadRequestException(
          'The Other category cannot have a default team',
        );
      }
      return null;
    }
    if (!defaultTeamId) {
      throw new BadRequestException(
        'Every category except Other must have a default team',
      );
    }
    await this.teamsService.findOne(defaultTeamId);
    return defaultTeamId;
  }
}
