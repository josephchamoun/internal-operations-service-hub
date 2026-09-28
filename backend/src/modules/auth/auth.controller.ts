import { Controller, Get, Post, Body, Query, Res, HttpCode, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, HubJwtPayload } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { PasswordLoginDto } from './dto/password-login.dto';
import { clearAccessCookie, setAccessCookie } from './access-cookie';

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
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
    if (!code) {
      return res.redirect(`${frontendUrl}/login`);
    }
    const { accessToken } = await this.authService.handleCallback(code);
    setAccessCookie(res, accessToken);
    return res.redirect(`${frontendUrl}/`);
  }

  @Post('password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async passwordLogin(
    @Body() dto: PasswordLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.passwordLogin(dto.email, dto.password);
    setAccessCookie(res, result.accessToken);
    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearAccessCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() actor: HubJwtPayload) {
    return this.authService.currentSession(actor);
  }
}