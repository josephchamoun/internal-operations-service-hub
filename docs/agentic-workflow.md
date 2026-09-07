# Agentic Workflow - Requests Feature

## Purpose

This document gives an AI agent (or any new contributor) everything needed to
understand, extend, or debug the **Requests** feature. It covers request
creation, claiming/unclaiming, status updates, cancellation, reassignment,
the request event timeline, and access logging.

It does **not** cover the full backend, only the parts directly related to
the `requests` module and the reference/support data it depends on
(categories, priorities, users, teams, request-events, access-logs).

---

## Boundaries

The AI should **not** assume or introduce any of the following unless
explicitly asked to:

- **No real database.** All data is stored in flat JSON files on disk,
  read/written through `FileStorageService` (`common/storage/`). Do not
  introduce an ORM, migrations, or SQL. The file-based storage is
  intentional for this stage of the project. `FileStorageService` is the
  only class that touches the filesystem; every feature gets its own
  `*.repository.ts` on top of it, so a real database later only means
  swapping repositories, not touching services/controllers/DTOs.
- **No authentication/authorization system.** There is no login, no
  sessions, no JWTs. The identity of the person performing an action
  (`actorId`) is passed manually by the client, in the body for
  `POST`/`PATCH` requests, in a `?actorId=` query param for `GET` requests
  (since GET requests shouldn't rely on a body). Do not add auth
  middleware, guards, or token verification. When real auth is added
  later, `actorId` fields disappear from DTOs/query params and are
  replaced by a value decoded from the caller's token. Service method
  signatures largely stay the same, only where the id comes from changes.
- **No frontend.** This is a backend-only API. Do not generate UI code,
  React components, or client-side logic. Every "user action" (viewing,
  claiming, reassigning, etc.) is just an HTTP call — there is no separate
  concept of a UI "click" distinct from the API call itself.
- **No notification system yet.** Several places in the code have comments
  like `// Later: notify the whole owning team.`; these are intentional
  placeholders. Do not implement email/push/websocket notifications unless
  explicitly asked.
- **No escalation reminders or per-user silencing.** Both are described in
  the product spec but not implemented in this stage.
- **No admin CRUD for reference data.** Categories, priorities, and teams
  are read-only, admin-managed seed data (`categories.json`,
  `priorities.json`, `teams.json`). This feature only *consumes* that data
  via each module's service, it does not create, update, or delete it.
- **No manual team selection at creation.** If a category has no
  `defaultTeamId` (e.g. an "Other" category), request creation is rejected
  outright rather than prompting the user to pick a team manually. Wrong
  routing is corrected after the fact via reassignment, not by letting the
  creator pick a team by hand.

---

## Architecture & conventions

- **Framework:** NestJS, modular structure; one module per resource
  (`requests`, `categories`, `priorities`, `users`, `teams`,
  `request-events`, `access-logs`).
- **Data flow within a module:** `Controller → Service → Repository →
  FileStorageService → JSON file`.
- **Cross-module reads go through the other module's Service, not its raw
  storage file.** For example, when `RequestsService` needs a category, it
  calls `CategoriesService.findOne(id)`, it does **not** read
  `categories.json` directly via `FileStorageService`. This keeps storage
  details isolated to each module, so switching to a real database later
  only requires changing that module's repository, not every consumer.
- **Validation:** input validation lives on DTOs using `class-validator`
  decorators (`@IsString()`, `@IsNotEmpty()`, `@IsIn()`, etc.), enforced
  globally via `ValidationPipe` in `main.ts` (`whitelist: true,
  forbidNonWhitelisted: true, transform: true`).
- **Existence validation** (e.g. "does this category/priority/user/team
  actually exist?") lives in each module's `Service.findOne(id)`, which
  throws `NotFoundException` if not found. Other modules reuse this method
  rather than re-implementing the lookup.
- **Authorization-style checks** (e.g. "is this actor allowed to do this?")
  are plain `if` statements inside service methods, throwing
  `ForbiddenException`/`ConflictException`/`BadRequestException` as
  appropriate. There is no guard/decorator layer, since there's no real
  auth yet. Shared checks are factored into small private helpers
  (`assertNotTerminal`, `assertBelongsToTeam`) rather than repeated inline.
- **Derived values are computed on read, not stored, wherever possible.**
  For example, whether a past access-log view counts as "out of team" is
  computed fresh at read time by comparing the log entry against the
  request's *current* `owningTeamId`, not stored as a flag at write time.
  This means a value can never drift out of sync with the data it depends
  on, it's simply recalculated from the current source every time it's
  needed. Prefer this pattern over caching/duplicating a value that could
  later disagree with its source (e.g. after a reassignment).
- **Requests have three read tiers, each with a narrower purpose than the
  last:** a list (identity + status only, scoped by role), a limited
  detail view (everything except `description`), and a full detail view
  (everything). Both detail tiers enforce the same access rule — requester,
  current owning team, or Admin, otherwise `ForbiddenException` — full
  detail additionally writes an access-log entry, but only when the viewer
  is a team member (not the requester, not an Admin). See rules 9-10 below.
- **IDs:** request records, request-events, and access-log entries use
  UUIDs (`uuid()` from the `uuid` package). Reference data (categories,
  priorities, teams) uses human-readable string IDs (e.g. `"Normal"`,
  `"Urgent"`, `"IT"`).

---

## Data shape: `RequestEntity`

```ts
{
  id: string;              // UUID, generated on create
  requesterId: string;     // who submitted the request
  categoryId: string;      // FK to a CategoryEntity
  owningTeamId: string;    // current owner; derived at creation, changes on reassignment
  priorityId: string;      // FK to a PriorityEntity, defaults to "Normal"
  status: RequestStatus;   // New | In Progress | Resolved | Cancelled
  claimedBy: string | null;
  subject: string;
  description: string;
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

`RequestSummary` is the same shape minus `description` — returned by the
limited-detail endpoint (`GET /requests/:id`). It is a plain
`Omit<RequestEntity, 'description'>`, not a separately stored entity; the
full record is always what's on disk, the summary is just a narrower view
of it computed on read.

## Data shape: `RequestEventEntity`

```ts
{
  id: string;
  requestId: string;
  eventType: RequestEventType;  // status_change | claimed | unclaimed | reassigned | escalation_reminder
  actorId: string | null;
  fromValue: string | null;     // e.g. old status, or old team on reassignment
  toValue: string | null;       // e.g. new status, or new team on reassignment
  createdAt: string;
}
```

## Data shape: `AccessLogEntity`

```ts
{
  id: string;
  userId: string;      // who viewed the request's full detail
  requestId: string;
  accessedAt: string;
}
```

---

## Invariants & business rules

These must hold true for every action in this feature:

1. **`owningTeamId` is always derived, never accepted from the client at
   creation.** It comes from `category.defaultTeamId`. If the category has
   no default team, request creation is rejected (`BadRequestException`).
   After creation, it only ever changes via reassignment.
2. **`priorityId` must reference a real priority record.** If omitted, it
   defaults to `"Normal"`. Either way, it is validated via
   `PrioritiesService.findOne()` before the request is saved.
3. **A request can only be claimed if:**
   - it is not already claimed (`claimedBy` is `null`), and
   - it is not in a terminal status (`Resolved` or `Cancelled`), and
   - the claiming actor belongs to the request's current owning team.
4. **Only the current claimant can** unclaim the request or change its
   status. Any other `actorId` attempting these actions gets a
   `ForbiddenException`.
5. **A request's status can only change while it is claimed**, and never
   directly to `Cancelled`; cancellation is a separate, requester-only
   action. An unclaimed request cannot have its status updated, and the
   requester cannot mark their own request `Resolved`.
6. **Only the original requester can cancel their own request**, and only
   while its status is `New` or `In Progress`.
7. **Any member of the request's current owning team can reassign it to a
   different team**, provided:
   - the request is not terminal,
   - the target team is a real team and is different from the current
     owning team.
     Reassignment updates `owningTeamId`, clears `claimedBy` (a claim never
     carries over to the new team), and does **not** touch `status` or any
     other field. The full before/after is recorded as a `reassigned` event
     so the request's history survives the move.
8. **Terminal statuses (`Resolved`, `Cancelled`) are final.** No further
   claim, unclaim, status-change, or reassignment actions are allowed once
   a request reaches one of these states.
9. **Both request detail tiers share the same access rule.** For
   `GET /requests/:id` (limited detail, no `description`) and
   `GET /requests/:id/full` (full detail, includes `description`), only
   the requester, a member of the request's *current* owning team, or an
   Admin may view it — anyone else gets `ForbiddenException`. Neither tier
   is open to arbitrary callers; both are gated the same way `claim`,
   `unclaim`, and `reassign` already are (`actor.id === requesterId` or
   `actor.teamIds.includes(owningTeamId)` or `actor.role === 'admin'`).
10. **Only the full-detail tier writes to the access log, and only for
    team-member viewers.** When a call to `GET /requests/:id/full`
    succeeds (i.e. already passed rule 9), an access-log entry is written
    *only if* the viewer is a member of the owning team and is not also
    the requester. The requester's own views and the Admin's views are
    never logged, since there's nothing to audit there. The log exists
    specifically to answer "which team members opened full details of a
    request currently sitting with their team," so it can be cross-checked
    later if that team turns out to have been the wrong one. Whether a
    given past entry still counts as "out of team" is computed on read,
    against the request's *current* `owningTeamId`, not stored at write
    time.
11. **Viewing a request's event timeline (`GET /requests/:id/events`) is
    also gated by the same rule as rule 9** (requester, owning team, or
    Admin), a `ForbiddenException` is thrown otherwise. This endpoint
    never writes to the access log; only full-detail views do.
12. **Only an Admin may read the cross-request aggregates**
    `GET /access-logs` (every access-log entry, across all requests) and
    `GET /request-events` (every event, across all requests). Both throw
    `ForbiddenException` for a non-admin `actorId`.
13. **`GET /requests` and `GET /requests/mine` are two distinct,
    purpose-built endpoints, not one endpoint with branching logic.**
    `GET /requests/mine` always returns the caller's own submitted
    requests, regardless of role. `GET /requests` is the team/admin queue
    view; an Admin sees every request; a team member sees whatever is
    currently owned by any team they belong to; an employee with no team
    membership gets an empty array from this endpoint (their own requests
    are only available via `/mine`). Both require `actorId` as a query
    param. Neither endpoint duplicates the other's filtering.

---

## Actions in scope

| Action                                | Method                          | Rule summary                                                                                                                |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Create request                        | `POST /requests`                | Validates category + priority exist; derives `owningTeamId`; status starts as `New`                                         |
| List my requests                      | `GET /requests/mine`            | Returns only requests where `actorId` is the requester, same behavior for every role                                        |
| List requests (team/admin queue)      | `GET /requests`                 | Admin sees all; team member sees requests currently owned by any team they belong to; employee with no team gets `[]`       |
| Get limited detail                    | `GET /requests/:id`             | Requester, owning team, or Admin only; no `description`                                                                     |
| Get full detail                       | `GET /requests/:id/full`        | Requester, owning team, or Admin only; includes `description`; logged when viewer is a team member, not the requester       |
| Get request's timeline                | `GET /requests/:id/events`      | Requester, current owning team, or Admin only                                                                               |
| Get request's access logs (enriched)  | `GET /requests/:id/access-logs` | Admin only; returns each logged view with a freshly computed `wasOutOfTeam`                                                 |
| Claim request                         | `PATCH /requests/:id/claim`     | Actor must belong to the owning team; request must be unclaimed and non-terminal                                            |
| Unclaim request                       | `PATCH /requests/:id/unclaim`   | Only current claimant; request must be non-terminal                                                                         |
| Update status                         | `PATCH /requests/:id/status`    | Only current claimant; request must be claimed and non-terminal; requester can't self-resolve                               |
| Cancel request                        | `PATCH /requests/:id/cancel`    | Only original requester; only from `New` or `In Progress`                                                                   |
| Reassign request                      | `PATCH /requests/:id/reassign`  | Actor must belong to the current owning team; target team must exist and differ; request must be non-terminal; clears claim |
| List all events (aggregate)           | `GET /request-events`           | Admin only                                                                                                                  |
| List all access logs (aggregate, raw) | `GET /access-logs`              | Admin only; raw entries                                                                                                     |

---

## What the AI should do

When asked to implement, modify, or debug something in this feature:

- Follow the existing Controller → Service → Repository pattern already
  used across every module (`requests/`, `teams/`, `request-events/`,
  `access-logs/`, etc.).
- Reuse existing services (`CategoriesService`, `PrioritiesService`,
  `UsersService`, `TeamsService`) for any cross-module lookups, do not
  read JSON files directly from `RequestsService` or any other service.
- When a service needs another module's service, add that module to the
  consuming module's `imports` array, and make sure the providing module
  actually `exports` the service being borrowed, both sides of the
  handshake are required.
- Literal path segments must be declared before dynamic ones in a
  controller, e.g. `@Get('mine')` has to come before `@Get(':id')`, or
  Nest will match `"mine"` as if it were an `:id` value and route it to
  the wrong handler. `@Get(':id/full')` and `@Get(':id/events')` don't
  have this problem, since they're longer paths than plain `:id`.
- When checking whether a request-detail viewer is a team member vs. the
  requester, always exclude the requester
  explicitly (`isOwningTeamMember && !isRequester`), a user can belong to
  a team that also happens to own their own submitted request, and that
  case must not be logged as if a teammate were checking on someone else's
  request.
- Preserve all invariants listed above; if a change would violate one,
  flag it rather than silently altering business logic.
- Keep error handling consistent with existing exceptions
  (`NotFoundException`, `BadRequestException`, `ForbiddenException`,
  `ConflictException`) rather than inventing new error shapes.
- Prefer computing a value on read over storing and later rewriting it,
  when the value depends on data that can change after the fact (see the
  access-log `wasOutOfTeam` example). Only store a value directly when it
  represents a fact that is true and permanent at write time (e.g. an
  event's `fromValue`/`toValue`, which describes what happened at that
  specific moment and should never change afterward).
- Do not add database, auth, frontend, notification, or escalation/silence
  code, flag these as out of scope if requested, rather than partially
  implementing them.

---

## File structure this feature touches

```
src/
  common/
    storage/
      file-storage.service.ts    # generic JSON read/write, the only class touching the filesystem
      storage.module.ts          # @Global, so any module can inject FileStorageService directly

  modules/
    requests/
      dto/
        create-request.dto.ts
        claim-request.dto.ts       
        update-status.dto.ts
        cancel-request.dto.ts
        reassign-request.dto.ts
      entities/
        request.entity.ts          # RequestEntity + RequestSummary (Omit<RequestEntity, 'description'>)
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
      # read-only reference data for now; same five-piece shape, no dto/ yet
      entities/<name>.entity.ts
      <name>.repository.ts        
      <name>.service.ts
      <name>.controller.ts         
      <name>.module.ts             
```

---

## Future Work & Design Notes

- How escalation timers (`escalationWindowMinutes` on priorities) get
  triggered or enforced is not yet designed.
- Per-user silencing of escalation reminders is not yet designed.
- How team membership (`teamIds` on users) is managed is out of
  scope for this feature.
- Data currently lives in flat JSON files on disk via FileStorageService. This is intentional for this stage, not something left unfinished. When a real database is introduced, only each module's repository file needs to change, since no service, controller, or DTO in this feature depends on how or where the data is physically stored.
  
  
  
  
  
  


