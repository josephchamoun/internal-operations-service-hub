import { Global, Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';

// @Global so any feature module (requests, and later teams/messages/etc.)
// can inject FileStorageService without re-importing this module everywhere.
@Global()
@Module({
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class StorageModule {}
