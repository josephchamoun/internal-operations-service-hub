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

  async findByIdpSubjectId(idpSubjectId: string): Promise<UserEntity | undefined> {
    const row = await this.prisma.user.findUnique({ where: { idpSubjectId } });
    return row ? toEntity(row) : undefined;
  }

  async findByEmail(email: string): Promise<UserEntity | undefined> {
    const row = await this.prisma.user.findFirst({ where: { email } });
    return row ? toEntity(row) : undefined;
  }

  async linkIdpSubjectId(id: string, idpSubjectId: string): Promise<UserEntity> {
    const row = await this.prisma.user.update({
      where: { userId: id },
      data: { idpSubjectId },
    });
    return toEntity(row);
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