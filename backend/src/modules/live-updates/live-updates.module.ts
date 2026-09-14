import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LiveUpdatesService } from './live-updates.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('Missing JWT_SECRET in .env');
        }
        return { secret };
      },
    }),
  ],
  providers: [LiveUpdatesService],
  exports: [LiveUpdatesService, JwtModule],
})
export class LiveUpdatesModule {}