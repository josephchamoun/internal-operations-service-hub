import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { PriorityEntity } from './entities/priority.entity';

/*
  Admin-managed reference data, seeded as mock JSON for now.
  Read-only on purpose: this assignment only consumes priorities from
  `requests`, it doesn't manage them. When the "Admin manages priorities"
  assignment lands, add create()/update()/remove() here the same way
  requests.repository.ts does, the service/controller below are
  already shaped to make that a small change, not a rewrite.
 */
@Injectable()
export class PrioritiesRepository {
  private readonly fileName = 'priorities.json';

  constructor(private readonly storage: FileStorageService) {}

  async findAll(): Promise<PriorityEntity[]> {
    return this.storage.readAll<PriorityEntity>(this.fileName);
  }

  async findById(id: string): Promise<PriorityEntity | undefined> {
    const all = await this.findAll();
    return all.find((item) => item.id === id);
  }
}
