import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';
import { MAX_ATTACHMENT_BYTES, StoredUpload } from './file-rules';

const upload = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES },
};

@UseGuards(JwtAuthGuard)
@Controller('requests/:requestId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  list(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.attachmentsService.listForRequest(requestId, actor);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, upload))
  addToRequest(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: HubJwtPayload,
    @UploadedFiles() files: StoredUpload[] = [],
  ) {
    return this.attachmentsService.addToRequest(requestId, actor, files ?? []);
  }

  @Get(':attachmentId')
  async download(
    @Param('requestId') requestId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() actor: HubJwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.attachmentsService.download(
      requestId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    });
    return result.file;
  }

  @Patch(':attachmentId')
  @UseInterceptors(FileInterceptor('file', upload))
  replace(
    @Param('requestId') requestId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() actor: HubJwtPayload,
    @UploadedFile() file: StoredUpload,
  ) {
    return this.attachmentsService.replace(requestId, attachmentId, actor, file);
  }

  @Delete(':attachmentId')
  remove(
    @Param('requestId') requestId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.attachmentsService.remove(requestId, attachmentId, actor);
  }
}
