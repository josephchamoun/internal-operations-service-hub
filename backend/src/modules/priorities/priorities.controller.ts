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
import { PrioritiesService } from './priorities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';
import { assertAdmin } from '../auth/assert-admin';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';

@UseGuards(JwtAuthGuard)
@Controller('priorities')
export class PrioritiesController {
  constructor(private readonly prioritiesService: PrioritiesService) {}

  @Get()
  findAll() {
    return this.prioritiesService.findAll();
  }

  @Post()
  create(@CurrentUser() actor: HubJwtPayload, @Body() dto: CreatePriorityDto) {
    assertAdmin(actor);
    return this.prioritiesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prioritiesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() actor: HubJwtPayload,
    @Body() dto: UpdatePriorityDto,
  ) {
    assertAdmin(actor);
    return this.prioritiesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    assertAdmin(actor);
    return this.prioritiesService.remove(id);
  }
}
