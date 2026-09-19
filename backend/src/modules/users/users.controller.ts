import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';
import { assertAdmin } from '../auth/assert-admin';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() actor: HubJwtPayload) {
    assertAdmin(actor);
    return this.usersService.findAll();
  }

  @Post()
  create(@CurrentUser() actor: HubJwtPayload, @Body() dto: CreateUserDto) {
    assertAdmin(actor);
    return this.usersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    assertAdmin(actor);
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() actor: HubJwtPayload,
    @Body() dto: UpdateUserDto,
  ) {
    assertAdmin(actor);
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    assertAdmin(actor);
    return this.usersService.remove(id);
  }
}
