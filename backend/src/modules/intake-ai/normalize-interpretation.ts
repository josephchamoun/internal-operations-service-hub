import {
  Confidence,
  IntakeCatalog,
  IntakeSuggestion,
  RawModelSuggestion,
} from './intake-ai.types';

const CONFIDENCES: Confidence[] = ['high', 'medium', 'low'];

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isThinDraft(draft: string): boolean {
  return wordCount(draft) < 4;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max).trim();
}

function compactSummary(draft: string, modelSummary: string): string {
  const cleanedDraft = draft.replace(/\s+/g, ' ').trim();
  let summary = clip(modelSummary, 80);
  const draftNorm = cleanedDraft.toLowerCase();
  const summaryNorm = summary.toLowerCase();
  const copied =
    !summary ||
    summaryNorm === draftNorm ||
    (draftNorm.startsWith(summaryNorm) &&
      summary.length >= Math.min(60, cleanedDraft.length));

  if (copied && cleanedDraft.length > 80) {
    const sentence = cleanedDraft.split(/[.!?]/)[0]?.trim() ?? cleanedDraft;
    summary = clip(sentence, 80);
  }
  return summary || clip(cleanedDraft, 80) || 'Untitled request';
}

function requestTypeForTeam(teamId: string | null): string {
  return teamId ?? 'unknown';
}

function teamName(catalog: IntakeCatalog, teamId: string | null): string | null {
  if (!teamId) return null;
  return catalog.teams.find((item) => item.id === teamId)?.name ?? teamId;
}

function listedTeamNames(catalog: IntakeCatalog): string {
  const names = catalog.teams.map((item) => item.name).filter(Boolean);
  if (names.length === 0) return 'a listed team';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

export function fallbackCategoryId(catalog: IntakeCatalog): string {
  const catchAll = catalog.categories.find((item) => item.defaultTeamId == null);
  return catchAll?.id ?? catalog.categories[0]?.id ?? '';
}

export function defaultNextStep(
  catalog: IntakeCatalog,
  categoryId: string,
  teamId: string | null,
  needsClarification: boolean,
): string {
  if (needsClarification) {
    return 'Add a bit more detail below, then submit so this can land with the right team instead of guessing.';
  }
  const category = catalog.categories.find((item) => item.id === categoryId);
  const categoryName = category?.name || 'this category';
  const owningTeam = teamName(catalog, teamId);

  if (!category?.defaultTeamId) {
    return owningTeam
      ? `No listed category fitted, so this would go to ${owningTeam} as ${categoryName}. Confirm the team before submitting.`
      : `No listed category fitted. Pick the owning team (${listedTeamNames(catalog)}) before submitting.`;
  }
  if (owningTeam) {
    return `Submit this as ${categoryName}. It will land unclaimed in ${owningTeam}'s queue; a team member will claim it.`;
  }
  return `Submit this as ${categoryName} so it is tracked in the hub rather than following up in chat.`;
}

export function normalizeInterpretation(
  draft: string,
  raw: RawModelSuggestion,
  catalog: IntakeCatalog,
): IntakeSuggestion {
  const categoryIds = new Set(catalog.categories.map((item) => item.id));
  const teamIds = new Set(catalog.teams.map((item) => item.id));
  const priorityIds = new Set(catalog.priorities.map((item) => item.id));

  let categoryId = asString(raw.categoryId);
  if (!categoryIds.has(categoryId)) categoryId = fallbackCategoryId(catalog);

  const category = catalog.categories.find((item) => item.id === categoryId);
  let suggestedOwningTeamId = category?.defaultTeamId ?? null;
  if (!suggestedOwningTeamId) {
    const modelTeam = asString(raw.suggestedOwningTeamId);
    suggestedOwningTeamId = teamIds.has(modelTeam) ? modelTeam : null;
  }

  let priorityId = asString(raw.priorityId);
  if (!priorityIds.has(priorityId)) {
    priorityId = catalog.priorities[0]?.id ?? '';
  }

  const thin = isThinDraft(draft);
  const unknownCategory = category != null && category.defaultTeamId == null;
  let needsClarification =
    raw.needsClarification === true || thin || (unknownCategory && !suggestedOwningTeamId);

  let confidence: Confidence = CONFIDENCES.includes(raw.confidence as Confidence)
    ? (raw.confidence as Confidence)
    : 'medium';
  if (needsClarification && confidence === 'high') confidence = 'medium';
  if (thin) {
    needsClarification = true;
    confidence = 'low';
  }

  const summary = compactSummary(draft, asString(raw.summary));

  const modelStep = clip(asString(raw.suggestedNextStep), 400);
  const suggestedNextStep =
    modelStep || defaultNextStep(catalog, categoryId, suggestedOwningTeamId, needsClarification);

  const modelHint = clip(asString(raw.selfServeHint), 240);
  const selfServeHint = modelHint || null;

  let clarificationQuestion = clip(asString(raw.clarificationQuestion), 240) || null;
  if (needsClarification && !clarificationQuestion) {
    clarificationQuestion = thin
      ? 'What exactly is going wrong, and which device or system is it?'
      : `Which team should own this if it is not a listed category? Options: ${listedTeamNames(catalog)}.`;
  }
  if (!needsClarification) clarificationQuestion = null;

  return {
    summary,
    categoryId,
    requestType: requestTypeForTeam(suggestedOwningTeamId),
    priorityId,
    suggestedOwningTeamId,
    suggestedNextStep,
    selfServeHint,
    needsClarification,
    clarificationQuestion,
    confidence,
  };
}
