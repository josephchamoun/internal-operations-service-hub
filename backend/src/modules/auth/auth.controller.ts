import { Controller, Get, Post, Body, Query, Res, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  async login(@Res() res: Response) {
    const url = await this.authService.getAuthUrl();
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    return this.authService.handleCallback(code);
  }

  @Post('dev-login')
  async devLogin(@Body('userId') userId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev login is disabled in production');
    }
    return this.authService.devLogin(userId);
  }
}