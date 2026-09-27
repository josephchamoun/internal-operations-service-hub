# Internal Operations Service Hub — Frontend

React (Vite + TypeScript) client for the Service Request flow. Talks to the NestJS backend in `../backend` over its REST API and one SSE stream per open request. See `../docs/week3-full-stack-delivery.md` for how the whole flow works; this file is just install/run.

## Prerequisites

- Node.js 22
- The backend running (see `../backend/README.md`) — this app has nothing to talk to without it.

## Install

```bash
cd frontend
npm install
```

## Configure

Create `.env` (see `.env.example`):

```
VITE_API_BASE_URL=http://localhost:3000
```

Point this at wherever the backend is actually running.

## Run

```bash
npm run dev
```

Opens on `http://localhost:5173`.

## Logging in

The login page offers two paths:

- **Email and password** — the address on the user row, plus a password. A fresh database has one admin, created by `prisma db seed` only if that user is missing. The email and password are in `backend/prisma/seed.ts`. No Microsoft account is required.
- **Sign in with Microsoft** — Entra ID login. Only works if the backend has Entra ID credentials configured (`../backend/README.md`) and that person's email is already a user in the hub.

## What's here

- `src/pages/` — Login, request list, new request (optional AI suggestion + optional files, then submit), limited/full request detail (conversation, silence, actions), events, access logs, and **admin CRUD** for users/teams/categories/priorities. The team queue filters by status, priority, claim, and category. An admin, or someone on more than one team, can also filter by team.
- `src/auth`, via `useAuth()` — provides `user`, `ready`, `refresh`, and `logout`. The session is the httpOnly cookie. `useApiQuery` and mutations run only after `user` is set.
- `src/api/client.ts` — `api()` (JSON or `FormData`; no JSON content-type on uploads), `downloadFile()`, and `apiUrl()` for SSE.

## Authorization boundaries: both layers exist, and they're not the same one

Two separate things happen, and it's worth not conflating them:

- **UI-level guarding.** The request detail page conditionally renders each action button based on the viewer's relationship to that specific request — team membership, whether they're the requester, whether they're the current claimant, whether they're an admin. Someone without permission for a given action typically never sees the button for it at all.
- **Backend enforcement.** The API independently re-checks every one of those same conditions on every request, regardless of what the UI did or didn't show.

The backend check is the actual boundary — it's what can't be bypassed. The UI check is real, but it's a UX nicety sitting on top: a raw API call, browser devtools, or a bug in the frontend's conditional logic would still hit the backend's check and get a `403`, since the frontend has no way to stop that request from being sent. That's also why the denied-case demo (E2E test, and the Postman walkthrough in `../backend/README.md`) calls the API directly rather than screenshotting a hidden button — a hidden button doesn't demonstrate that anything is actually enforced.

## Known limitations

- Install/run is `npm install` then `npm run dev`. The backend must be up.
