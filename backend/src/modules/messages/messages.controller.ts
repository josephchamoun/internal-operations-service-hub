import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';
import { MAX_ATTACHMENT_BYTES, StoredUpload } from '../attachments/file-rules';

@UseGuards(JwtAuthGuard)
@Controller('requests/:requestId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.messagesService.list(requestId, actor);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
    }),
  )
  create(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: HubJwtPayload,
    @Body('body') body: string,
    @UploadedFiles() files: StoredUpload[] = [],
  ) {
    return this.messagesService.create(
      requestId,
      actor,
      body ?? '',
      files ?? [],
    );
  }
}
