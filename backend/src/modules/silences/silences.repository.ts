import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SilencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isSilenced(userId: string, requestId: string): Promise<boolean> {
    const row = await this.prisma.silence.findUnique({
      where: { userId_requestId: { userId, requestId } },
    });
    return !!row;
  }

  async listUserIds(requestId: string): Promise<string[]> {
    const rows = await this.prisma.silence.findMany({
      where: { requestId },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  async create(userId: string, requestId: string): Promise<void> {
    await this.prisma.silence.upsert({
      where: { userId_requestId: { userId, requestId } },
      create: { userId, requestId, silencedAt: new Date() },
      update: {},
    });
  }

  async remove(userId: string, requestId: string): Promise<void> {
    await this.prisma.silence.deleteMany({ where: { userId, requestId } });
  }
}
