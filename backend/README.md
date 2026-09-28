# Ops Hub Backend: request lifecycle, auth, messages, silence, escalation

## Setup

### How do I get the project?

```bash
git clone https://github.com/josephchamoun/internal-operations-service-hub.git
cd internal-operations-service-hub/backend
```

Then open the folder in your code editor (VS Code, Cursor, WebStorm).

### How do I install the dependencies?

```bash
npm install
```

This may take a couple of minutes the first time.

**Dependency note:** this project runs on **NestJS 10**. If you ever add a NestJS-family package (`@nestjs/config`, `@nestjs/passport`, `@nestjs/jwt`, `@nestjs/testing`) without pinning a version, npm will default to a v11/v12 release that needs NestJS 11/12 and fails with an `ERESOLVE` peer-dependency error. `package-lock.json` already has the right versions, so a plain `npm install` from a fresh clone is fine — this only matters if you install one of these fresh yourself.

### How do I configure it?

Create a `.env` file in `backend/` (copy `.env.example` if present):

```bash
# Database (required). Neon PostgreSQL for a real run.
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"

# Session tokens (required)
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=1h

NODE_ENV=development

# Microsoft Entra ID — real login (optional, see "Setting up real login" below)
AZURE_AD_CLIENT_ID=
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_REDIRECT_URI=http://localhost:3000/auth/callback
FRONTEND_URL=http://localhost:5173

# Gmail over SMTP. The names stay MAILTRAP_* because the mail code reads those.
MAILTRAP_HOST=smtp.gmail.com
MAILTRAP_PORT=587
MAILTRAP_USER=<the sending Gmail address>
MAILTRAP_PASS=<that account's app password, spaces removed>
NOTIFICATIONS_FROM_EMAIL=<the same Gmail address>

# Groq — optional AI intake suggestion, and the health AI check
# Free key from https://console.groq.com/keys
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

# Basic auth for GET /health. The monitor uses the same values.
HEALTH_USER=health
HEALTH_PASSWORD=<a password you choose>
MONITOR_INTERVAL_MS=2000

# Escalation scheduler — how often to *check* New unclaimed requests (ms).
# Actual reminder cadence still follows each priority's window (e.g. Normal = 24h).
# 7200000 = 2 hours. 0 disables the timer. Tests skip the timer automatically.
ESCALATION_CHECK_INTERVAL_MS=7200000
```

Generate a `JWT_SECRET` quickly:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Only `DATABASE_URL`, `JWT_SECRET`, and `JWT_EXPIRES_IN` are required to boot the app. Microsoft sign-in needs the `AZURE_AD_*` values. Gmail needs the `MAILTRAP_*` values and `NOTIFICATIONS_FROM_EMAIL`. Groq needs `GROQ_API_KEY` for the suggestion and for the health AI check. Without those, the rest of the app still runs: email-and-password sign-in, saving a request, and submitting the form without a suggestion.

### How do I set up the database (Prisma + PostgreSQL)?

```bash
npx prisma generate   # generates the Prisma client from prisma/schema.prisma
npx prisma db push    # applies schema.prisma to the database in DATABASE_URL
npx prisma db seed    # creates Jordan Admin only if that user is missing
```

`prisma/schema.prisma` is the source of truth for the tables (`Team`, `TeamMembership`, `Category`, `Priority`, `User`, `Request`, `Message`, `Attachment`, `RequestEvent`, `Silence`, `AccessLog`). The provider is `postgresql`. A real run uses Neon. The release command `db:setup` is `prisma db push` followed by `prisma db seed`.

Seed does not rewrite an admin who is already there, and it does not create teams, categories, or other people. The admin's email and password are in `prisma/seed.ts`.

**To inspect the database visually:** `npx prisma studio` opens a browser UI against `DATABASE_URL`. Day-to-day admin work (users, teams, categories, priorities) is also available in the frontend admin pages.

### Setting up real login (Microsoft Entra ID) — optional

Only needed if you want the "Sign in with Microsoft" button. Email-and-password sign-in works without it.

