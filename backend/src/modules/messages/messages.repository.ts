import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessageEntity } from './message.entity';
import { AttachmentMeta } from '../attachments/attachment.entity';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByRequestId(requestId: string): Promise<MessageEntity[]> {
    const rows = await this.prisma.message.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    return rows.map((row) => ({
      id: row.messageId,
      requestId: row.requestId,
      senderId: row.senderId,
      senderName: row.sender.name,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      attachments: row.attachments.map(toAttachmentMeta),
    }));
  }

  async createWithFiles(input: {
    id: string;
    requestId: string;
    senderId: string;
    body: string;
    files: {
      fileName: string;
      contentType: string;
      sizeBytes: number;
      fileRef: Buffer;
    }[];
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          messageId: input.id,
          requestId: input.requestId,
          senderId: input.senderId,
          body: input.body,
          createdAt: new Date(),
        },
      });
      for (const file of input.files) {
        await tx.attachment.create({
          data: {
            attachmentId: uuid(),
            requestId: input.requestId,
            messageId: input.id,
            uploaderId: input.senderId,
            fileRef: new Uint8Array(file.fileRef),
            fileName: file.fileName,
            contentType: file.contentType,
            sizeBytes: file.sizeBytes,
            createdAt: new Date(),
          },
        });
      }
    });
  }
}

function toAttachmentMeta(row: {
  attachmentId: string;
  requestId: string;
  messageId: string | null;
  uploaderId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}): AttachmentMeta {
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
