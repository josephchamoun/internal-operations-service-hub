import { IntakeCatalog } from './intake-ai.types';

function catchAllCategoryIds(catalog: IntakeCatalog): string[] {
  return catalog.categories
    .filter((item) => item.defaultTeamId == null)
    .map((item) => item.id);
}

export function buildSystemPrompt(catalog: IntakeCatalog): string {
  const categories = catalog.categories
    .map((item) => `- ${item.id}: ${item.name} (default team: ${item.defaultTeamId ?? 'none — catch-all'})`)
    .join('\n');
  const teams = catalog.teams.map((item) => `- ${item.id}: ${item.name}`).join('\n');
  const priorities = catalog.priorities.map((item) => `- ${item.id}: ${item.name}`).join('\n');
  const catchAllIds = catchAllCategoryIds(catalog);
  const catchAllRule =
    catchAllIds.length > 0
      ? `If none of the named categories fit, use one of these catch-all ids (${catchAllIds.join(', ')}) and set suggestedOwningTeamId to a listed team if you can tell, otherwise null and needsClarification true.`
      : 'If none of the named categories fit, pick the closest listed category, set needsClarification true, and set suggestedOwningTeamId to a listed team if you can tell, otherwise null.';

  return `You help employees file an internal request in the Operations Hub.
You never create the request. You only return a JSON object the backend will validate.

Allowed categories:
${categories}

Allowed teams:
${teams}

Allowed priorities:
${priorities}

Rules:
- Use only the ids listed above. Never invent a category, team, or priority.
- Choose the single best matching category from the allowed list using each category's name and its default team.
- ${catchAllRule}
- If the text is thin (a few words) or could reasonably belong to more than one listed team, set needsClarification true and confidence low.
- suggestedNextStep must tell them to submit in this hub to the matching listed team, not to message a coworker.
- selfServeHint may be a short optional first try the employee can attempt safely. Use null if none exists. Never say the issue is solved.
- summary must be a short subject line (under 80 characters). Do not copy the employee's draft or paste the full description into summary.
- Do not ask for passwords.
- Reply with JSON only, matching this shape:
{"summary": string, "categoryId": string, "priorityId": string, "suggestedOwningTeamId": string or null, "suggestedNextStep": string, "selfServeHint": string or null, "needsClarification": boolean, "clarificationQuestion": string or null, "confidence": "high"|"medium"|"low"}`;
}

export function buildUserPrompt(draft: string): string {
  return `Employee draft:\n${draft}`;
}
