import { Injectable } from '@nestjs/common';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { CategoryEntity } from './entities/category.entity';

/*
  Admin-managed reference data, seeded as mock JSON for now.
  Read-only on purpose: this assignment only consumes categories from
  `requests`, it doesn't manage them. When the "Admin manages categories"
  assignment lands, add create()/update()/remove() here the same way
  requests.repository.ts does, the service/controller below are
  already shaped to make that a small change, not a rewrite.
 */
@Injectable()
export class CategoriesRepository {
  private readonly fileName = 'categories.json';

  constructor(private readonly storage: FileStorageService) {}

  async findAll(): Promise<CategoryEntity[]> {
    return this.storage.readAll<CategoryEntity>(this.fileName);
  }

  async findById(id: string): Promise<CategoryEntity | undefined> {
    const all = await this.findAll();
    return all.find((item) => item.id === id);
  }
}
