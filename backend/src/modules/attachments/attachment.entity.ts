export class AttachmentMeta {
  id!: string;
  requestId!: string;
  messageId!: string | null;
  uploaderId!: string;
  fileName!: string;
  contentType!: string;
  sizeBytes!: number;
  createdAt!: string;
}

export class AttachmentRecord extends AttachmentMeta {
  fileRef!: Buffer;
}
