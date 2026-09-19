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

  async countRequests(id: string): Promise<number> {
    return this.prisma.request.count({ where: { categoryId: id } });
  }

  async create(input: {
    id: string;
    name: string;
    defaultTeamId: string | null;
  }): Promise<CategoryEntity> {
    const row = await this.prisma.category.create({
      data: {
        categoryId: input.id,
        name: input.name,
        defaultTeamId: input.defaultTeamId,
        createdAt: new Date(),
      },
    });
    return toEntity(row);
  }

  async update(input: {
    id: string;
    name: string;
    defaultTeamId: string | null;
  }): Promise<CategoryEntity> {
    const row = await this.prisma.category.update({
      where: { categoryId: input.id },
      data: {
        name: input.name,
        defaultTeamId: input.defaultTeamId,
      },
    });
    return toEntity(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { categoryId: id } });
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
