import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { HubJwtPayload } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { TeamMembershipsService } from '../../team-memberships/team-memberships.service';
import { accessTokenFromCookie } from '../access-cookie';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly teamMembershipsService: TeamMembershipsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => accessTokenFromCookie(req),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: HubJwtPayload): Promise<HubJwtPayload> {
    if (!payload?.userId) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findById(payload.userId);
    if (!user || !user.active) {
      throw new UnauthorizedException();
    }
    const memberships = await this.teamMembershipsService.listByUserId(user.id);
    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamIds: memberships.map((item) => item.teamId),
    };
  }
}