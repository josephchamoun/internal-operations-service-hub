import { Controller, Get, Query, Res } from '@nestjs/common';
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
}