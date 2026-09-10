import { Injectable } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoryEntity[]> {
    const rows = await this.prisma.category.findMany();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<CategoryEntity | undefined> {
    const row = await this.prisma.category.findUnique({ where: { categoryId: id } });
    return row ? toEntity(row) : undefined;
  }
}

function toEntity(row: Category): CategoryEntity {
  return {
    id: row.categoryId,
    name: row.name,
    defaultTeamId: row.defaultTeamId,
    createdAt: row.createdAt.toISOString(),
  };
}
