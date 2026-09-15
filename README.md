# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Employees submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox. This replaces those informal channels with one system of record.

## Status: v0.3, Integrated Product Slice (real DB, real auth, React frontend)

The full Service Request flow — submit, land in the owning team's queue, claim, work, change status, resolve/reassign/cancel — now runs end to end through a real React frontend, a NestJS backend, and a real SQLite database (via Prisma), behind authentication (Microsoft Entra ID, plus a test-only `dev-login` path) and per-action authorization. Email notifications (via Mailtrap's sandbox) and live in-page updates (SSE) are also wired up. See `docs/week3-full-stack-delivery.md` for the full write-up, including exactly which assignment requirements are met and where.

Everything outside this flow (admin CRUD, messages/attachments, escalation reminders, CI/CD, and production infrastructure) is still design-only or not yet started. See "What's not built yet" below.

## Where to start

Read the docs in this order, each one builds on the last:

1. `docs/product-spec.md`, what the system needs to do and why, written for anyone regardless of technical background.
2. `docs/architecture.md`, how the system is structured to meet that spec, its components, data flows, failure handling, and the reasoning behind the major design choices.
3. `docs/data-model.md`, what the system actually stores, how the pieces relate to each other, and how the real queries get answered.
4. `docs/decisions/ADR-001.md`, a deeper look at one specific decision, why the data lives in a relational database rather than a document store.
5. `docs/week3-full-stack-delivery.md`, the current (v0.3) delivery: the two authentication paths, every authorization rule, the invalid-request and expected-failure cases, notifications, live updates, and the full setup/run/test instructions.

## Install, run, and test this from scratch

Full setup — environment variables, Microsoft Entra ID app registration, Mailtrap sandbox setup, and database seeding — lives one level down, one README per app, since each app's setup is only relevant to someone actually running that app:

- `backend/README.md` — backend install, `.env` setup, Entra ID and Mailtrap configuration, database setup/seeding, running the server, running the automated tests, and the full endpoint list.
- `frontend/README.md` — frontend install, `.env` setup, and running the dev server.

Quick version, once both are configured:

```bash
cd backend && npm install && npx prisma generate && npx prisma migrate dev && npx prisma db seed && npm run start:dev
cd frontend && npm install && npm run dev   # separate terminal
```

**Exercising the flow:** open the frontend, log in via the test-identity picker as an employee, submit a request, then log in as a team member on the owning team to claim and work it — see `docs/week3-full-stack-delivery.md` for the full walkthrough, including how to see the authorization denial in action.

**Running the tests** (`cd backend && npm run test && npm run test:e2e`) — what each one covers is explained in `docs/week3-full-stack-delivery.md`.

## What's done

A complete product spec: the problem, the actors, functional requirements, non functional requirements, and acceptance criteria.

A complete architecture: components, external dependencies, data flows, authorization boundaries, and failure handling.

A complete data model: entities, relationships, lifecycle rules, real access patterns, and justified indexes.

One fully reasoned architecture decision record, covering the choice of database.

The full request lifecycle (create, view — list, limited detail, full detail —, edit details while New and unclaimed, claim, unclaim, change status, cancel, reassign, change priority), backed by an event history and an access log, now running against a real SQLite database via Prisma instead of mock JSON.

Authentication via Microsoft Entra ID (real OAuth2/OIDC), plus a test-only `dev-login` path used for local testing and the automated test suite. Neither auto-creates users — an Admin must provision a `User` row by email first.

Per-action authorization on every mutating request-lifecycle endpoint (who can edit details, claim, unclaim, cancel, reassign, change status/priority, and who gets the full vs. limited view), plus role-scoped listing (admin sees all, a team member sees their team's queue, an employee with no team sees only their own).

A React (Vite + TypeScript) frontend covering the full flow: login, request submission, role-scoped request list, request detail with edit/claim/unclaim/status/cancel/reassign actions, and view-only admin pages for users/teams/categories/priorities and the system-wide access-log/event views.

Email notifications on key lifecycle events (new request, unclaimed, status change, reassignment) via Mailtrap's sandbox, sent fire-and-forget so a slow or failed send never blocks the underlying action.

Live in-page updates over SSE for anyone with a request's detail page open, authorized per-request the same way the rest of the request-detail endpoints are.

One invalid request rejected on purpose, one expected failure handled on purpose, a unit test, an integration test, and an E2E test — see `docs/week3-full-stack-delivery.md` §0 and §6 for exactly where each one lives.

## What's not built yet

No admin CRUD (create/edit/delete) for users, teams, categories, or priorities — the admin pages added this round are view-only.

No Messages, Attachments, or the `Silence` (escalation-mute) mechanism — these tables exist in the Prisma schema but have no service/controller logic yet.

No escalation reminder scheduler.

No CI/CD, deployment, or production infrastructure.

No rate limiting — deliberately deferred as production-hardening rather than something this phase targets.
