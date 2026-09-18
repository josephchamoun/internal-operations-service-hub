import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmClient } from './intake-ai.types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const RETIRED_MODELS: Record<string, string> = {
  'llama-3.1-8b-instant': DEFAULT_MODEL,
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
};

@Injectable()
export class GroqLlmClient implements LlmClient {
  constructor(private readonly config: ConfigService) {}

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.config.get<string>('GROQ_API_KEY')?.trim().replace(/^["']|["']$/g, '');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI intake is not configured. Set GROQ_API_KEY, or fill the form without a suggestion.',
      );
    }

    const requested =
      this.config.get<string>('GROQ_MODEL')?.trim() || DEFAULT_MODEL;
    const model = RETIRED_MODELS[requested] ?? requested;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        const decommissioned = /decommission|deprecated|model_not_found|does not exist/i.test(
          detail,
        );
        throw new ServiceUnavailableException(
          decommissioned
            ? `Groq no longer serves "${model}" on the free tier. Set GROQ_MODEL=openai/gpt-oss-20b in backend/.env and restart.`
            : `The AI provider rejected the request (${response.status}). Fill the form without a suggestion, or try again.`,
        );
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        throw new ServiceUnavailableException(
          'The AI provider returned an empty suggestion. Fill the form without a suggestion.',
        );
      }
      return content;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'The AI provider is unavailable. Fill the form without a suggestion, or try again.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
