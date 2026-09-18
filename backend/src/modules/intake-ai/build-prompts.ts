import { IntakeCatalog } from './intake-ai.types';

export function buildSystemPrompt(catalog: IntakeCatalog): string {
  const categories = catalog.categories
    .map((item) => `- ${item.id}: ${item.name} (default team: ${item.defaultTeamId ?? 'none — Other'})`)
    .join('\n');
  const teams = catalog.teams.map((item) => `- ${item.id}: ${item.name}`).join('\n');
  const priorities = catalog.priorities.map((item) => `- ${item.id}: ${item.name}`).join('\n');

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
- If the text is clearly a laptop/hardware power problem, use laptop-issue.
- If it is an application/bug problem, use software-issue.
- If it is login, account, or permissions, use account-access.
- If it is leave, expense, or managerial approval, use hr-approval.
- If it is a policy/handbook question, use policy-question.
- If none fit, use other and set suggestedOwningTeamId to IT or HR if you can tell, otherwise null and needsClarification true.
- If the text is thin (a few words) or could be either IT or HR, set needsClarification true and confidence low.
- suggestedNextStep must tell them to submit in this hub to the matching team, not to message a coworker.
- selfServeHint may be a short optional first try (charger, restart app). Never say the issue is solved.
- summary must be a short subject line (under 80 characters). Do not copy the employee's draft or paste the full description into summary.
- Do not ask for passwords.
- Reply with JSON only, matching this shape:
{"summary": string, "categoryId": string, "priorityId": string, "suggestedOwningTeamId": string or null, "suggestedNextStep": string, "selfServeHint": string or null, "needsClarification": boolean, "clarificationQuestion": string or null, "confidence": "high"|"medium"|"low"}`;
}

export function buildUserPrompt(draft: string): string {
  return `Employee draft:\n${draft}`;
}