1. In the [Azure Portal](https://portal.azure.com), go to **Microsoft Entra ID → App registrations → New registration**.
2. Give it any name. Under **Redirect URI**, choose **Web** and enter `http://localhost:3000/auth/callback` — this must match `AZURE_AD_REDIRECT_URI` in `.env` exactly.
3. After creating it, copy the **Application (client) ID** and **Directory (tenant) ID** from the app's Overview page into `AZURE_AD_CLIENT_ID` and `AZURE_AD_TENANT_ID`.
4. Go to **Certificates & secrets → New client secret**, create one, and copy its **value** (not its ID) into `AZURE_AD_CLIENT_SECRET` immediately — Azure only shows it once.
5. Go to **API permissions** and make sure `openid`, `profile`, and `email` (under Microsoft Graph, Delegated) are present — these are usually added by default.
6. For a real user to actually be able to log in, an admin must first create a matching `User` row in this app's own database (by their email) — Entra ID only proves who someone is, it never auto-creates accounts here. Use `npx prisma studio` to add the row, or add them to `prisma/seed.ts` and re-seed.
7. Whoever you want to test with needs a real Entra ID account (email + password) in that tenant — either your own Microsoft 365/Azure AD tenant's users, or a free Azure AD tenant you set up for this purpose.

Once configured, `GET /auth/login` redirects to Microsoft's real login page. A successful login sets the same httpOnly session cookie as email sign-in and redirects to the frontend. The token is not put in the redirect URL.

### Setting up email notifications (Gmail) — optional

Only needed if you want the notification emails on a new request, unclaim, status change, reassignment, new message, or escalation reminder. A failed send does not undo the saved request.

The mail code is Nodemailer. It still reads `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS`, and `NOTIFICATIONS_FROM_EMAIL`.

1. Use a Gmail address for the hub, with 2-Step Verification turned on, and create an app password for it.
2. Set `MAILTRAP_HOST` to `smtp.gmail.com` and `MAILTRAP_PORT` to `587`.
3. Set `MAILTRAP_USER` and `NOTIFICATIONS_FROM_EMAIL` to that Gmail address.
4. Set `MAILTRAP_PASS` to the 16-character app password, with the spaces removed.
5. Restart the API. `.env` is read when the process starts.
6. The recipient is the `email` on the user row. An address has to be a real inbox. A new request emails the active members of the owning team only.

### How do I run it?

```bash
npm run start:dev
```

Starts the NestJS server in watch mode — it restarts automatically whenever you save a file. Should print something like `Ops Hub backend running on http://localhost:3000`.

### What URL do I open?

`http://localhost:3000`. If port 3000 was busy, read the terminal for the address it actually used.

There's no browsable UI at that URL by itself — either use Postman/Thunder Client directly against the backend, or run the frontend (`../frontend`, see its own README) and use that.

## Authentication

Employee routes require a valid session JWT. `GET /health` does not: it uses HTTP Basic auth (`HEALTH_USER` and `HEALTH_PASSWORD`) and ignores the employee cookie. The browser does not keep the session token in JavaScript. Login sets an httpOnly cookie named `access_token` (`Secure`, `SameSite=None`). The page cannot read it. Later requests send it because the frontend calls the API with credentials included. `POST /auth/logout` clears the cookie. `GET /auth/me` is how the page learns who is signed in.

Postman and the automated tests can still send `Authorization: Bearer <token>` instead of the cookie. A request with neither is `401`.

**Email and password:**

```
POST /auth/password
{ "email": "<the address on the user row>", "password": "<that user's password>" }
```

Sets the cookie and returns `{ "ok": true }`. The email is the address on the user row. The hub stores a bcrypt hash, never the password. A wrong email, a wrong password, or a user with no hash all return `401` with `Invalid email or password.` A matching hash on an inactive user returns the usual inactive-account error. This route is limited to 5 attempts per minute per IP address.

`npx prisma db seed` creates Jordan Admin only when that user is missing. It does not reset anyone's password. The admin email and password are in `prisma/seed.ts`. An admin can set or change a password on the user form. Leaving it blank on edit keeps the current hash. Leaving it blank on create means that person can sign in with Microsoft only.

**Real login, via Microsoft Entra ID** (only if configured, see above):

`GET /auth/login` → redirects to Microsoft → after a real login, `GET /auth/callback` exchanges the result for this app's own JWT, sets the cookie, and redirects to the frontend.

## Current stage and limitations

Storage: PostgreSQL via Prisma (`prisma/schema.prisma`, `DATABASE_URL` on Neon). Attachments are bytes in that same database.

Auth: Microsoft, or email and password. Every route requires a valid JWT, from the httpOnly cookie or from `Authorization: Bearer`; the request-lifecycle actions (claim, unclaim, cancel, reassign, change status/priority) additionally enforce specific authorization rules based on who's authenticated and their relationship to the request (see the endpoint table below). Client-supplied `actorId` fields no longer exist anywhere — the actor is always read from that JWT.

Frontend: exists now, in `../frontend` (React + Vite + TypeScript), covering the full flow plus admin CRUD. See its own README.

Scope: request lifecycle (create, view, edit details, claim, unclaim, update status, cancel, reassign, change priority), event history, access log, **admin CRUD**, **messages and attachments**, **per-user silence**, and the **escalation scheduler**. Auth is JWT from Microsoft or from email and password. Role and team memberships are loaded from the database on every request, not trusted from the token snapshot alone.

`GET /auth/me` returns the hydrated current user (`userId`, `role`, `teamIds`).

## Messages, attachments, silence, and escalation

Same JWT as everywhere else. Files are bytes in PostgreSQL (not disk paths). Allowed types: jpeg/png/gif/webp, PDF, `.docx`, plain text. Max **5MB** each. A rejected file is not saved, and the message is not created.

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET    | `/requests/:id/messages` | Requester, owning team, or admin. |
| POST   | `/requests/:id/messages` | Multipart: `body` (optional) and `files` (optional). Need text, files, or both. Requester or any owning-team member. Blocked on Resolved/Cancelled. |
| GET    | `/requests/:id/attachments` | Metadata only. |
| POST   | `/requests/:id/attachments` | Request-level files while **New and unclaimed**. |
| GET    | `/requests/:id/attachments/:attachmentId` | Download bytes. |
| PATCH  | `/requests/:id/attachments/:attachmentId` | Replace. Uploader only, New and unclaimed. Field name `file`. |
| DELETE | `/requests/:id/attachments/:attachmentId` | Remove. Same mutate rule as replace. |
| GET    | `/requests/:id/silence` | `{ silenced: boolean }` for **this** user. Owning-team members only. |
| PUT    | `/requests/:id/silence` | Mute escalation reminders for this user on this request. |
| DELETE | `/requests/:id/silence` | Un-mute. Claim and reassign also clear **that actor's** mute. |

The scheduler, when the process is running and `ESCALATION_CHECK_INTERVAL_MS` is > 0, periodically loads **New + unclaimed** requests and emails owning-team members (except silenced) if that request's priority window has elapsed since `createdAt` or the last `escalation_reminder` event.

## Admin write endpoints

Admin only. Duplicate emails rejected. Last admin cannot be removed. `Other` is not edited or deleted. `Normal` is not deleted. Delete is unused-only (`409` if still referenced). New ids are generated in code (UUID), not typed by the admin.

| Method | Path |
| ------ | ---- |
| POST / PATCH / DELETE | `/users`, `/users/:id` |
| POST / PATCH / DELETE | `/teams`, `/teams/:id` |
| POST / PATCH / DELETE | `/categories`, `/categories/:id` |
| POST / PATCH / DELETE | `/priorities`, `/priorities/:id` |

## Requests endpoints

The actor for every request below is whoever the session cookie or `Authorization: Bearer <token>` header resolves to — there is no more `actorId` body or query param anywhere.

| Method | Path                     | Body                                                         | Authorization rule                                                                                                                                                                                                             |
| ------ | ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/requests`              | `{ categoryId, priorityId?, teamId?, subject, description }` | Requester is always the authenticated user. `teamId` required only if the category has no default team, rejected (`400`) otherwise.                                                                                            |
| POST   | `/requests/interpret`    | `{ draft }`                                                  | Any authenticated user. Returns an advisory structured suggestion; does not create a request. `502` if the model output is unreadable, `503` if the provider is down or unconfigured.                                         |
| PATCH  | `/requests/:id/details`  | `{ subject, description }`                                   | Actor must be the requester. Request must be `New` and unclaimed; `400` if claimed or status has left `New`.                                                                                                                   |
| GET    | `/requests/mine`         | —                                                            | Requests submitted by the authenticated user.                                                                                                                                                                                  |
| GET    | `/requests`              | —                                                            | Admin: everything. Team member: their team(s)' requests. Employee with no team: only their own.                                                                                                                                |
| GET    | `/requests/:id`          | —                                                            | Limited detail (no `description`). Requester, owning-team member, or admin only — `403` otherwise.                                                                                                                             |
| GET    | `/requests/:id/full`     | —                                                            | Full detail. Requester, owning-team member, or admin only — `403` otherwise. Owning-team and admin views are written to `AccessLog`; the requester's own view is not.                                                                 |
| GET    | `/requests/:id/events`   | —                                                            | Requester, owning-team member, or admin.                                                                                                                                                                                       |
| GET    | `/requests/:id/stream`   | cookie, or query `?token=<accessToken>`                      | Same as `/events` above. The browser sends the session cookie. A query token is still accepted for a client that cannot send the cookie.                                                                                       |
| PATCH  | `/requests/:id/claim`    | —                                                            | Actor must be a member of the owning team. `409` if already claimed.                                                                                                                                                           |
| PATCH  | `/requests/:id/unclaim`  | —                                                            | Actor must be the current claimant. `400` if not currently claimed. Clears the claim and sets status back to `New` if it was `In Progress`.                                                                                     |
| PATCH  | `/requests/:id/status`   | `{ status }`                                                 | Actor must be the current claimant. `status` is `"In Progress"` or `"Resolved"`.                                                                                                                                               |
| PATCH  | `/requests/:id/cancel`   | —                                                            | Actor must be the requester. Only from `New` or `In Progress`.                                                                                                                                                                 |
| PATCH  | `/requests/:id/reassign` | `{ newTeamId, categoryId? }`                                 | Actor must be a member of the current owning team. Target team must exist and differ from the current one; clears any claim and sets status back to `New` if it was `In Progress`. Omitted `categoryId` is stored as Other. |
| PATCH  | `/requests/:id/priority` | `{ priorityId }`                                             | Actor must be a member of the owning team (claimant not required). `400` if the new priority is the same as the current one.                                                                                                   |

### Global rule

All actions above are blocked (`400`) on a request whose status is `Resolved` or `Cancelled`.

## Aggregate & admin-only views

| Method                             | Path                                   | Notes                                                                                             |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET                                | `/request-events`                      | Admin: every event across every request. Team member: only events for requests their team(s) own. |
| GET                                | `/access-logs`                         | Admin only — every access log entry, across every request.                                        |
| GET                                | `/users`, `GET /users/:id`             | Admin only.                                                                                       |
| GET                                | `/people`                              | Any authenticated user — `{ id, name, email }` for display. Roles and team memberships are omitted. |
| `TeamMembershipsController` routes | Admin only.                            |
| GET                                | `/teams`, `/categories`, `/priorities` | Any authenticated user — every role needs this to use the app at all.                             |

## Error responses

All errors follow Nest's standard shape:

```json
{
  "statusCode": 403,
  "message": "Only a member of the owning team can claim this request",
  "error": "Forbidden"
}
```

| Status | When it happens                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400    | A required field is missing/invalid, an unexpected extra field was sent, or a lifecycle rule was violated (category has no default team, request already terminal, not currently claimed, editing after claim or after leaving New, reassigning to the same team, changing priority to the same value). |
| 401    | No valid session cookie and no valid `Authorization: Bearer <token>` header.                                                                                                                                             |
| 403    | Authenticated, but this actor isn't allowed to do this specific thing to this specific request (see the rule table above).                                                                                               |
| 404    | A referenced entity does not exist: user, category, priority, team, or request.                                                                                                                                          |
| 409    | The request is already claimed.                                                                                                                                                                                          |

## Reference data

`prisma db seed` creates Jordan Admin only, and only when that user is missing. Teams, categories, priorities, and everyone else are rows an admin maintains in the app. The long tests build their own teams, categories, and users on the practice database, including `dev-employee` and `dev-manager`. Those two are not created by the seed.

`GET /teams`, `/categories`, and `/priorities` read whatever rows are in the database. `GET /users` is admin-only.

## Try it in Postman

Sign in with `POST /auth/password` as a user who already exists in Neon. The response is `{ "ok": true }` and the session is the `access_token` cookie. Postman's cookie jar sends that cookie on the requests below. The long tests create their own users on the practice database and sign in the same way.

1. `POST /auth/password` with the user's email and password.

2. `POST /requests`

   ```json
   {
     "categoryId": "laptop-issue",
     "subject": "Laptop won't turn on",
     "description": "Held power button 10s, no lights at all."
   }
   ```

   Copy the returned `id`. `owningTeamId` is derived automatically from the category.

3. Sign in again with `POST /auth/password` as someone on the owning team, so that person can act on the request above.

4. `PATCH /requests/{id}/claim` while signed in as the team member (no body needed).

5. `PATCH /requests/{id}/status` as that team member: `{ "status": "In Progress" }`.

6. Sign back in as the requester and `GET /requests/{id}/full` — full detail, since they're the requester.

7. Try step 4 again as the requester — expect `403`, since they're not on the owning team. This is the authorization boundary from the assignment, live.

## Running the automated tests

```bash
npm test              # unit tests. Skips the database integration spec.
npm run test:ai-eval  # intake suggestion cases, with the model mocked
npm run test:db       # integration spec, then end-to-end tests. Needs TEST_DATABASE_URL.
```

`npm test` does not open a database. `npm run verify:release` from the repo root runs setup, both builds, the typecheck, the unit tests, the AI evals, and `test:db`. It uses `TEST_DATABASE_URL` only. Before that command: install dependencies here and in `frontend`, copy `.env.example` to `.env`, set `JWT_SECRET`, start Docker Desktop, then run `docker compose -f docker-compose.test.yml up -d` from this folder. That container is Postgres 16, database `ops_hub_test`, on `localhost:5433`. The full list is in the root `README.md`. The end-to-end files are `test/requests.e2e-spec.ts`, `test/messages.e2e-spec.ts`, `test/silence.e2e-spec.ts`, `test/admin.e2e-spec.ts`, and `test/rate-limit.e2e-spec.ts`. HTTP routes in those tests are under `/api`, except `GET /health`.

## Why PostgreSQL

The Week 2 version used flat JSON files as a stand-in database, so that swapping in a real one later would touch each module's `*.repository.ts` and not the service or controller. Every `*.repository.ts` now calls `PrismaService`. The database is PostgreSQL, which matches the relational model in `data-model.md` and ADR-001. Neon holds the real data. `npm run verify:release` uses the Docker practice database from `docker-compose.test.yml`, through `TEST_DATABASE_URL`.

## File structure

```
backend/
├── prisma/
│   ├── schema.prisma            # full data model — Team, TeamMembership, Category,
│   │                             #   Priority, User, Request, Message, Attachment,
│   │                             #   RequestEvent, Silence, AccessLog
│   ├── migrations/              # older migration history; release setup uses db push
│   └── seed.ts                  # creates Jordan Admin only if missing
├── src/
│   ├── main.ts                   # bootstraps the app, global validation pipe
│   ├── app.module.ts             # root module, wires every feature module together
│   ├── common/
│   │   └── prisma/
│   │       ├── prisma.module.ts
│   │       └── prisma.service.ts
│   └── modules/
│       ├── auth/                 # GET /auth/login, GET /auth/callback, POST /auth/password
│       ├── requests/              # this feature's core — controller/service/repository/dto/entities
│       ├── request-events/        # audit trail: claims, status changes, reassignments, priority changes
│       ├── access-logs/           # who opened a request's full detail, and when
│       ├── notifications/         # Gmail via SMTP, fire-and-forget
│       ├── live-updates/          # SSE push for anyone with a request open
│       ├── intake-ai/             # POST /requests/interpret (Groq)
│       ├── health/                # GET /health and the monitor command
│       ├── messages/ attachments/ silences/ escalations/
│       ├── users/ teams/ categories/ priorities/ team-memberships/
│       │   # same shape as requests/, including admin write routes
├── test/
│   ├── test-database.ts
│   ├── requests.e2e-spec.ts
│   ├── messages.e2e-spec.ts
│   ├── silence.e2e-spec.ts
│   └── admin.e2e-spec.ts
├── .env                          # NOT committed
├── .env.example
└── package.json
```

Each feature module under `modules/` follows the same five-piece shape: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `dto/`, `entities/`.

## Pattern to reuse for future assignments

Every domain gets the same five pieces:

```
<name>/
  dto/                 only exists once there's writing to validate
  entities/<name>.entity.ts
  <name>.repository.ts the only thing that knows how the data is actually persisted
  <name>.service.ts    business rules live here, not in the controller
  <name>.controller.ts thin, just maps HTTP verbs to service calls
  <name>.module.ts
```

When a new assignment adds a capability to an existing resource — for example, admin can create or edit categories:

1. Add `create`/`update`/`remove` to `categories.repository.ts` (talking to `PrismaService`).
2. Add matching methods to `categories.service.ts`.
3. Add `POST`/`PATCH`/`DELETE` routes to `categories.controller.ts`, plus `dto/create-category.dto.ts` and `dto/update-category.dto.ts`.

Nothing outside `categories/` needs to change. When a brand-new resource shows up (`messages`, `escalations`), copy the same five-piece shape as a new top-level folder under `src/modules/`, add its model to `prisma/schema.prisma` and run a migration, and register the module in `app.module.ts`.
