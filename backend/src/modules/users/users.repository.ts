import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserEntity } from './entities/user.entity';

type UserRow = User & { memberships?: { teamId: string }[] };

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserEntity[]> {
    const rows = await this.prisma.user.findMany({
      include: { memberships: true },
    });
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<UserEntity | undefined> {
    const row = await this.prisma.user.findUnique({
      where: { userId: id },
      include: { memberships: true },
    });
    return row ? toEntity(row) : undefined;
  }

  async findByIdpSubjectId(idpSubjectId: string): Promise<UserEntity | undefined> {
    const row = await this.prisma.user.findUnique({
      where: { idpSubjectId },
      include: { memberships: true },
    });
    return row ? toEntity(row) : undefined;
  }

  async findByEmail(email: string): Promise<UserEntity | undefined> {
    const rows = await this.prisma.user.findMany({ include: { memberships: true } });
    const needle = email.trim().toLowerCase();
    const row = rows.find((item) => item.email.toLowerCase() === needle);
    return row ? toEntity(row) : undefined;
  }

  async countByRole(role: UserRole): Promise<number> {
    return this.prisma.user.count({ where: { role } });
  }

  async countReferences(userId: string): Promise<number> {
    const [requested, claimed, messages, attachments, events, silences, accessLogs] =
      await Promise.all([
        this.prisma.request.count({ where: { requesterId: userId } }),
        this.prisma.request.count({ where: { claimedBy: userId } }),
        this.prisma.message.count({ where: { senderId: userId } }),
        this.prisma.attachment.count({ where: { uploaderId: userId } }),
        this.prisma.requestEvent.count({ where: { actorId: userId } }),
        this.prisma.silence.count({ where: { userId } }),
        this.prisma.accessLog.count({ where: { userId } }),
      ]);
    return requested + claimed + messages + attachments + events + silences + accessLogs;
  }

  async create(input: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    teamIds: string[];
  }): Promise<UserEntity> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          userId: input.id,
          name: input.name,
          email: input.email,
          role: input.role,
          createdAt: new Date(),
        },
      });
      if (input.teamIds.length > 0) {
        await tx.teamMembership.createMany({
          data: input.teamIds.map((teamId) => ({
            userId: input.id,
            teamId,
            createdAt: new Date(),
          })),
        });
      }
      return tx.user.findUniqueOrThrow({
        where: { userId: input.id },
        include: { memberships: true },
      });
    });
    return toEntity(row);
  }

  async update(input: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    teamIds: string[];
  }): Promise<UserEntity> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { userId: input.id },
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
        },
      });
      await tx.teamMembership.deleteMany({ where: { userId: input.id } });
      if (input.teamIds.length > 0) {
        await tx.teamMembership.createMany({
          data: input.teamIds.map((teamId) => ({
            userId: input.id,
            teamId,
            createdAt: new Date(),
          })),
        });
      }
      return tx.user.findUniqueOrThrow({
        where: { userId: input.id },
        include: { memberships: true },
      });
    });
    return toEntity(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMembership.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { userId: id } });
    });
  }

  async linkIdpSubjectId(id: string, idpSubjectId: string): Promise<UserEntity> {
    const row = await this.prisma.user.update({
      where: { userId: id },
      data: { idpSubjectId },
      include: { memberships: true },
    });
    return toEntity(row);
  }
}

function toEntity(row: UserRow): UserEntity {
  return {
    id: row.userId,
    idpSubjectId: row.idpSubjectId,
    name: row.name,
    email: row.email,
    role: row.role,
    teamIds: (row.memberships ?? []).map((item) => item.teamId),
    createdAt: row.createdAt.toISOString(),
  };
}
