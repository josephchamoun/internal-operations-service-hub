# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Employees submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox.

## What the running app is

PostgreSQL on Neon. Sign-in with Microsoft or with email and password. Notifications go out through Gmail (SMTP). The intake suggestion uses Groq and is optional: without a key, the ordinary submit form still works. Files are stored in the database.

`GET /health` checks the database and Groq and is protected with its own username and password. `npm run monitor` is a separate process that calls health about every 2 seconds. The release check is `npm run verify:release`. Details are in `docs/week5-release-operations.md`.

The Week 2, Week 3, and Week 4 write-ups are the submissions for those assignments. They are left as they were. This file describes the app as it runs now.

## What has been built

1. **Product design** — `docs/product-spec.md`, `docs/architecture.md`, `docs/data-model.md`, and `docs/decisions/ADR-001.md`.
2. **Week 2** — `docs/week2-agentic-workflow.md`.
3. **Week 3** — `docs/week3-full-stack-delivery.md`.
4. **Week 4 AI** — advisory Groq suggestion before submit (`POST /api/requests/interpret`). See `docs/week4-production-ai.md`.
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

## Sign in

The live site is `https://internal-operations-service-hub.onrender.com`. The same address serves the website and the API. Data routes are under `/api`. `GET /health` is not.

Sign in with email and password. Seed creates one admin, Jordan Admin, only when that user is missing. The email and password are in `backend/prisma/seed.ts`. Microsoft sign-in is optional.

## Operations

The monitor is a second process. It is how you watch health over time. From the repo root, with `HEALTH_USER` and `HEALTH_PASSWORD` set:

```bash
HEALTH_URL=https://internal-operations-service-hub.onrender.com/health npm run monitor
```

It prints `ok` while the API is up. After three failures in a row it prints `ALERT`. When the API is back it prints `RESOLVED`. Stop it with Ctrl+C. The recovery steps are in `docs/week5-release-operations.md`.

## Tests

`npm run verify:release` from the repo root is the one check before a release. It creates tables, runs the seed, builds both apps, typechecks, and runs every test, including the long ones. It uses `TEST_DATABASE_URL` only. It does not read `DATABASE_URL`, so it does not touch Neon.

To run it on a new machine:

1. Install Node.js and npm.
2. Install Docker Desktop and wait until it is running. An existing Postgres install can replace Docker. Point `TEST_DATABASE_URL` at a database you can wipe.
3. From the repo root, install both apps: `cd backend && npm install`, then `cd ../frontend && npm install`.
4. Copy `backend/.env.example` to `backend/.env`. Set `JWT_SECRET` to any long random string. The long tests boot the API, and the API refuses to start without it. `TEST_DATABASE_URL` is already filled in the example. Leave `DATABASE_URL` unused for this command. Notes in that file must start with `#`. Docker Compose reads `backend/.env` and rejects `//` comments.
5. From the repo root, start the practice database: `docker compose -f backend/docker-compose.test.yml up -d`. The first run downloads Postgres 16. It creates database `ops_hub_test` on `localhost:5433` with user `postgres` and password `postgres`.
6. From the repo root, run `npm run verify:release`.

## Host

The live API starts with `npm run start:prod` (`node dist/main`) and also serves the built website. The monitor is not started by that command. Run it separately, with `HEALTH_URL` set to `https://internal-operations-service-hub.onrender.com/health`.
