# Internal Operations Service Hub — Frontend

React (Vite + TypeScript) client for the Service Request flow. Talks to the NestJS backend in `../backend` over its REST API and one SSE stream per open request. See `../docs/week3-full-stack-delivery.md` for how the whole flow works; this file is just install/run.

## Prerequisites

- Node.js v18+
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

- **Test identity picker** — a dropdown of seeded users (e.g. "Dev Employee", "Dev Manager"). Calls the backend's `dev-login` endpoint. No external account needed; this is the fastest way to exercise the app.
- **Sign in with Microsoft** — real Entra ID login. Only works if the backend has real Entra ID credentials configured (`../backend/README.md`) and you have real credentials for a seeded user's email.

## What's here

- `src/pages/` — Login, request list, new request (optional AI suggestion, then submit), request detail, and view-only admin pages.
- `src/auth`, via `useAuth()` — provides `token` and `user`; `useApiQuery` and the request-detail mutations both read from it.
- `src/api/client.ts` — the only file in `api/`, exporting the shared `api()` function (attaches `Authorization: Bearer <token>` when a token is passed, normalizes backend errors into `ApiError`) and `apiUrl()` (used for the SSE `EventSource` URL, which can't go through `api()` since it isn't a `fetch` call).

## Authorization boundaries: both layers exist, and they're not the same one

Two separate things happen, and it's worth not conflating them:

- **UI-level guarding.** The request detail page conditionally renders each action button based on the viewer's relationship to that specific request — team membership, whether they're the requester, whether they're the current claimant, whether they're an admin. Someone without permission for a given action typically never sees the button for it at all.
- **Backend enforcement.** The API independently re-checks every one of those same conditions on every request, regardless of what the UI did or didn't show.

The backend check is the actual boundary — it's what can't be bypassed. The UI check is real, but it's a UX nicety sitting on top: a raw API call, browser devtools, or a bug in the frontend's conditional logic would still hit the backend's check and get a `403`, since the frontend has no way to stop that request from being sent. That's also why the denied-case demo (E2E test, and the Postman walkthrough in `../backend/README.md`) calls the API directly rather than screenshotting a hidden button — a hidden button doesn't demonstrate that anything is actually enforced.

## Known limitations

- Admin pages are view-only — no create/edit/delete forms exist yet.
