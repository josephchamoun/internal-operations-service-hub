# Week 4 — AI-assisted request intake (v0.4)

## What this is

One new capability in the same Operations Hub repo: **before a request is saved**, an employee can paste free text and get a **structured suggestion** (summary, IT/HR type, category, priority, next step). They confirm or edit it, then submit through the existing `POST /requests` path.

The language model is **advisory**. The backend owns allowed category/team/priority ids. A paid provider is not required (Groq's free API). Existing Week 3 tests stay green.

## How to run the suggestion in the app

1. In `backend/.env`, set a free Groq key from https://console.groq.com/keys :

```
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
```

(`GROQ_MODEL` is optional.) Restart the backend. If the key is missing, **Get AI suggestion** returns `503` and the form still works.

2. Log in as an employee → **New request** → type a draft → **Get AI suggestion** → edit if needed → **Submit request**.

## What is sent to the model (and what is not)

Sent: the draft, plus the current Admin-defined category, team, and priority lists (ids and names only).

Not sent: other requests, users, emails, JWTs, access logs, or the rest of the spec. Access-log debounce (one row per person per request per hour) is hub-side only and is never part of the model prompt.

## Structured result the backend returns

```json
{
  "summary": "Laptop will not power on",
  "categoryId": "laptop-issue",
  "requestType": "IT",
  "priorityId": "Urgent",
  "suggestedOwningTeamId": "IT",
  "suggestedNextStep": "Submit this as a Laptop Issue. It will land unclaimed in IT's queue; a team member will claim it.",
  "selfServeHint": "If it will not power on, check the charger is seated and try a different outlet first.",
  "needsClarification": false,
  "clarificationQuestion": null,
  "confidence": "high"
}
```

`requestType` is the suggested owning team id after validation (`IT`, `HR`, or any later team id), or `unknown` if none. Unknown category ids become `other`. Unknown priority ids become `Normal`. A draft of fewer than four words is treated as thin: clarification required, confidence `low`.

`POST /requests/interpret` never inserts a row. Only `POST /requests` does.

## Assignment checklist

| Requirement | Where |
| --- | --- |
| Same repo, one intake capability | `POST /requests/interpret`, New request page |
| Free text → bounded product context | Prompt is built from Prisma category/team/priority rows |
| Structured candidate | JSON above; backend rebuilds it in `normalize-interpretation.ts` |
| Backend validates product-owned values | Fake ids discarded; see trusted-context eval case |
| AI is advisory | UI pre-fills; submit is still the old form |
| 5–8 eval cases (clear, thin, ambiguous) | `intake-ai.eval-cases.ts` |
| Trusted context + conditional behavior | Fake `payroll`/`Finance` ids dropped; thin drafts forced to clarify |
| Invalid output + provider failure | Unparseable text → `502`; provider error → `503` |
| Repeatable eval command | `cd backend && npm run test:ai-eval` |
| Normal tests stay green | `npm test` and `npm run test:e2e` |

## Repeatable eval command

```bash
cd backend
npm run test:ai-eval
```

This runs `src/modules/intake-ai/intake-ai.eval.spec.ts` with a **mocked** model (no Groq network). Cases:

1. `clear-laptop` — laptop will not open → `laptop-issue` / IT  
2. `clear-hr-approval` — unpaid leave → `hr-approval` / HR  
3. `clear-account-access` — cannot log in → `account-access` / IT  
4. `thin-help` — `"help"` → clarification, low confidence (even if the model sounds sure)  
5. `ambiguous-it-or-hr` — mixed follow-up → `other`, unknown team, clarification  
6. `trusted-context-fake-category` — model says `payroll` / `Finance` → `other`, no invented team  
7. `invalid-output-not-json` — model returns prose → `502`, no request created  
8. Provider throw → `503`, no request created  

## Code map

- `backend/src/modules/intake-ai/` — prompts, Groq client, normalize, eval fixtures  
- `POST /requests/interpret` — authenticated; `200` on success  
- Frontend: `frontend/src/pages/new-request-page.tsx`

## Also in this repo (same `week4/ai-assistant` branch, not part of the AI eval)

After intake shipped: admin CRUD; request messages and SQLite file attachments; per-user silence; escalation sweep (`ESCALATION_CHECK_INTERVAL_MS`). Run/setup is still `backend/README.md` and `frontend/README.md`. Extra e2e: `test/messages.e2e-spec.ts`, `test/silence.e2e-spec.ts`.
  
