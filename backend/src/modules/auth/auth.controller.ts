import { Controller, Get, Post, Body, Query, Res, ForbiddenException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, HubJwtPayload } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  @Get('login')
  async login(@Res() res: Response) {
    if (!this.authService.isMicrosoftLoginConfigured()) {
      const frontendUrl = (
        this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
      ).replace(/\/$/, '');
      return res.redirect(`${frontendUrl}/login?microsoft=unavailable`);
    }
    const url = await this.authService.getAuthUrl();
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    const { accessToken } = await this.authService.handleCallback(code);
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
    // Real Microsoft login hands the token to the frontend via a redirect,
    // since the browser is the one that needs to end up holding it.
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`,
    );
  }

  // ── TEST-ONLY LOGIN — safe to delete this whole method before any real
  // deployment. Real auth is GET /auth/login + GET /auth/callback above,
  // fully functional against Microsoft Entra ID. This endpoint exists only
  // so the app, its authorization rules, and the automated test suite can
  // be exercised without needing a real Entra ID tenant/credentials.
  // Already gated off in production via the NODE_ENV check below.
  @Post('dev-login')
  async devLogin(@Body('userId') userId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev login is disabled in production');
    }
    return this.authService.devLogin(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() actor: HubJwtPayload) {
    return actor;
  }
}