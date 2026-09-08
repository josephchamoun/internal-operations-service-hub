import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AccessLogsRepository } from './access-logs.repository';
import { AccessLogEntity } from './entities/access-log.entity';

@Injectable()
export class AccessLogsService {
  constructor(private readonly repo: AccessLogsRepository) {}

  findAll(): Promise<AccessLogEntity[]> {
    return this.repo.findAll();
  }

  record(userId: string, requestId: string): Promise<AccessLogEntity> {
    const entity: AccessLogEntity = {
      id: uuid(),
      userId,
      requestId,
      accessedAt: new Date().toISOString(),
    };
    return this.repo.create(entity);
  }

  findByRequestId(requestId: string): Promise<AccessLogEntity[]> {
    return this.repo.findByRequestId(requestId);
  }
}