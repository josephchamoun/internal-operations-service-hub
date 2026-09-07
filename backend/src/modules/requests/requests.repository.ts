import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { RequestEntity } from './entities/request.entity';

/*
  Everything that knows the word "requests.json" lives here.
  The service layer talks to this, never to the filesystem directly.
  When a real database shows up later, this is the only class that
  needs to be swapped out (e.g. for a TypeORM/Prisma repository).
 */
@Injectable()
export class RequestsRepository {
  private readonly fileName = 'requests.json';

  constructor(private readonly storage: FileStorageService) {}

  async findAll(): Promise<RequestEntity[]> {
    return this.storage.readAll<RequestEntity>(this.fileName);
  }

  async findById(id: string): Promise<RequestEntity | undefined> {
    const all = await this.findAll();
    return all.find((r) => r.id === id);
  }

  async create(entity: RequestEntity): Promise<RequestEntity> {
    const all = await this.findAll();
    all.push(entity);
    await this.storage.writeAll(this.fileName, all);
    return entity;
  }

  async update(id: string, patch: Partial<RequestEntity>): Promise<RequestEntity | undefined> {
    const all = await this.findAll();
    const index = all.findIndex((r) => r.id === id);
    if (index === -1) return undefined;

    //start with existing fields, override with patch fields, then always refresh updatedAt (later spread/key wins)
    const updated = { ...all[index], ...patch, updatedAt: new Date().toISOString() }; 
    all[index] = updated;
    await this.storage.writeAll(this.fileName, all);
    return updated;
  }
}
