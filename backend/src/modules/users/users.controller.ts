import { Controller, Get, Param, ForbiddenException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() actor: HubJwtPayload) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view the user list');
    }
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only an admin can view another user\'s details');
    }
    return this.usersService.findOne(id);
  }
}