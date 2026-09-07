# Ops Hub Backend: Requests Feature (mock data, no auth)

## Setup

```bash
npm install
npm run start:dev
```

Server runs on `http://localhost:3000`.

## Current stage & deliberate limitations

- **Storage:** flat JSON files under `data/`, read and written through
  `FileStorageService`. This is intentional for this stage, not something
  left unfinished; when a real database is introduced, only each
  module's `*.repository.ts` needs to change; no service, controller, or
  DTO depends on how or where the data is physically stored.
- **Auth:** none yet. Every action takes an `actorId`, in the body for
  `POST`/`PATCH` requests, in a `?actorId=` query param for `GET`
  requests, as a manual stand-in for "the logged-in user." When real
  auth is added, these fields disappear and get replaced by a value
  decoded from the caller's token; the underlying service logic barely
  changes, only where the id comes from does.
- **Frontend:** none. This is an API-only backend, tested via Postman.
- **Scope:** this covers the request lifecycle only: creating, viewing,
  claiming, updating, cancelling, reassigning, and changing the priority
  of a request, plus its event history and access logs. Managing users,
  categories, priorities, or teams (creating/editing/deleting those
  records) is a separate concern and out of scope here; they're
  read-only, Admin-managed seed data for now.

## Requests endpoints

| Method | Path                            | Body / Query                              | Notes                                                                                          |
|--------|----------------------------------|---------------------------------------------|--------------------------------------------------------------------------------------------------|
| POST   | `/requests`                      | `{ requesterId, categoryId, priorityId?, subject, description }` | Creates a request with status `New`. `owningTeamId` is derived from the category, never sent by the client. |
| GET    | `/requests/mine`                 | `?actorId=`                                 | Only requests the actor submitted, same for every role.                                        |
| GET    | `/requests`                      | `?actorId=`                                 | Team/admin queue view: Admin sees all; team member sees requests owned by any team they belong to; an employee with no team gets `[]`. |
| GET    | `/requests/:id`                  | `?actorId=`                                 | Limited detail (no `description`). Requester, current owning team, or Admin only, otherwise `403`. Not logged. |
| GET    | `/requests/:id/full`             | `?actorId=`                                 | Full detail (includes `description`). Same access rule as above. Logged when the viewer is a team member and not the requester. |
| GET    | `/requests/:id/events`           | `?actorId=`                                 | This request's event timeline. Requester, owning team, or Admin only.                            |
| GET    | `/requests/:id/access-logs`      | `?actorId=`                                 | Admin only. Every logged view of this request, each with a freshly computed `wasOutOfTeam`.       |
| PATCH  | `/requests/:id/claim`            | `{ actorId }`                                | Actor must belong to the owning team. Fails (`409`) if already claimed.                          |
| PATCH  | `/requests/:id/unclaim`          | `{ actorId }`                                | Fails (`403`) if you're not the current claimant.                                                |
| PATCH  | `/requests/:id/status`           | `{ actorId, status }`                        | `status` is `"In Progress"` or `"Resolved"`. Only the claimant; request must be claimed; requester can't self-resolve. |
| PATCH  | `/requests/:id/cancel`           | `{ actorId }`                                | Only the original requester, and only from `New` or `In Progress`.                               |
| PATCH  | `/requests/:id/reassign`         | `{ actorId, newTeamId }`                     | Actor must belong to the *current* owning team. Target team must exist and differ. Clears any claim. |
| PATCH  | `/requests/:id/priority`         | `{ actorId, priorityId }`                    | Any member of the owning team, claimed or not, not restricted to the claimant.                  |

All actions above are blocked on a request whose status is `Resolved` or `Cancelled` (`400`).

## Aggregate views (Admin only)

| Method | Path              | Query        | Notes                                                        |
|--------|-------------------|--------------|-----------------------------------------------------------------|
| GET    | `/request-events` | `?actorId=`  | Every event, across every request.                              |
| GET    | `/access-logs`    | `?actorId=`  | Every access-log entry, across every request. Raw entries, no `wasOutOfTeam` (use the per-request view above for that). |

## Error responses

All errors follow Nest's standard shape:
```json
{ "statusCode": 404, "message": "User u13 not found", "error": "Not Found" }
```

| Status | When it happens |
|--------|------------------|
| 400    | A required field is missing/invalid, an unexpected extra field was sent, or a business rule was violated (e.g. category has no default team, request already terminal, reassigning to the same team). |
| 403    | The actor isn't allowed to perform this action (wrong claimant, wrong requester, not on the owning team, not an admin). |
| 404    | A referenced entity doesn't exist: user, category, priority, team, or request. |
| 409    | The request is already claimed. |

## Reference data (mock, read-only for now)

`data/teams.json`, `data/categories.json`, `data/priorities.json`, and
`data/users.json` are pre-seeded so you have real IDs to test with,
instead of typing random strings into `requests`.

| Method | Path              | Returns                                   |
|--------|-------------------|--------------------------------------------|
| GET    | /teams            | `IT`, `HR`                                 |
| GET    | /teams/:id        | one team                                   |
| GET    | /categories       | e.g. `laptop-issue` → default team `IT`    |
| GET    | /categories/:id   | one category                               |
| GET    | /priorities       | `Low`, `Normal`, `Urgent`                  |
| GET    | /priorities/:id   | one priority                               |
| GET    | /users            | mock employees, team members, an admin     |
| GET    | /users/:id        | one user                                   |

