import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HealthReport, releaseSha, safeFailureReason } from './health';

const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly version = releaseSha();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async report(): Promise<HealthReport> {
    const [databaseOk, aiOk] = await Promise.all([
      this.databaseAnswers(),
      this.aiAnswers(),
    ]);
    const database = databaseOk ? 'ok' : 'not-ok';
    const ai = aiOk ? 'ok' : 'not-ok';
    return {
      status: databaseOk && aiOk ? 'ok' : 'not-ok',
      version: this.version,
      checks: { database, ai },
    };
  }

  private async databaseAnswers(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(
        `Database check failed: the database could not be reached. ${safeFailureReason(error)}`,
      );
      return false;
    }
  }

  private async aiAnswers(): Promise<boolean> {
    const apiKey = this.config
      .get<string>('GROQ_API_KEY')
      ?.trim()
      .replace(/^["']|["']$/g, '');
    if (!apiKey) {
      this.logger.warn('AI check failed: GROQ_API_KEY is missing');
      return false;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(GROQ_MODELS_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        this.logger.warn(
          `AI check failed: the AI model could not be reached (HTTP ${response.status})`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `AI check failed: the AI model could not be reached. ${safeFailureReason(error)}`,
      );
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
