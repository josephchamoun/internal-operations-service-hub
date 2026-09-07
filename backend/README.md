# Ops Hub Backend — Week 2 (mock data, no auth)

## Setup

```bash
npm install
npm run start:dev
```

Server runs on `http://localhost:3000`.

## Endpoints (this assignment: Requests)

| Method | Path                     | Body                                                                 | Notes                                      |
|--------|--------------------------|-----------------------------------------------------------------------|---------------------------------------------|
| POST   | /requests                | `{ requesterId, categoryId, owningTeamId, priorityId?, subject, description }` | Creates a request with status "New"        |
| GET    | /requests                | —                                                                      | List everything (for checking in Postman)  |
| GET    | /requests/:id            | —                                                                      | Get one request                            |
| PATCH  | /requests/:id/claim      | `{ userId }`                                                          | Fails (409) if already claimed             |
| PATCH  | /requests/:id/unclaim    | `{ userId }`                                                          | Fails (403) if you're not the claimant     |
| PATCH  | /requests/:id/status     | `{ status, userId }`                                                  | `status` is one of "In Progress"/"Resolved"/"Cancelled". Fails if unclaimed or you're not the claimant |

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
module** (`teams/`, `categories/`, `priorities/`, `users/`), each with
its own repository — even though only `findAll`/`findById` are used
right now. That's on purpose: teams and categories are meant to be
admin-managed in a later assignment, so when that assignment starts,
you just add `create`/`update`/`remove` to that resource's repository
and `POST`/`PATCH`/`DELETE` to its controller. Nothing about
`requests` or the other resources has to change.

## Try it in Postman

1. `POST /requests`
   ```json
   {
     "requesterId": "u1",
     "categoryId": "laptop-issue",
     "owningTeamId": "IT",
     "subject": "Laptop won't turn on",
     "description": "Held power button 10s, no lights at all."
   }
   ```
   Copy the returned `id`.

2. `PATCH /requests/{id}/claim`
   ```json
   { "userId": "it-agent-1" }
   ```

3. `PATCH /requests/{id}/status`
   ```json
   { "status": "In Progress", "userId": "it-agent-1" }
   ```

4. `GET /requests` to see it persisted in `data/requests.json`.

## Why file storage instead of a database

There are no DB tables yet, so each file in `data/` acts as a "table."
`FileStorageService` (in `src/common/storage/`) is the only piece of
code that touches the filesystem — it just reads/writes a JSON array.
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
  app.module.ts                  # root module — wires every feature module together

  common/
    storage/
      file-storage.service.ts    # generic JSON read/write ("the mock DB engine")
      storage.module.ts          # @Global so any feature module can inject it

  requests/                      # <- this assignment's real feature (full CRUD-ish)
    dto/
      create-request.dto.ts
      claim-request.dto.ts
      update-status.dto.ts
    entities/
      request.entity.ts          # shape of a Request, mirrors data-model.md
    enums/
      request-status.enum.ts
    requests.controller.ts       # HTTP layer only
    requests.service.ts          # business rules (claim invariant, status rules)
    requests.repository.ts       # talks to FileStorageService
    requests.module.ts

  teams/                         # <- mock + read-only this assignment,
  categories/                       admin-manageable in a future one.
  priorities/                       Same shape as requests/, minus the
  users/                             write methods (for now).
    entities/<name>.entity.ts
    <name>.repository.ts         # findAll/findById only, for now
    <name>.service.ts
    <name>.controller.ts         # GET /<name>, GET /<name>/:id
    <name>.module.ts

data/
  requests.json                  # the mock "table" (starts empty, fills up as you POST)
  teams.json                     # seeded
  categories.json                # seeded
  priorities.json                # seeded
  users.json                     # seeded
```

## Pattern to reuse for future assignments

Every domain — whether it's fully built out like `requests/` or just
mock/read-only like `teams/` — gets the **same five pieces**:

```
<name>/
  dto/                 # only exists once there's writing to validate
  entities/<name>.entity.ts
  <name>.repository.ts # the only thing that knows the JSON file's name
  <name>.service.ts    # business rules live here, not in the controller
  <name>.controller.ts # thin — just maps HTTP verbs to service calls
  <name>.module.ts
```

When a new assignment adds a capability to an existing mock resource
(e.g. "Admin can create/edit categories"):
1. Add `create`/`update`/`remove` to `categories.repository.ts`.
2. Add matching methods to `categories.service.ts`.
3. Add `POST`/`PATCH`/`DELETE` routes to `categories.controller.ts`, plus
   `dto/create-category.dto.ts` / `dto/update-category.dto.ts`.

Nothing outside `categories/` needs to change — `requests/` keeps
storing `categoryId` as a plain string either way. When a brand-new
resource shows up (e.g. `messages`, `escalations`), copy the same
five-piece shape as a new top-level folder under `src/` and register
its module in `app.module.ts`.