`teams`, `categories`, `priorities` and `users` each have their **own
module**, each with its own repository, even though only
`findAll`/`findById` are used right now. That's on purpose: they're
meant to become admin-managed in a later assignment, so when that
starts, you just add `create`/`update`/`remove` to that resource's
repository and `POST`/`PATCH`/`DELETE` to its controller. Nothing about
`requests` or the other resources has to change.

## Try it in Postman

1. `POST /requests`
   ```json
   {
     "requesterId": "u1",
     "categoryId": "laptop-issue",
     "subject": "Laptop won't turn on",
     "description": "Held power button 10s, no lights at all."
   }
   ```
   Copy the returned `id`. Note `owningTeamId` is derived automatically
   from the category, not sent in this body.

2. `PATCH /requests/{id}/claim`
   ```json
   { "actorId": "it-agent-1" }
   ```

3. `PATCH /requests/{id}/status`
   ```json
   { "actorId": "it-agent-1", "status": "In Progress" }
   ```

4. `GET /requests/{id}/full?actorId=it-agent-1`, full detail, logged
   since `it-agent-1` is a team member, not the requester.

5. `GET /requests/{id}/access-logs?actorId=admin-1`, confirm the view
   from step 4 shows up, with `wasOutOfTeam: false` (they're on the
   correct team right now).

6. `GET /requests` to see everything persisted in `data/requests.json`.

## Why file storage instead of a database

There are no DB tables yet, so each file in `data/` acts as a "table."
`FileStorageService` (in `src/common/storage/`) is the only piece of
code that touches the filesystem; it just reads/writes a JSON array.
Every feature module gets its own `*.repository.ts` that uses
`FileStorageService` under the hood but exposes normal `findAll` /
`findById` / `create` / `update` methods to the service layer.

This matters for later: when a real database is introduced, only the
repository classes change. The controllers, services, and DTOs don't
need to know or care where the data physically lives.

## File structure

```
src/
  main.ts                        # bootstraps the app, global validation pipe
  app.module.ts                  # root module, wires every feature module together

  common/
    storage/
      file-storage.service.ts    # generic JSON read/write ("the mock DB engine")
      storage.module.ts          # @Global so any feature module can inject it

  modules/
    requests/                    # this assignment's core feature
      dto/
        create-request.dto.ts
        claim-request.dto.ts       # also used for unclaim
        update-status.dto.ts
        cancel-request.dto.ts
        reassign-request.dto.ts
        update-priority.dto.ts
      entities/
        request.entity.ts        # RequestEntity + RequestSummary (no description)
      enums/
        request-status.enum.ts
      requests.controller.ts     # HTTP layer only
      requests.service.ts        # business rules (claim invariant, status rules, visibility)
      requests.repository.ts     # talks to FileStorageService
      requests.module.ts

    request-events/              # audit trail: claims, status changes, reassignments, priority changes
      entities/request-event.entity.ts
      enums/request-event-type.enum.ts
      request-events.controller.ts
      request-events.service.ts
      request-events.repository.ts
      request-events.module.ts

    access-logs/                 # who opened a request's full detail, and when
      entities/access-log.entity.ts
      access-logs.controller.ts
      access-logs.service.ts
      access-logs.repository.ts
      access-logs.module.ts

    teams/ categories/ priorities/ users/
      # mock + read-only this assignment, admin-manageable in a future one.
      # same five-piece shape as requests/, minus the write methods (for now).
      entities/<name>.entity.ts
      <name>.repository.ts       # findAll/findById only, for now
      <name>.service.ts
      <name>.controller.ts       # GET /<name>, GET /<name>/:id
      <name>.module.ts

data/
  requests.json                  # the mock "table" (starts empty, fills up as you POST)
  request-events.json
  access-logs.json
  teams.json                     # seeded
  categories.json                # seeded
  priorities.json                # seeded
  users.json                     # seeded
```

## Pattern to reuse for future assignments

Every domain, whether it's fully built out like `requests/` or just
mock/read-only like `teams/`, gets the **same five pieces**:

```
<name>/
  dto/                 # only exists once there's writing to validate
  entities/<name>.entity.ts
  <name>.repository.ts # the only thing that knows the JSON file's name
  <name>.service.ts    # business rules live here, not in the controller
  <name>.controller.ts # thin, just maps HTTP verbs to service calls
  <name>.module.ts
```

When a new assignment adds a capability to an existing mock resource
(e.g. "Admin can create/edit categories"):
1. Add `create`/`update`/`remove` to `categories.repository.ts`.
2. Add matching methods to `categories.service.ts`.
3. Add `POST`/`PATCH`/`DELETE` routes to `categories.controller.ts`, plus
   `dto/create-category.dto.ts` / `dto/update-category.dto.ts`.

Nothing outside `categories/` needs to change; `requests/` keeps
storing `categoryId` as a plain string either way. When a brand-new
resource shows up (e.g. `messages`, `escalations`), copy the same
five-piece shape as a new top-level folder under `src/modules/` and
register its module in `app.module.ts`.
