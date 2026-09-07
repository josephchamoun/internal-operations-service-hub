import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { TeamEntity } from './entities/team.entity';

/**
  Admin-managed reference data, seeded as mock JSON for now.
  Read-only on purpose: this assignment only consumes teams from
  `requests`, it doesn't manage them. When the "Admin manages teams"
  assignment lands, add create()/update()/remove() here the same way
  requests.repository.ts does, the service/controller below are
  already shaped to make that a small change, not a rewrite.
 */
@Injectable()
export class TeamsRepository {
  private readonly fileName = 'teams.json';

  constructor(private readonly storage: FileStorageService) {}

  async findAll(): Promise<TeamEntity[]> {
    return this.storage.readAll<TeamEntity>(this.fileName);
  }

  async findById(id: string): Promise<TeamEntity | undefined> {
    const all = await this.findAll();
    return all.find((item) => item.id === id);
  }
}
