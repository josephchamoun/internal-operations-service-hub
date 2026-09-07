import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ClaimRequestDto } from './dto/claim-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ReassignRequestDto } from './dto/reassign-request.dto';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('mine')
  findMine(@Query('actorId') actorId: string) {
    return this.requestsService.findMine(actorId);
  }

  @Get()
  findAll(@Query('actorId') actorId: string) {
    return this.requestsService.findAllScoped(actorId);
  }

  @Get(':id/events')
  findEvents(@Param('id') id: string, @Query('actorId') actorId: string) {
    return this.requestsService.findEvents(id, actorId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('actorId') actorId: string) {
    return this.requestsService.findOne(id, actorId);
  }
  @Get(':id/full')
  findFullDetails(@Param('id') id: string, @Query('actorId') actorId: string) {
    return this.requestsService.findFullDetails(id, actorId);
  }

  @Post()
  create(@Body() dto: CreateRequestDto) {
    return this.requestsService.create(dto);
  }

  @Patch(':id/claim')
  claim(@Param('id') id: string, @Body() dto: ClaimRequestDto) {
    return this.requestsService.claim(id, dto);
  }

  @Patch(':id/unclaim')
  unclaim(@Param('id') id: string, @Body() dto: ClaimRequestDto) {
    return this.requestsService.unclaim(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.requestsService.updateStatus(id, dto);
  }

  @Patch(':id/reassign')
  reassign(@Param('id') id: string, @Body() dto: ReassignRequestDto) {
    return this.requestsService.reassign(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelRequestDto) {
    return this.requestsService.cancel(id, dto);
  }

  @Get(':id/access-logs')
  findAccessLogs(@Param('id') id: string, @Query('actorId') actorId: string) {
    return this.requestsService.findAccessLogsForRequest(id, actorId);
  }
}
