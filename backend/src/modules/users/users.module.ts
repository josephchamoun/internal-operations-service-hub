import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PeopleController } from './people.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [TeamsModule],
  controllers: [UsersController, PeopleController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
