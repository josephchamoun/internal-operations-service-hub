import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { RequestEventEntity } from './entities/request-event.entity';

@Injectable()
export class RequestEventsRepository {
  private readonly fileName = 'request-events.json';

  constructor(private readonly storage: FileStorageService) {}

  async findAll(): Promise<RequestEventEntity[]> {
    return this.storage.readAll<RequestEventEntity>(this.fileName);
  }

  async findByRequestId(requestId: string): Promise<RequestEventEntity[]> {
    const all = await this.findAll();
    return all
      .filter((event) => event.requestId === requestId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(entity: RequestEventEntity): Promise<RequestEventEntity> {
    const all = await this.findAll();
    all.push(entity);
    await this.storage.writeAll(this.fileName, all);
    return entity;
  }
}
