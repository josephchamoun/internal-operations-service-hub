import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { HubJwtPayload } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): HubJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);