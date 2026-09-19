import { ForbiddenException } from '@nestjs/common';
import { HubJwtPayload } from './auth.service';

export function assertAdmin(actor: HubJwtPayload): void {
  if (actor.role !== 'admin') {
    throw new ForbiddenException('Only an admin can manage this resource');
  }
}
