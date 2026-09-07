import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { UserEntity } from './entities/user.entity';

/*
  Admin-managed reference data, seeded as mock JSON for now.
  Read-only on purpose: this assignment only consumes users from
  `requests`, it doesn't manage them. When the "Admin manages users"
  assignment lands, add create()/update()/remove() here the same way
  requests.repository.ts does, the service/controller below are
  already shaped to make that a small change, not a rewrite.
 */
@Injectable()
export class UsersRepository {
  private readonly fileName = 'users.json';

  constructor(private readonly storage: FileStorageService) {}

  async findAll(): Promise<UserEntity[]> {
    return this.storage.readAll<UserEntity>(this.fileName);
  }

  async findById(id: string): Promise<UserEntity | undefined> {
    const all = await this.findAll();
    return all.find((item) => item.id === id);
  }
}
