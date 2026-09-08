# Week 2 Agentic Workflow, Requests Feature

## Purpose

This document gives an AI agent, or any new contributor, what is needed to understand, extend, or debug the Requests feature. It covers request creation, claiming and unclaiming, status updates, cancellation, reassignment, the request event timeline, and access logging.

It does not cover the full backend, only the parts directly related to the `requests` module and the reference data it depends on: categories, priorities, users, teams, request events, access logs.

## Boundaries

The AI should not assume or introduce any of the following unless explicitly asked to.

No real database. All data is stored in flat JSON files on disk, read and written through `FileStorageService` (`common/storage/`). Do not introduce an ORM, migrations, or SQL. The file based storage is intentional for this stage of the project. `FileStorageService` is the only class that touches the filesystem. Every feature gets its own `*.repository.ts` on top of it, so a real database later only means swapping repositories, not touching services, controllers, or DTOs.

No authentication or authorization system. There is no login, no sessions, no tokens, and no permission checks based on identity. Some actions still take an `actorId`, in the body for `POST`/`PATCH` requests, in a `?actorId=` query param for the one `GET` route that uses it. This value is only used to confirm the id refers to a real user and to record who performed an action in the request's event history or access log. It is never used to grant or deny access. Do not add auth middleware, guards, token verification, or any check that compares an actor's identity, role, or team membership against a request to decide whether an action or view is allowed.

No frontend. This is a backend only API. Do not generate UI code, React components, or client side logic. Every user action, viewing, claiming, reassigning, and so on, is just an HTTP call. There is no separate concept of a UI click distinct from the API call itself.

No notification system yet. Several places in the code have comments like `// Later: notify the whole owning team.` These are intentional placeholders. Do not implement email, push, or websocket notifications unless explicitly asked.

No escalation reminders or per user silencing. Both are described in the product spec but not implemented in this stage.

No admin CRUD for reference data. Categories, priorities, and teams are read only, admin managed seed data (`categories.json`, `priorities.json`, `teams.json`). This feature only consumes that data via each module's service, it does not create, update, or delete it.

If a category has no defaultTeamId (the "Other" category), the request body must include a teamId, and creation is rejected if it's missing. If the category does have a defaultTeamId, teamId is ignored and the derived team is used instead. Wrong routing can still be corrected later via reassignment.

## Architecture and conventions

Framework: NestJS, modular structure, one module per resource (`requests`, `categories`, `priorities`, `users`, `teams`, `request-events`, `access-logs`).

Data flow within a module: Controller calls Service calls Repository calls FileStorageService calls JSON file.

Cross module reads go through the other module's Service, not its raw storage file. For example, when `RequestsService` needs a category, it calls `CategoriesService.findOne(id)`. It does not read `categories.json` directly via `FileStorageService`. This keeps storage details isolated to each module, so switching to a real database later only requires changing that module's repository, not every consumer.

Validation: input validation lives on DTOs using `class-validator` decorators (`@IsString()`, `@IsNotEmpty()`, `@IsIn()`, and so on), enforced globally via `ValidationPipe` in `main.ts` (`whitelist: true, forbidNonWhitelisted: true, transform: true`).

Existence validation, does this category, priority, user, or team actually exist, lives in each module's `Service.findOne(id)`, which throws `NotFoundException` if not found. Other modules reuse this method rather than re implementing the lookup. This is the only kind of actor or id based check this feature performs. It confirms an id is real. It does not decide whether the caller is allowed to use it.

Lifecycle checks (is this request in a state where this action is allowed) are plain `if` statements inside service methods, throwing `BadRequestException` or `ConflictException` as appropriate. Shared checks are factored into a small private helper (`assertNotTerminal`) rather than repeated inline.

IDs: request records, request events, and access log entries use UUIDs (`uuid()` from the `uuid` package). Reference data (categories, priorities, teams) uses human readable string ids, for example `"Normal"`, `"Urgent"`, `"IT"`.

## Data shape: `RequestEntity`

