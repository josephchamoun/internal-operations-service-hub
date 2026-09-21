import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AccessLogsRepository } from './access-logs.repository';
import { AccessLogEntity } from './entities/access-log.entity';

export const ACCESS_LOG_DEBOUNCE_MS = 60 * 60 * 1000;

@Injectable()
export class AccessLogsService {
  constructor(private readonly repo: AccessLogsRepository) {}

  findAll(): Promise<AccessLogEntity[]> {
    return this.repo.findAll();
  }

  async record(
    userId: string,
    requestId: string,
    now = new Date(),
  ): Promise<AccessLogEntity> {
    const latest = await this.repo.findLatestForUserRequest(userId, requestId);
    if (
      latest &&
      now.getTime() - new Date(latest.accessedAt).getTime() < ACCESS_LOG_DEBOUNCE_MS
    ) {
      return latest;
    }
    const entity: AccessLogEntity = {
      id: uuid(),
      userId,
      requestId,
      accessedAt: now.toISOString(),
    };
    return this.repo.create(entity);
  }

  findLatestForUserRequest(
    userId: string,
    requestId: string,
  ): Promise<AccessLogEntity | undefined> {
    return this.repo.findLatestForUserRequest(userId, requestId);
  }

  findByRequestId(requestId: string): Promise<AccessLogEntity[]> {
    return this.repo.findByRequestId(requestId);
  }
}
