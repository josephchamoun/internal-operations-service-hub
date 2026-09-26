import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { healthAuthOk } from './health';

@Injectable()
export class HealthAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();
    const allowed = healthAuthOk(
      request.headers.authorization,
      this.config.get<string>('HEALTH_USER'),
      this.config.get<string>('HEALTH_PASSWORD'),
    );
    if (!allowed) throw new UnauthorizedException();
    return true;
  }
}
