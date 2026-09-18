export type Confidence = 'high' | 'medium' | 'low';

export type CatalogCategory = {
  id: string;
  name: string;
  defaultTeamId: string | null;
};

export type CatalogTeam = { id: string; name: string };
export type CatalogPriority = { id: string; name: string };

export type IntakeCatalog = {
  categories: CatalogCategory[];
  teams: CatalogTeam[];
  priorities: CatalogPriority[];
};

export type IntakeSuggestion = {
  summary: string;
  categoryId: string;
  requestType: string;
  priorityId: string;
  suggestedOwningTeamId: string | null;
  suggestedNextStep: string;
  selfServeHint: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  confidence: Confidence;
};

export type RawModelSuggestion = {
  summary?: unknown;
  categoryId?: unknown;
  priorityId?: unknown;
  suggestedOwningTeamId?: unknown;
  suggestedNextStep?: unknown;
  selfServeHint?: unknown;
  needsClarification?: unknown;
  clarificationQuestion?: unknown;
  confidence?: unknown;
};

export const LLM_CLIENT = 'LLM_CLIENT';

export interface LlmClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
