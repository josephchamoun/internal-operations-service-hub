# Ops Hub Backend: Requests Feature (mock data, no auth)

## Setup

### How do I get the project?

```bash
git clone https://github.com/josephchamoun/internal-operations-service-hub.git
cd internal-operations-service-hub
```

Then open the folder in your code editor (VS Code, Cursor, WebStorm — any is fine).

### How do I install the dependencies?

The app lives in the **backend** folder, so go there first:

```bash
cd backend
npm install
```

This may take a couple of minutes the first time.

### How do I run it?

From inside **backend**:

```bash
npm run start:dev
```

This starts the NestJS server in watch mode, it restarts automatically whenever you save a file. (Note: this build uses mock data and has no auth wired up yet.)

### What URL do I open?

http://localhost:3000

If port 3000 was busy, the terminal prints the real address it used; read the terminal and use that one.

## Current stage and limitations

Storage: flat JSON files under `data/`, read and written through `FileStorageService`. When a real database is introduced, only each module's `*.repository.ts` needs to change. No service, controller, or DTO depends on how or where the data is stored.

Auth: none. Authentication and authorization are Week 3 work. Some actions still take an `actorId` (in the body for `POST`/`PATCH`, in a `?actorId=` query param for `GET`), but this value is only used to record who did what in the request's event history and to check that the id refers to a real user. It is not used to grant or deny access. Anyone can currently perform any lifecycle action or view any request.

Frontend: none. This is an API only backend, tested with Postman.

Scope: this covers the request lifecycle only, creating, viewing, claiming, updating, cancelling, reassigning, and changing the priority of a request, plus its event history and access log. Managing users, categories, priorities, or teams is a separate concern and out of scope; that data is read only seed data for now.

## Requests endpoints

