import { AttachmentMeta } from '../attachments/attachment.entity';

export class MessageEntity {
  id!: string;
  requestId!: string;
  senderId!: string;
  senderName!: string;
  body!: string;
  createdAt!: string;
  attachments!: AttachmentMeta[];
}