```ts
{
  id: string; // UUID, generated on create
  requesterId: string; // who submitted the request
  categoryId: string; // FK to a CategoryEntity
  owningTeamId: string; // current owner, derived at creation, changes on reassignment
  priorityId: string; // FK to a PriorityEntity, defaults to "Normal"
  status: RequestStatus; // New | In Progress | Resolved | Cancelled
  claimedBy: string | null;
  subject: string;
  description: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

`RequestSummary` is the same shape minus `description`, returned by the limited detail endpoint (`GET /requests/:id`). It is a plain `Omit<RequestEntity, 'description'>`, not a separately stored entity. The full record is always what is on disk, the summary is just a narrower view of it computed on read.

## Data shape: `RequestEventEntity`

```ts
{
  id: string;
  requestId: string;
  eventType: RequestEventType; // status_change | claimed | unclaimed | category_changed | reassigned | priority_changed | escalation_reminder
  actorId: string | null;
  fromValue: string | null; // e.g. old status, or old team on reassignment
  toValue: string | null; // e.g. new status, or new team on reassignment
  createdAt: string;
}
```

## Data shape: `AccessLogEntity`

```ts
{
  id: string;
  userId: string; // who viewed the request's full detail
  requestId: string;
  accessedAt: string;
}
```

## Invariants and business rules

These are the rules that must hold true for every action in this feature. Only rules about the state of the request or the correctness of referenced ids are enforced in code. Rules that would depend on who the caller is are noted separately, since they are not enforced yet.

1. `owningTeamId` is always derived, never accepted from the client at creation. It comes from `category.defaultTeamId`. If the category has no default team, request creation is rejected. After creation, it only ever changes via reassignment.
2. `priorityId` must reference a real priority record. If omitted, it defaults to `"Normal"`. Either way, it is validated via `PrioritiesService.findOne()` before the request is saved.
3. A request can only be claimed if it is not already claimed (`claimedBy` is `null`) and it is not in a terminal status (`Resolved` or `Cancelled`).
4. A request's status can only change while it is claimed, and never directly to `Cancelled`. Cancellation is a separate action. An unclaimed request cannot have its status updated.
5. Cancellation is only allowed while the request's status is `New` or `In Progress`.
6. Reassigning a request requires the target team to be a real team and different from the current owning team, and the request must not be terminal. Reassignment updates owningTeamId and clears claimedBy; a claim never carries over to the new team. An optional categoryId can be sent along with the reassignment, but it must belong to the target team (its defaultTeamId must match), otherwise the request is rejected. If no categoryId is sent, the category falls back to "other". The move itself is always recorded as a reassigned event; if the category also ended up different from before, a separate category_changed event is recorded alongside it.
7. Changing priority requires the new priority to be a real priority record, and the request must not be terminal.
8. Terminal statuses (`Resolved`, `Cancelled`) are final. No further claim, unclaim, status change, reassignment, or priority change is allowed once a request reaches one of these states.
9. Viewing a request's full detail (`GET /requests/:id/full`) records an access log entry when `actorId` is supplied, regardless of who the actor is. This is a record of who looked, not a permission check.

The following are described in the product spec but intentionally not enforced yet, since authorization is Week 3 work:

- Only the current claimant being able to unclaim or change status.
- Only the requester being able to cancel their own request.
- Only members of a request's owning team being able to claim, reassign, or change its priority.
- Limiting who can view a request's limited detail, full detail, event timeline, or access logs based on role or team.
- Restricting the aggregate views (`GET /request-events`, `GET /access-logs`) to an admin.
- Deriving whether a past access log view counts as out of team.

These remain part of the product design and can stay documented as intended behavior. They are simply not wired into the code until real identity exists to check against.

## Actions in scope

| Action                    | Method                          | Rule summary                                                                                                                                                               |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create request            | `POST /requests`                | Validates category and priority exist, derives `owningTeamId` from category, or requires `teamId` when category has no default team, status starts as `New`                |
| List my requests          | `GET /requests/mine`            | Returns requests where `actorId` is the requester                                                                                                                          |
| List requests             | `GET /requests`                 | Returns every request                                                                                                                                                      |
| Get limited detail        | `GET /requests/:id`             | No `description` field                                                                                                                                                     |
| Get full detail           | `GET /requests/:id/full`        | Includes `description`; records an access log entry if `actorId` is supplied                                                                                               |
| Get request's timeline    | `GET /requests/:id/events`      | Full event history for this request                                                                                                                                        |
| Get request's access logs | `GET /requests/:id/access-logs` | Every recorded view of this request's full detail                                                                                                                          |
| Claim request             | `PATCH /requests/:id/claim`     | Request must be unclaimed and not terminal                                                                                                                                 |
| Unclaim request           | `PATCH /requests/:id/unclaim`   | Request must currently be claimed and not terminal                                                                                                                         |
| Update status             | `PATCH /requests/:id/status`    | Request must be claimed and not terminal                                                                                                                                   |
| Cancel request            | `PATCH /requests/:id/cancel`    | Only from `New` or `In Progress`                                                                                                                                           |
| Reassign request          | `PATCH /requests/:id/reassign`  | Target team must exist and differ from current; request must not be terminal; clears claim; optional `categoryId` must belong to the target team, else defaults to "other" |
| Change priority           | `PATCH /requests/:id/priority`  | New priority must be real; request must not be terminal                                                                                                                    |
| List all events           | `GET /request-events`           | Every event, across every request                                                                                                                                          |
| List all access logs      | `GET /access-logs`              | Every access log entry, across every request                                                                                                                               |

## What the AI should do

When asked to implement, modify, or debug something in this feature:

Follow the existing Controller, Service, Repository pattern already used across every module (`requests/`, `teams/`, `request-events/`, `access-logs/`, and so on).

Reuse existing services (`CategoriesService`, `PrioritiesService`, `UsersService`, `TeamsService`) for any cross module lookups. Do not read JSON files directly from `RequestsService` or any other service.

When a service needs another module's service, add that module to the consuming module's `imports` array, and make sure the providing module actually exports the service being borrowed. Both sides of the handshake are required.

Literal path segments must be declared before dynamic ones in a controller, for example `@Get('mine')` has to come before `@Get(':id')`, or Nest will match `"mine"` as if it were an `:id` value and route it to the wrong handler.

Do not add an actor identity check (comparing `actorId` against a requester, claimant, or team) anywhere in this feature unless explicitly asked. That work belongs to Week 3, once real authentication exists to base it on.

Preserve all invariants listed above. If a change would violate one, flag it rather than silently altering business logic.

Keep error handling consistent with existing exceptions (`NotFoundException`, `BadRequestException`, `ConflictException`) rather than inventing new error shapes.

Do not add database, auth, frontend, notification, or escalation and silencing code. Flag these as out of scope if requested, rather than partially implementing them.

## File structure this feature touches

```
src/
  common/
    storage/
      file-storage.service.ts    generic JSON read/write, the only class touching the filesystem
      storage.module.ts          @Global, so any module can inject FileStorageService directly

  modules/
    requests/
      dto/
        create-request.dto.ts
        claim-request.dto.ts       also used for unclaim
        update-status.dto.ts
        cancel-request.dto.ts
        reassign-request.dto.ts
        update-priority.dto.ts
      entities/
        request.entity.ts          RequestEntity and RequestSummary (Omit<RequestEntity, 'description'>)
      enums/
        request-status.enum.ts
      requests.controller.ts
      requests.service.ts
      requests.repository.ts
      requests.module.ts

    request-events/
      entities/request-event.entity.ts
      enums/request-event-type.enum.ts
      request-events.controller.ts
      request-events.service.ts
      request-events.repository.ts
      request-events.module.ts

    access-logs/
      entities/access-log.entity.ts
      access-logs.controller.ts
      access-logs.service.ts
      access-logs.repository.ts
      access-logs.module.ts

    teams/ categories/ priorities/ users/
      read only reference data for now, same five piece shape, no dto/ yet
      entities/<name>.entity.ts
      <name>.repository.ts
      <name>.service.ts
      <name>.controller.ts
      <name>.module.ts
```

## Future work and design notes

How escalation timers (`escalationWindowMinutes` on priorities) get triggered or enforced is not yet designed.

Per user silencing of escalation reminders is not yet designed.

How team membership (`teamIds` on users) is managed is out of scope for this feature.

Data currently lives in flat JSON files on disk via `FileStorageService`. This is intentional for this stage, not something left unfinished. When a real database is introduced, only each module's repository file needs to change, since no service, controller, or DTO in this feature depends on how or where the data is physically stored.

The permission rules listed under "Invariants and business rules" as not yet enforced are the intended Week 3 scope. When real authentication exists, the plan is to replace the manually supplied `actorId` with a value decoded from the caller's identity, then reintroduce the same checks that were previously implemented and rolled back for Week 2: matching claimant, requester, and team membership against the actor, and restricting the aggregate views to an admin role.