| Method | Path                        | Body / Query                                                              | Notes                                                                                                                                                                         |
| ------ | --------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/requests`                 | `{ requesterId, categoryId, priorityId?, teamId?, subject, description }` | Creates a request with status `New`. `owningTeamId` is derived from the category. `teamId` is required only if the category has no default team, and is rejected otherwise.   |
| GET    | `/requests/mine`            | `?actorId=`                                                               | Requests submitted by this actor.                                                                                                                                             |
| GET    | `/requests`                 | None                                                                      | Every request.                                                                                                                                                                |
| GET    | `/requests/:id`             | None                                                                      | Limited detail (no `description`).                                                                                                                                            |
| GET    | `/requests/:id/full`        | `?actorId=` optional                                                      | Full detail including `description`. If `actorId` is supplied, the view is recorded in the access log.                                                                        |
| GET    | `/requests/:id/events`      | None                                                                      | This request's event timeline.                                                                                                                                                |
| GET    | `/requests/:id/access-logs` | None                                                                      | Every recorded view of this request's full detail.                                                                                                                            |
| PATCH  | `/requests/:id/claim`       | `{ actorId }`                                                             | Fails (`409`) if already claimed.                                                                                                                                             |
| PATCH  | `/requests/:id/unclaim`     | `{ actorId }`                                                             | Fails (`400`) if not currently claimed.                                                                                                                                       |
| PATCH  | `/requests/:id/status`      | `{ actorId, status }`                                                     | `status` is `"In Progress"` or `"Resolved"`. Request must be claimed.                                                                                                         |
| PATCH  | `/requests/:id/cancel`      | `{ actorId }`                                                             | Only from `New` or `In Progress`.                                                                                                                                             |
| PATCH  | `/requests/:id/reassign`    | `{ actorId, newTeamId, categoryId? }`                                     | Target team must exist and differ from the current one. Clears any claim. If `categoryId` is sent, it must belong to the new team; otherwise, the category resets to `Other`. |
| PATCH  | `/requests/:id/priority`    | `{ actorId, priorityId }`                                                 | `priorityId` must reference a real priority.                                                                                                                                  |

### Global Rule

All actions above are blocked on a request whose status is `Resolved` or `Cancelled` (`400`).

## Aggregate views

| Method | Path              | Notes                                         |
| ------ | ----------------- | --------------------------------------------- |
| GET    | `/request-events` | Every event, across every request.            |
| GET    | `/access-logs`    | Every access log entry, across every request. |

## Error responses

All errors follow Nest's standard shape:

```json
{ "statusCode": 404, "message": "User u13 not found", "error": "Not Found" }
```

| Status | When it happens                                                                                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | A required field is missing or invalid, an unexpected extra field was sent, or a lifecycle rule was violated (category has no default team, request already terminal, not currently claimed, reassigning to the same team). |
| 404    | A referenced entity does not exist: user, category, priority, team, or request.                                                                                                                                             |
| 409    | The request is already claimed.                                                                                                                                                                                             |

## Reference data (mock, read only for now)

`data/teams.json`, `data/categories.json`, `data/priorities.json`, and `data/users.json` are pre seeded so you have real ids to test with, instead of typing random strings into `requests`.

| Method | Path            | Returns                                    |
| ------ | --------------- | ------------------------------------------ |
| GET    | /teams          | `IT`, `HR`                                 |
| GET    | /teams/:id      | one team                                   |
| GET    | /categories     | e.g. `laptop-issue` with default team `IT` |
| GET    | /categories/:id | one category                               |
| GET    | /priorities     | `Low`, `Normal`, `Urgent`                  |
| GET    | /priorities/:id | one priority                               |
| GET    | /users          | mock employees, team members, an admin     |
| GET    | /users/:id      | one user                                   |

`teams`, `categories`, `priorities` and `users` each have their own module and repository, even though only `findAll`/`findById` are used right now. They are meant to become admin managed in a later assignment. When that starts, you add `create`/`update`/`remove` to the resource's repository and `POST`/`PATCH`/`DELETE` to its controller. Nothing about `requests` or the other resources has to change.

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
   
   Copy the returned `id`. `owningTeamId` is derived automatically from the category, not sent in this body.

2. `PATCH /requests/{id}/claim`
   
   ```json
   { "actorId": "it-agent-1" }
   ```
   
   To submit an "Other" category request instead, use categoryId: "other" and include a teamId in the body, since that category has no default team.

3. `PATCH /requests/{id}/status`
   
   ```json
   { "actorId": "it-agent-1", "status": "In Progress" }
   ```

4. `GET /requests/{id}/full?actorId=it-agent-1` returns the full request and records the view in the access log.

5. `GET /requests/{id}/access-logs` shows that view.

6. `GET /requests` to see everything persisted in `data/requests.json`.

## Why file storage instead of a database

There are no DB tables yet, so each file in `data/` acts as a table. `FileStorageService` (in `src/common/storage/`) is the only piece of code that touches the filesystem, it just reads and writes a JSON array. Every feature module gets its own `*.repository.ts` that uses `FileStorageService` under the hood but exposes normal `findAll`, `findById`, `create`, `update` methods to the service layer.

This matters for later: when a real database is introduced, only the repository classes change. The controllers, services, and DTOs don't need to know or care where the data physically lives.

## File structure

```
src/
  main.ts                        bootstraps the app, global validation pipe
  app.module.ts                  root module, wires every feature module together

  common/
    storage/
      file-storage.service.ts    generic JSON read/write ("the mock DB engine")
      storage.module.ts          @Global so any feature module can inject it

  modules/
    requests/                    this assignment's core feature
      dto/
        create-request.dto.ts
        claim-request.dto.ts       also used for unclaim
        update-status.dto.ts
        cancel-request.dto.ts
        reassign-request.dto.ts
        update-priority.dto.ts
      entities/
        request.entity.ts        RequestEntity and RequestSummary (no description)
      enums/
        request-status.enum.ts
      requests.controller.ts     HTTP layer only
      requests.service.ts        lifecycle rules
      requests.repository.ts     talks to FileStorageService
      requests.module.ts

    request-events/              audit trail: claims, status changes, reassignments, priority changes
      entities/request-event.entity.ts
      enums/request-event-type.enum.ts
      request-events.controller.ts
      request-events.service.ts
      request-events.repository.ts
      request-events.module.ts

    access-logs/                 who opened a request's full detail, and when
      entities/access-log.entity.ts
      access-logs.controller.ts
      access-logs.service.ts
      access-logs.repository.ts
      access-logs.module.ts

    teams/ categories/ priorities/ users/
      mock and read only this assignment, admin manageable in a future one.
      same five piece shape as requests/, minus the write methods for now.
      entities/<name>.entity.ts
      <name>.repository.ts       findAll/findById only, for now
      <name>.service.ts
      <name>.controller.ts       GET /<name>, GET /<name>/:id
      <name>.module.ts

data/
  requests.json                  the mock table (starts empty, fills up as you POST)
  request-events.json
  access-logs.json
  teams.json                     seeded
  categories.json                seeded
  priorities.json                seeded
  users.json                     seeded
```

## Pattern to reuse for future assignments

Every domain, whether fully built out like `requests/` or just mock and read only like `teams/`, gets the same five pieces:

```
<name>/
  dto/                 only exists once there's writing to validate
  entities/<name>.entity.ts
  <name>.repository.ts the only thing that knows the JSON file's name
  <name>.service.ts    business rules live here, not in the controller
  <name>.controller.ts thin, just maps HTTP verbs to service calls
  <name>.module.ts
```

When a new assignment adds a capability to an existing mock resource, for example admin can create or edit categories:

1. Add `create`/`update`/`remove` to `categories.repository.ts`.
2. Add matching methods to `categories.service.ts`.
3. Add `POST`/`PATCH`/`DELETE` routes to `categories.controller.ts`, plus `dto/create-category.dto.ts` and `dto/update-category.dto.ts`.

Nothing outside `categories/` needs to change; `requests/` keeps storing `categoryId` as a plain string either way. When a brand new resource shows up, for example `messages` or `escalations`, copy the same five piece shape as a new top level folder under `src/modules/` and register its module in `app.module.ts`.
