import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReassignRequestDto } from './dto/reassign-request.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HubJwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('mine')
  findMine(@CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.findMine(actor);
  }

  @Get()
  findAll(@CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.findAll(actor);
  }

  @Get(':id/events')
  findEvents(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.findEvents(id, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @Get(':id/full')
  findFullDetails(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.findFullDetails(id, actor);
  }

  @Post()
  create(@Body() dto: CreateRequestDto, @CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.create(dto, actor);
  }

  @Patch(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.claim(id, actor);
  }

  @Patch(':id/unclaim')
  unclaim(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.unclaim(id, actor);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.requestsService.updateStatus(id, dto, actor);
  }

  @Patch(':id/reassign')
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignRequestDto,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.requestsService.reassign(id, dto, actor);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.cancel(id, actor);
  }

  @Get(':id/access-logs')
  findAccessLogs(@Param('id') id: string, @CurrentUser() actor: HubJwtPayload) {
    return this.requestsService.findAccessLogsForRequest(id, actor);
  }

  @Patch(':id/priority')
  updatePriority(
    @Param('id') id: string,
    @Body() dto: UpdatePriorityDto,
    @CurrentUser() actor: HubJwtPayload,
  ) {
    return this.requestsService.updatePriority(id, dto, actor);
  }
}