import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  findAll(): Promise<UserEntity[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<UserEntity> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException(`User ${id} not found`);
    return found;
  }
}
