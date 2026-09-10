import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserEntity[]> {
    const rows = await this.prisma.user.findMany();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<UserEntity | undefined> {
    const row = await this.prisma.user.findUnique({ where: { userId: id } });
    return row ? toEntity(row) : undefined;
  }
}

function toEntity(row: User): UserEntity {
  return {
    id: row.userId,
    idpSubjectId: row.idpSubjectId,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}
