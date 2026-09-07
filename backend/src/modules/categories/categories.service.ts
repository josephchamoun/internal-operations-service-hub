import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';
import { CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository) {}

  findAll(): Promise<CategoryEntity[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<CategoryEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`Category ${id} not found`);
    return found;
  }
}
