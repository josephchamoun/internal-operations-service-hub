# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Employees submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox. This replaces those informal channels with one system of record.

## Status: current branch `week4/ai-assistant`

The hub now covers the Week 3 request lifecycle **plus** Week 4 AI intake **plus** the remaining product pieces that used to be schema-only: admin CRUD, messages and file attachments, per-user silence, and the escalation reminder scheduler.

Install and run are unchanged (backend + frontend READMEs). A Groq API key is still optional; without it, the ordinary submit form works.

## What has been built so far

Work in this repo, in order:

1. **Product design** — `docs/product-spec.md`, `docs/architecture.md`, `docs/data-model.md`, and `docs/decisions/ADR-001.md` (why a relational database).
2. **Week 2** — NestJS request lifecycle against a stand-in store: create, limited/full view, claim, unclaim, status, cancel, reassign, priority, events, access log. See `docs/week2-agentic-workflow.md`.
3. **Week 3** — Real SQLite (Prisma), Entra ID + test `dev-login`, per-action authorization, React frontend, Mailtrap notifications, SSE live updates. See `docs/week3-full-stack-delivery.md`.
4. **Week 4 AI** — Advisory Groq suggestion before submit (`POST /requests/interpret`). See `docs/week4-production-ai.md`.
5. **On top of that (same repo)**  
   - Admin can create, edit, and delete users, teams, categories, and priorities (with the locked `Other` / `Normal` rules).  
   - Requester and owning team can message on a request until it is Resolved or Cancelled; files (images, PDF, Word, txt, 5MB) store as SQLite blobs; invalid files do not leave an empty message.  
   - Owning-team members can silence **escalation reminders** for themselves on one request; claim or reassign clears *their* mute.  
   - A background sweep looks at New + unclaimed requests on an interval (default 2 hours) and emails the team when that request’s **priority window** has elapsed, skipping silenced members. Local Vite also has a **Test reminders** control so you do not wait hours.

## Where to start

1. `docs/product-spec.md` — what the system needs to do.  
2. `docs/architecture.md` — components and data flows.  
3. `docs/data-model.md` — what is stored.  
4. `docs/decisions/ADR-001.md` — why relational.  
5. `docs/week3-full-stack-delivery.md` — auth, frontend, notifications, SSE.  
6. `docs/week4-production-ai.md` — intake suggestion and eval command.

## Install, run, and test

Setup details live in:

- `backend/README.md` — env, Entra, Mailtrap, Groq, Prisma, endpoints, tests.  
- `frontend/README.md` — Vite, login, what screens exist.

```bash
cd backend && npm install && npx prisma generate && npx prisma migrate dev && npx prisma db seed && npm run start:dev
cd frontend && npm install && npm run dev   # separate terminal
```

**Try it:** log in as an employee (test identity picker), submit a request (optionally after an AI suggestion), then log in as a member of the owning team to claim, message, silence reminders, or change priority.

**Tests** (`cd backend && npm run test && npm run test:e2e && npm run test:ai-eval`) — Week 3 cases plus messages, silence/escalation, and AI evals.

## What's done

Product spec, architecture, data model, and ADR-001.

Full request lifecycle against Prisma/SQLite: list, limited and full detail, edit while New and unclaimed, claim, unclaim, status, cancel, reassign, priority, events, access log.

Authentication (Entra + `dev-login`) and per-action authorization. JWT role/team membership is reloaded from the database on each request.

React frontend for login, submit, my requests, team queue, limited/full detail, conversation, admin CRUD, access logs, and events.

Email (Mailtrap, fire-and-forget) on new request, unclaim, reassignment, status change, new message, and escalation reminders.

SSE live updates on an open request.

Admin CRUD for users, teams, categories, and priorities.

Messages and attachments (including replace/delete while New and unclaimed, by the uploader).

Per-user silence and the escalation scheduler.

AI advisory intake.

## What's not built yet

No CI/CD, deployment, monitoring, or production infrastructure.

No rate limiting — production-hardening, not this phase.

Queue filters cover status, priority, and claim state; there is still no **category** filter on the team list (product spec item 22).


