import { existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

config();

const API_PREFIXES = [
  '/auth',
  '/requests',
  '/access-logs',
  '/request-events',
  '/health',
  '/categories',
  '/priorities',
  '/analytics',
  '/people',
  '/team-memberships',
  '/teams',
  '/users',
];

function isApiPath(path: string): boolean {
  return API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Strips unknown fields and validates every incoming DTO automatically.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(
    /\/$/,
    '',
  );
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(join(frontendDist, 'index.html'))) {
    app.useStaticAssets(frontendDist, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (isApiPath(req.path)) return next();
      res.sendFile(join(frontendDist, 'index.html'));
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Ops Hub backend listening on port ${port}`);
}
bootstrap();
