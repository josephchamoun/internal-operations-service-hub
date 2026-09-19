import { BadRequestException } from '@nestjs/common';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export type StoredUpload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export function assertAllowedFile(file: StoredUpload): void {
  if (file.size <= 0) {
    throw new BadRequestException('File is empty');
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestException('Each file must be 5MB or smaller');
  }
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new BadRequestException(
      'Allowed types: images, PDF, Word, or plain text',
    );
  }
}

export function assertAllowedFiles(files: StoredUpload[]): void {
  for (const file of files) {
    assertAllowedFile(file);
  }
}
