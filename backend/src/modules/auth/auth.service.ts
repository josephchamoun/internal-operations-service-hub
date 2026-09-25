import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import { UsersService } from '../users/users.service';
import { TeamMembershipsService } from '../team-memberships/team-memberships.service';

const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

export interface HubJwtPayload {
  userId: string;
  name?: string;
  role: string;
  teamIds: string[];
}

@Injectable()
export class AuthService {
  private readonly msalClient: ConfidentialClientApplication | null;
  private readonly redirectUri: string | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly teamMembershipsService: TeamMembershipsService,
    private readonly jwtService: JwtService,
  ) {
    const clientId = this.configService.get<string>('AZURE_AD_CLIENT_ID')?.trim();
    const tenantId = this.configService.get<string>('AZURE_AD_TENANT_ID')?.trim();
    const clientSecret = this.configService.get<string>('AZURE_AD_CLIENT_SECRET')?.trim();
    const redirectUri = this.configService.get<string>('AZURE_AD_REDIRECT_URI')?.trim();

    // Entra ID is optional. Testers can boot the app with only JWT + DATABASE_URL
    // and use POST /auth/dev-login. Real Microsoft login is wired only when all
    // four AZURE_AD_* values are present.
    if (!clientId || !tenantId || !clientSecret || !redirectUri) {
      this.msalClient = null;
      this.redirectUri = null;
      return;
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

  isMicrosoftLoginConfigured(): boolean {
    return this.msalClient !== null && this.redirectUri !== null;
  }

  async getAuthUrl(): Promise<string> {
    const { msalClient, redirectUri } = this.requireEntra();
    return msalClient.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri,
    });
  }

  async handleCallback(code: string): Promise<{ accessToken: string }> {
    const { msalClient, redirectUri } = this.requireEntra();
    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri,
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
      name: user.name,
      role: user.role,
      teamIds,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  private requireEntra(): {
    msalClient: ConfidentialClientApplication;
    redirectUri: string;
  } {
    if (!this.msalClient || !this.redirectUri) {
      throw new ServiceUnavailableException(
        'Microsoft login is not configured. Use the test identity picker, or set AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_REDIRECT_URI in .env.',
      );
    }
    return { msalClient: this.msalClient, redirectUri: this.redirectUri };
  }

  private assertActive(user: { active: boolean }): void {
    if (!user.active) {
      throw new ForbiddenException(
        'This account is inactive. Contact an administrator.',
      );
    }
  }

  private async resolveUser(oid: string, email: string) {
    const byIdp = await this.usersService.findByIdpSubjectId(oid);
    console.log('byIdp:', byIdp);
    if (byIdp) {
        this.assertActive(byIdp);
        return byIdp;
    }

    const byEmail = await this.usersService.findByEmail(email);
    console.log('byEmail:', byEmail, 'searching for email:', JSON.stringify(email));
    if (byEmail && !byEmail.idpSubjectId) {
        this.assertActive(byEmail);
        return this.usersService.linkIdpSubjectId(byEmail.id, oid);
    }

    throw new ForbiddenException(
        'No account provisioned for this identity — contact an administrator',
    );
  }


  // This is a development-only endpoint that allows you to log in as any seeded user without going through Microsoft authentication.
  async devLogin(userId: string): Promise<{ accessToken: string }> {
    const user = await this.usersService.findOne(userId); // throws NotFoundException if not seeded
    this.assertActive(user);
    const memberships = await this.teamMembershipsService.findByUserId(user.id);
    const teamIds = memberships.map((m) => m.teamId);

    const payload: HubJwtPayload = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamIds,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  async currentSession(actor: HubJwtPayload) {
    const user = await this.usersService.findOne(actor.userId);
    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamIds: actor.teamIds,
    };
  }
}