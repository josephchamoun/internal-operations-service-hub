# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Users submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox.

## What the running app is

PostgreSQL on Neon. Sign-in with Microsoft or with email and password. Notifications go out through Gmail (SMTP). The intake suggestion uses Groq and is optional: without a key, the ordinary submit form still works. Files are stored in the database.

Mail can be tested on your own computer. Run the API locally with `MAILTRAP_HOST=smtp.gmail.com`, port `587`, and the Gmail app password in `backend/.env`. Create an IT request. The message goes to the active members of that team, and a copy shows in the sending Gmail account's Sent folder. The request is still saved if the send fails. Render's free plan blocks outbound ports `25`, `465`, and `587`, so the same send times out on the live free service. A paid Render instance can use port `587` with those same Gmail settings.

`GET /health` checks the database and Groq and is protected with its own username and password. `npm run monitor` is a separate process that calls health about every 2 seconds. The release check is `npm run verify:release`. Details are in `docs/week5-release-operations.md`.

The Week 2, Week 3, and Week 4 write-ups are the submissions for those assignments. They are left unchanged on purpose. This file describes the app as it runs now. Do not read those three write-ups as a description of the current routes or host.

## Live site

- Website and API: `https://internal-operations-service-hub.onrender.com`
- Sign in: `https://internal-operations-service-hub.onrender.com/login`
- Health: `https://internal-operations-service-hub.onrender.com/health` (Basic auth, not a page)
- Microsoft sign-in: `https://internal-operations-service-hub.onrender.com/api/auth/login`

## Postman

The collection is `postman/Eurisko2026-InternalOperationsServiceHub.postman_collection.json`.

Download it from this link:

`https://raw.githubusercontent.com/josephchamoun/internal-operations-service-hub/main/postman/Eurisko2026-InternalOperationsServiceHub.postman_collection.json`

In Postman, choose **Import**, then **Link**, and paste that address. The same file can be saved from the browser and imported with **File**.

Login is the first request. Send it before the others so Postman keeps the `access_token` cookie. The password saved in that request is the seed password from `backend/prisma/seed.ts`. That password works on a local database after seed. It does not open the live site. Change it to the live admin password before you call the live API.

The health request uses Basic auth. Replace `replacethis` and `replacethispass` with the live health username and password. The live admin password, the live health username and password, and the live database password are not in this repo. They are in the email sent to the instructors. Use the admin and health values from that email.

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

A new clone does not need the live database. `backend/README.md` installs local PostgreSQL, creates database `ops_hub`, then creates the tables and the admin. Follow that setup, then:

```bash
cd backend && npm install && npx prisma generate && npx prisma db push && npx prisma db seed && npm run start:dev
cd frontend && npm install && npm run dev
```

Seed creates the `Other` category, the `Normal` priority, and Jordan Admin, each only when that row is missing. It does not rewrite people who are already in the database. The admin's email and password are in `backend/prisma/seed.ts`.

`npm run start:dev` is for editing: the API restarts when you save a file. After a release build, `npm --prefix backend run start:prod` runs the compiled API (`node dist/main`) and does not watch files.

## Sign in

The live site is `https://internal-operations-service-hub.onrender.com`. The same address serves the website and the API. Data routes are under `/api`. `GET /health` is not.

Sign in with email and password. On a local database, seed creates Jordan Admin only when that user is missing, and the email and password are in `backend/prisma/seed.ts`. That seed password does not open the live site. The live admin password is in the email sent to the instructors. Microsoft sign-in is optional.

## Operations

The monitor is a second process. It is how you watch health over time. Run it from the repo root, or from the `backend` folder. Copy `backend/.env.example` to `backend/.env` first. For a local API, set `JWT_SECRET`, `DATABASE_URL`, and `HEALTH_PASSWORD`. Microsoft, Gmail, and Groq can stay empty. For the live site, `HEALTH_USER` and `HEALTH_PASSWORD` in that file must be the pair from the instructor email. A different password makes every check `401`.

Command Prompt:

```bat
set HEALTH_URL=https://internal-operations-service-hub.onrender.com/health
npm run monitor
```

PowerShell:

```powershell
$env:HEALTH_URL="https://internal-operations-service-hub.onrender.com/health"
npm run monitor
```

Mac or Linux:

```bash
HEALTH_URL=https://internal-operations-service-hub.onrender.com/health npm run monitor
```

It prints `ok` while the API is up. After three failures in a row it prints `ALERT`. When the API is back it prints `RESOLVED`. Stop it with Ctrl+C. The recovery steps are in `docs/week5-release-operations.md`.

## Tests

`npm run verify:release` from the repo root is the one check before a release. It creates tables, runs the seed, builds both apps, typechecks, and runs every test, including the long ones. It uses `TEST_DATABASE_URL` only. It does not read `DATABASE_URL`, so it does not touch the live database. It does not install packages. Install the backend and the frontend first. If the frontend install was skipped, the website build stops with `'tsc' is not recognized`.

To run it on a new machine:

1. Install Node.js and npm.
2. Install PostgreSQL 16 and leave it running. On Windows, use the installer from the PostgreSQL site. Remember the password for the `postgres` user. The server listens on port `5432`.
3. From the repo root, install both apps. Both are required: `cd backend && npm install`, then `cd ../frontend && npm install`.
4. Copy `backend/.env.example` to `backend/.env`. Set `JWT_SECRET` to any long random string. Replace `YOUR_PASSWORD` in both database URLs. The long tests boot the API, and the API refuses to start without `JWT_SECRET`. Notes in that file must start with `#`.
5. In pgAdmin, create two databases on that server: `ops_hub` for the app, and `ops_hub_test` for this command. From the `backend` folder, run `npx prisma db push` and `npx prisma db seed` so `ops_hub` has tables and Jordan Admin.
6. From the repo root, run `npm run verify:release`. It uses `ops_hub_test` only.

## Host

The live API starts with `npm run start:prod` (`node dist/main`) and also serves the built website. The monitor is not started by that command. Run it separately, with `HEALTH_URL` set to `https://internal-operations-service-hub.onrender.com/health`.

The live service is on Render's free plan. After about 15 minutes with no visits it sleeps. The first open after that, and the first open after Resume, can take a minute or more before the site answers. Wait for it. That wait is the free plan waking up, not a failed recovery.
