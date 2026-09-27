# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Employees submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox.

## What the running app is

PostgreSQL on Neon. Sign-in with Microsoft or with email and password. Notifications go out through Gmail (SMTP). The intake suggestion uses Groq and is optional: without a key, the ordinary submit form still works. Files are stored in the database.

`GET /health` checks the database and Groq and is protected with its own username and password. `npm run monitor` is a separate process that calls health about every 2 seconds. The release check is `npm run verify:release`. GitHub runs that check on every push, then runs the long database tests on a temporary database. Details are in `docs/week5-release-operations.md`.

The Week 2, Week 3, and Week 4 write-ups are the submissions for those assignments. They are left as they were. This file describes the app as it runs now.

## What has been built

1. **Product design** — `docs/product-spec.md`, `docs/architecture.md`, `docs/data-model.md`, and `docs/decisions/ADR-001.md`.
2. **Week 2** — `docs/week2-agentic-workflow.md`.
3. **Week 3** — `docs/week3-full-stack-delivery.md`.
4. **Week 4 AI** — advisory Groq suggestion before submit (`POST /requests/interpret`). See `docs/week4-production-ai.md`.
5. **Week 5** — release check, protected health, monitor, and written recovery. See `docs/week5-release-operations.md`.
6. **On top of the request flow**
   - Admin can create, edit, and delete users, teams, categories, and priorities (with the locked `Other` / `Normal` rules).
   - Requester and owning team can message on a request until it is Resolved or Cancelled. Files (images, PDF, Word, txt, 5MB) are stored in PostgreSQL. An invalid file does not leave an empty message.
   - Owning-team members can silence escalation reminders for themselves on one request. Claim or reassign clears that person's mute.
   - A background sweep looks at New, unclaimed requests and emails the team when that request's priority window has elapsed, skipping silenced members.
   - The team queue can be filtered by status, priority, claim, and category. An admin, or someone on more than one team, can also filter by team.

## Where to start

1. `docs/product-spec.md` — what the system needs to do.
2. `docs/architecture.md` — components and data flows.
3. `docs/data-model.md` — what is stored.
4. `docs/decisions/ADR-001.md` — why a relational database.
5. `docs/week5-release-operations.md` — the release command, health, the monitor, and recovery.

## Install and run

Setup details live in `backend/README.md` and `frontend/README.md`.

```bash
cd backend && npm install && npx prisma generate && npx prisma db push && npx prisma db seed && npm run start:dev
cd frontend && npm install && npm run dev
```

Seed creates one admin, Jordan Admin, and only when that user is missing. It does not rewrite people who are already in the database. The admin's email and password are in `backend/prisma/seed.ts`.

`npm run start:dev` is for editing: the API restarts when you save a file. After a release build, `npm --prefix backend run start:prod` runs the compiled API (`node dist/main`) and does not watch files.

## Tests

On your computer, from the repo root, `npm run verify:release` builds both apps, typechecks the backend, and runs the unit tests and the AI evals. It does not run the long tests, because those wipe rows and this command uses the live Neon database.

GitHub runs `verify:release` and then `npm --prefix backend run test:db` on a temporary Postgres database. `test:db` is the integration spec plus the end-to-end tests.

## What's not on a host yet

The release check, health, and the monitor command are in the repo. The API is not deployed to a hosting service, and nothing starts the monitor for you. When a host exists, the API starts with `start:prod`, and the monitor is a second program with `HEALTH_URL` set to that host's `/health`.
