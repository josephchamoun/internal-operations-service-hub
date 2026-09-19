import { Injectable } from '@nestjs/common';
import { Attachment } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AttachmentMeta, AttachmentRecord } from './attachment.entity';

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByRequestId(requestId: string): Promise<AttachmentMeta[]> {
    const rows = await this.prisma.attachment.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMeta);
  }

  async findByMessageId(messageId: string): Promise<AttachmentMeta[]> {
    const rows = await this.prisma.attachment.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMeta);
  }

  async findById(id: string): Promise<AttachmentRecord | undefined> {
    const row = await this.prisma.attachment.findUnique({
      where: { attachmentId: id },
    });
    return row ? toRecord(row) : undefined;
  }

  async create(input: {
    id: string;
    requestId: string;
    messageId: string | null;
    uploaderId: string;
    fileRef: Buffer;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AttachmentMeta> {
    const row = await this.prisma.attachment.create({
      data: {
        attachmentId: input.id,
        requestId: input.requestId,
        messageId: input.messageId,
        uploaderId: input.uploaderId,
        fileRef: new Uint8Array(input.fileRef),
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        createdAt: new Date(),
      },
    });
    return toMeta(row);
  }

  async replaceFile(
    id: string,
    fileRef: Buffer,
    fileName: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<AttachmentMeta> {
    const row = await this.prisma.attachment.update({
      where: { attachmentId: id },
      data: {
        fileRef: new Uint8Array(fileRef),
        fileName,
        contentType,
        sizeBytes,
      },
    });
    return toMeta(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.attachment.delete({ where: { attachmentId: id } });
  }
}

function toMeta(row: Attachment): AttachmentMeta {
  return {
    id: row.attachmentId,
    requestId: row.requestId,
    messageId: row.messageId,
    uploaderId: row.uploaderId,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRecord(row: Attachment): AttachmentRecord {
  return {
    ...toMeta(row),
    fileRef: Buffer.from(row.fileRef),
  };
}
