import { Injectable, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import { UsersService } from '../users/users.service';
import { TeamMembershipsService } from '../team-memberships/team-memberships.service';

const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

export interface HubJwtPayload {
  userId: string;
  role: string;
  teamIds: string[];
}

@Injectable()
export class AuthService {
  private readonly msalClient: ConfidentialClientApplication;
  private readonly redirectUri: string;

  constructor(
  private readonly configService: ConfigService,
  private readonly usersService: UsersService,
  private readonly teamMembershipsService: TeamMembershipsService,
  private readonly jwtService: JwtService,
) {
  const clientId = this.configService.get<string>('AZURE_AD_CLIENT_ID');
  const tenantId = this.configService.get<string>('AZURE_AD_TENANT_ID');
  const clientSecret = this.configService.get<string>('AZURE_AD_CLIENT_SECRET');
  const redirectUri = this.configService.get<string>('AZURE_AD_REDIRECT_URI');

  if (!clientId || !tenantId || !clientSecret || !redirectUri) {
    throw new InternalServerErrorException(
      'Missing Azure AD configuration — check AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_REDIRECT_URI in .env',
    );
  }

  this.redirectUri = redirectUri;

  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  };

  this.msalClient = new ConfidentialClientApplication(msalConfig);
}
  async getAuthUrl(): Promise<string> {
    return this.msalClient.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: this.redirectUri,
    });
  }

  async handleCallback(code: string): Promise<{ accessToken: string }> {
    const result = await this.msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: this.redirectUri,
    });

    const idTokenClaims = result.idTokenClaims as {
      oid?: string;
      preferred_username?: string;
      email?: string;
    };
    const oid = idTokenClaims.oid;
    const email = idTokenClaims.email ?? idTokenClaims.preferred_username;
    console.log('Microsoft returned email:', email, 'oid:', oid);

    if (!oid || !email) {
      throw new InternalServerErrorException(
        'Microsoft did not return the expected identity claims (oid/email)',
      );
    }

    const user = await this.resolveUser(oid, email);
    const memberships = await this.teamMembershipsService.findByUserId(user.id);
    const teamIds = memberships.map((m) => m.teamId);

    const payload: HubJwtPayload = {
      userId: user.id,
      role: user.role,
      teamIds,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  private async resolveUser(oid: string, email: string) {
    const byIdp = await this.usersService.findByIdpSubjectId(oid);
    console.log('byIdp:', byIdp);
    if (byIdp) {
        return byIdp;
    }

    const byEmail = await this.usersService.findByEmail(email);
    console.log('byEmail:', byEmail, 'searching for email:', JSON.stringify(email));
    if (byEmail && !byEmail.idpSubjectId) {
        return this.usersService.linkIdpSubjectId(byEmail.id, oid);
    }

    throw new ForbiddenException(
        'No account provisioned for this identity — contact an administrator',
    );
  }


  // This is a development-only endpoint that allows you to log in as any seeded user without going through Microsoft authentication.
  async devLogin(userId: string): Promise<{ accessToken: string }> {
    const user = await this.usersService.findOne(userId); // throws NotFoundException if not seeded
    const memberships = await this.teamMembershipsService.findByUserId(user.id);
    const teamIds = memberships.map((m) => m.teamId);

    const payload: HubJwtPayload = {
      userId: user.id,
      role: user.role,
      teamIds,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }
}