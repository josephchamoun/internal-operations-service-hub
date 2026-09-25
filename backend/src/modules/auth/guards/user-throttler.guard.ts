import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/*
  Counts by the signed-in user. Two tabs share one counter.
  The login guard on the controller runs first, so req.user is already set.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.userId;
    if (typeof userId === 'string' && userId.length > 0) return userId;
    return req.ip;//fallback to ip address if userId is not available 
  }
}
