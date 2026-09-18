import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { PrioritiesService } from '../priorities/priorities.service';
import { TeamsService } from '../teams/teams.service';
import { buildSystemPrompt, buildUserPrompt } from './build-prompts';
import { LLM_CLIENT, LlmClient, RawModelSuggestion } from './intake-ai.types';
import { normalizeInterpretation } from './normalize-interpretation';

@Injectable()
export class IntakeAiService {
  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly categoriesService: CategoriesService,
    private readonly teamsService: TeamsService,
    private readonly prioritiesService: PrioritiesService,
  ) {}

  async interpret(draft: string) {
    const catalog = {
      categories: await this.categoriesService.findAll(),
      teams: await this.teamsService.findAll(),
      priorities: await this.prioritiesService.findAll(),
    };
    let rawText: string;
    try {
      rawText = await this.llm.complete(
        buildSystemPrompt(catalog),
        buildUserPrompt(draft),
      );
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'The AI provider is unavailable. Fill the form without a suggestion, or try again.',
      );
    }
    let parsed: RawModelSuggestion;
    try {
      parsed = JSON.parse(rawText) as RawModelSuggestion;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
    } catch {
      throw new BadGatewayException(
        'The AI returned a suggestion the hub could not read. Fill the form without it, or try again.',
      );
    }
    return normalizeInterpretation(draft, parsed, catalog);
  }
}
