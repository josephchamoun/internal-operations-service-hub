import { Controller, Get, Param } from '@nestjs/common';
import { PrioritiesService } from './priorities.service';

@Controller('priorities')
export class PrioritiesController {
  constructor(private readonly prioritiesService: PrioritiesService) {}

  // GET /priorities
  @Get()
  findAll() {
    return this.prioritiesService.findAll();
  }

  // GET /priorities/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prioritiesService.findOne(id);
  }
}
