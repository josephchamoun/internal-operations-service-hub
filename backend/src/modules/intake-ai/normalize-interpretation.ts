import {
  Confidence,
  IntakeCatalog,
  IntakeSuggestion,
  RawModelSuggestion,
} from './intake-ai.types';

const CONFIDENCES: Confidence[] = ['high', 'medium', 'low'];
const OTHER_CATEGORY_ID = 'other';
const DEFAULT_PRIORITY_ID = 'Normal';

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

export function defaultNextStep(
  categoryId: string,
  teamId: string | null,
  needsClarification: boolean,
): string {
  if (needsClarification) {
    return 'Add a bit more detail below, then submit so this can land with the right team instead of guessing.';
  }
  switch (categoryId) {
    case 'laptop-issue':
      return 'Submit this as a Laptop Issue. It will land unclaimed in IT\'s queue; a team member will claim it.';
    case 'software-issue':
      return 'Submit this as a Software Issue to IT. Mention the app name and any error text if you have it.';
    case 'account-access':
      return 'Submit this as an Account / Access Request to IT. Do not put passwords in the description.';
    case 'hr-approval':
      return 'Submit this as an HR Approval request. It will land unclaimed in HR’s queue.';
    case 'policy-question':
      return 'Submit this as a Policy Question. HR will see it in their queue.';
    case 'other':
      return teamId
        ? `No listed category fitted, so this would go to ${teamId} as Other. Confirm the team before submitting.`
        : 'No listed category fitted. Pick the owning team (IT or HR) before submitting.';
    default:
      return 'Submit this request so it is tracked in the hub rather than following up in chat.';
  }
}

export function defaultSelfServeHint(categoryId: string): string | null {
  if (categoryId === 'laptop-issue') {
    return 'If it will not power on, check the charger is seated and try a different outlet first.';
  }
  if (categoryId === 'software-issue') {
    return 'If the app is frozen, save your work if you can and restart that application once before submitting.';
  }
  return null;
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
  if (!categoryIds.has(categoryId)) categoryId = OTHER_CATEGORY_ID;

  const category = catalog.categories.find((item) => item.id === categoryId);
  let suggestedOwningTeamId = category?.defaultTeamId ?? null;
  if (!suggestedOwningTeamId) {
    const modelTeam = asString(raw.suggestedOwningTeamId);
    suggestedOwningTeamId = teamIds.has(modelTeam) ? modelTeam : null;
  }

  let priorityId = asString(raw.priorityId);
  if (!priorityIds.has(priorityId)) {
    priorityId = priorityIds.has(DEFAULT_PRIORITY_ID)
      ? DEFAULT_PRIORITY_ID
      : catalog.priorities[0]?.id ?? DEFAULT_PRIORITY_ID;
  }

  const thin = isThinDraft(draft);
  const unknownCategory = categoryId === OTHER_CATEGORY_ID && !category?.defaultTeamId;
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
    modelStep || defaultNextStep(categoryId, suggestedOwningTeamId, needsClarification);

  const modelHint = clip(asString(raw.selfServeHint), 240);
  const selfServeHint = modelHint || defaultSelfServeHint(categoryId);

  let clarificationQuestion = clip(asString(raw.clarificationQuestion), 240) || null;
  if (needsClarification && !clarificationQuestion) {
    clarificationQuestion = thin
      ? 'What exactly is going wrong, and which device or system is it?'
      : 'Which team should own this if it is not a listed IT or HR category?';
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
