import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqLlmClient } from './groq-llm.client';

describe('GroqLlmClient', () => {
  it('fails closed when GROQ_API_KEY is missing', async () => {
    const client = new GroqLlmClient({
      get: () => undefined,
    } as unknown as ConfigService);

    await expect(client.complete('sys', 'user')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
