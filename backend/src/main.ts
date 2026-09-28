import { existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }],
  });

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
      if (req.path === '/health' || req.path.startsWith('/api/')) return next();
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.sendFile(join(frontendDist, 'index.html'));
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Ops Hub backend listening on port ${port}`);
}
bootstrap();
