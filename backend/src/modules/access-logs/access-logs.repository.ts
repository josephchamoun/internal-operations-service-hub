import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { AccessLogEntity } from './entities/access-log.entity';

@Injectable()
export class AccessLogsRepository {
  private readonly fileName = 'access-logs.json';

  constructor(private readonly storage: FileStorageService) {}

  async findAll(): Promise<AccessLogEntity[]> {
    const all = await this.storage.readAll<AccessLogEntity>(this.fileName);
    return all.sort((a, b) => a.accessedAt.localeCompare(b.accessedAt));
  }

  async create(entity: AccessLogEntity): Promise<AccessLogEntity> {
    const all = await this.storage.readAll<AccessLogEntity>(this.fileName);
    all.push(entity);
    await this.storage.writeAll(this.fileName, all);
    return entity;
  }
  
  async findByRequestId(requestId: string): Promise<AccessLogEntity[]> {
  const all = await this.findAll();
  return all.filter((e) => e.requestId === requestId);
}
}
