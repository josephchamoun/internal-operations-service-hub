import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { PrioritiesModule } from '../priorities/priorities.module';
import { TeamsModule } from '../teams/teams.module';
import { GroqLlmClient } from './groq-llm.client';
import { IntakeAiService } from './intake-ai.service';
import { LLM_CLIENT } from './intake-ai.types';

@Module({
  imports: [CategoriesModule, TeamsModule, PrioritiesModule],
  providers: [
    IntakeAiService,
    GroqLlmClient,
    { provide: LLM_CLIENT, useExisting: GroqLlmClient },
  ],
  exports: [IntakeAiService, LLM_CLIENT],
})
export class IntakeAiModule {}
