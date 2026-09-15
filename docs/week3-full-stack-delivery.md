# Week 3 — Integrated Product Slice (v0.3)

## What this document covers

This is the delivery write-up for Week 3: a narrow, user-facing Service Request flow built with a React frontend, a NestJS backend, and real SQLite persistence via Prisma, behind an authenticated and authorized API. It covers what was built, why specific decisions were made, and exactly how to set up and run the whole thing from scratch.

The flow: an employee submits a request → it lands in the owning team's queue (and they're notified) → a team member claims it, works it, changes its status (the requester is notified) → the request resolves or gets reassigned/cancelled along the way. Every step in that flow is authenticated, and every mutating action is authorized against a specific, spec-derived rule, not just "logged in," but "allowed to do _this specific thing_ to _this specific request_."

---

## 0. Assignment requirement checklist

The assignment (v0.3) required the following seven items on the request flow, plus two documents. This table maps each one to exactly where it's satisfied, so it doesn't have to be pieced together from the sections below.

| Requirement                                                             | Status                      | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One meaningful authorization rule, with one case allowed and one denied | Done                        | §2's rule table covers seven such rules, not just one (pre-approved scope expansion — see §2's "Scope note"). The `claim` rule is the one explicitly exercised end-to-end: denied when the actor isn't on the owning team, allowed when they are. Both outcomes are proven at the API layer — unit-tested and E2E-tested (§6), and reproducible via Postman (`backend/README.md`). The frontend mirrors the same rule by hiding the button rather than surfacing the denial (§2), so the UI alone doesn't demonstrate the `403` — the API calls do. |
| One invalid request rejected on purpose                                 | Done                        | §2.1, "Invalid request, rejected on purpose" — submitting an `"Other"`-category request with no `teamId` → `400 Bad Request`, traced to `product-spec.md`'s acceptance criteria.                                                                                                                                                                                                                                                                                                                                                                    |
| One expected failure handled on purpose                                 | Done                        | §2.1, "Expected failure, handled on purpose" — claiming an already-claimed request → `409 Conflict`, traced to `product-spec.md`'s single-claimant rule.                                                                                                                                                                                                                                                                                                                                                                                            |
| One automated test for a business rule                                  | Done                        | §6, unit test (`requests.service.spec.ts`) — the claim-authorization rule, mocked dependencies, both the denied and allowed outcomes.                                                                                                                                                                                                                                                                                                                                                                                                               |
| One integration test between backend and database                       | Done                        | §6, integration test (`requests.repository.integration.spec.ts`) — writes and reads back a real row via `RequestsRepository` against a dedicated `test.db`, isolated from `dev.db`, reset to known fixtures before each test.                                                                                                                                                                                                                                                                                                                       |
| One meaningful E2E test                                                 | Done                        | §6, E2E test (`test/requests.e2e-spec.ts`) — boots the real app, drives it over real HTTP via `supertest`, covers create, requester edit allowed, non-requester edit denied (`403`), claim denied (`403`), claim allowed (`200`), edit rejected after claim (`400`), and unauthenticated access (`401`). |
| Regression protection for behaviour that already worked                 | Done, but worth knowing how | The unit test above does double duty: it's also what guards the Week 2 → Week 3 transition, where any client-supplied `actorId` could once claim any request, against the current rule requiring real team membership (§6). It's one test serving two roles rather than two separate tests — if you want a cleaner story for grading, a second, explicitly-labelled regression test that pins the old-vs-new claim behaviour would remove any ambiguity, but as written this does satisfy the requirement.                                          |

**Two things added beyond the assignment's minimum, worth flagging so they're not mistaken for scope creep:**

- **View-only admin pages.** A small admin dashboard (users, teams, categories, priorities, and the system-wide access-log/event views) was added this week, backed entirely by the read endpoints that were already authorized in Week 3 Day 3 (`GET /users`, `GET /team-memberships*`, global `GET /access-logs`, global `GET /request-events` — all admin-only, per §2's table). No admin CRUD exists — these pages only display what's already in the database. They were added to make the full role model (employee / team_member / admin) visible and easy to click through during review, rather than something that has to be verified purely by reading rules in a table.
- **Live updates (SSE).** Not required by the assignment, but built to match `architecture.md`'s spec for anyone with a request's page open. See §4 for what it does and how it's authorized.

---

## 1. The two authentication paths, and why both exist

This project implements **two** ways to obtain a valid session token, and it's important to understand neither is a "fake version" of the other; they produce byte-for-byte the same kind of token, issued by the same code, checked by the same guard.

### Real authentication: Microsoft Entra ID

`GET /auth/login` redirects to Microsoft's real OAuth2/OIDC login page. After a real login, Microsoft redirects back to `GET /auth/callback` with an authorization code. The backend exchanges that code for an ID token (via `@azure/msal-node`), extracts the identity's stable subject id (`oid`) and email, and runs **first-login provisioning**:

1. Look up a `User` row by `idpSubjectId` matching the token's `oid`. If found, that's the session's identity.
2. Else, look up by email where `idpSubjectId` is still `null`. If found, link `idpSubjectId` to that row (a one-time linking step) and use it.
3. Else, reject with `403 Forbidden`. **No user is ever auto-created.** Only an Admin, by pre-creating a `User` row with a matching email, can grant someone the ability to log in at all.

This is a deliberate design principle carried from the Week 1 architecture: the identity provider only ever proves _who someone is_. It never decides _what they can do_; role and team membership live exclusively in this application's own database, set by whoever administers it.

On success, the backend issues its own signed JWT (`{ userId, role, teamIds }`), and redirects the browser to the frontend with that token. From that point on, Microsoft is never consulted again — every subsequent request is authenticated purely against this JWT's signature.

### Test-only authentication: `dev-login`

`POST /auth/dev-login` (body: `{ "userId": "<seeded user id>" }`) issues the **exact same shape of JWT**, via the exact same `jwtService.sign()` call, but skips the Microsoft round-trip entirely; it just looks up a seeded user directly by id. Nothing downstream (the guard, the strategy, any authorization check) can tell a `dev-login` token apart from a real-login token; they are cryptographically and structurally identical.

This endpoint is **hard-gated**: it throws `403 Forbidden` whenever `process.env.NODE_ENV === 'production'`. It exists so the application — and its authorization rules specifically — can be exercised and automatically tested without requiring a real Entra ID tenant, real credentials, or real user accounts. It is the login path used by this project's own automated test suite, since a real Microsoft login page cannot realistically be driven by an automated test.

**Note on the `NODE_ENV` gate:** using `NODE_ENV === 'production'` to decide whether `dev-login` exists is a pragmatic choice for this assignment, not a pattern worth carrying forward. One variable is doing two unrelated jobs — "how the app is configured" and "is the test-only bypass endpoint allowed to exist" — and those don't always agree (a staging environment, for instance, is not `production` but arguably shouldn't expose `dev-login` either). A cleaner version would use a dedicated, explicitly opt-in flag, e.g. `ENABLE_DEV_LOGIN=true`, so the gate says what it means instead of being inferred from the general environment name. Kept as-is here since it's simple and does correctly block the endpoint in the one environment that actually matters for this submission — flagging it as a known simplification rather than an unexamined choice.

**Both paths remain fully functional in this submission, but only one of them belongs in a real deployment.** The frontend's login page offers both: a "Sign in with Microsoft" button (real auth) and a dropdown of seeded test identities (dev-login). All dev-login-specific code is marked with `// TEST-ONLY` comments in both the frontend and backend, so it can be cleanly removed later without touching the real authentication path at all. To be explicit: `dev-login` is not a lightweight alternative login method a real system would ship with — it exists solely so this submission's authorization rules can be exercised and graded without a real Entra ID tenant. In a real production deployment, `dev-login` and everything marked `// TEST-ONLY` would be deleted outright, not just disabled by the `NODE_ENV` check — a production system shouldn't ship a code path whose entire purpose is to bypass its own identity provider, even a disabled one.

---

## 2. Authorization

Every route requires a valid JWT (`JwtAuthGuard`, applied at the controller level). Beyond that, every mutating action on a request enforces a specific permission rule, each one traceable to `data-model.md` / `product-spec.md`:

| Action                                                                                          | Rule                                                                                                             | Enforced in                  |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `POST /requests`                                                                                | requester = whoever is authenticated                                                                             | `requests.service.ts`        |
| `PATCH /requests/:id/claim`                                                                     | actor must be a member of the owning team                                                                        | `requests.service.ts`        |
| `PATCH /requests/:id/unclaim`                                                                   | actor must be the current claimant                                                                               | `requests.service.ts`        |
| `PATCH /requests/:id/status`                                                                    | actor must be the current claimant                                                                               | `requests.service.ts`        |
| `PATCH /requests/:id/cancel`                                                                    | actor must be the requester                                                                                      | `requests.service.ts`        |
| `PATCH /requests/:id/details`                                                                   | actor must be the requester; request must be New and unclaimed                                                   | `requests.service.ts`        |
| `PATCH /requests/:id/reassign`                                                                  | actor must be a member of the current owning team                                                                | `requests.service.ts`        |
| `PATCH /requests/:id/priority`                                                                  | actor must be a member of the owning team                                                                        | `requests.service.ts`        |
| `GET /requests/:id`                                                                             | requester, owning-team member, or admin — anyone else gets `403`                                                 | `requests.service.ts`        |
| `GET /requests/:id/full`                                                                        | requester, owning-team member, or admin — anyone else gets `403`; owning-team and admin views are logged, requester's own views are not | `requests.service.ts`        |
| `GET /requests/:id/events`                                                                      | requester, owning-team member, or admin                                                                          | `requests.service.ts`        |
| `GET /requests/:id/stream`                                                                      | requester, owning-team member, or admin                                                                          | `live-updates.controller.ts` |
| `GET /requests`                                                                                 | admin sees all; team_member sees their team(s)' requests; employee with no team sees only their own              | `requests.service.ts`        |
| `GET /users`, `GET /team-memberships*`, global `GET /access-logs`, global `GET /request-events` | admin only                                                                                                       | respective controllers       |
| `GET /teams`, `GET /categories`, `GET /priorities`                                              | any authenticated user                                                                                           | respective controllers       |

**Why the access log exists, and who it actually covers.** `data-model.md` describes `AccessLog` as recording a view "despite not owning it," and `product-spec.md` #28 says this kind of access is "permitted, not blocked" — which sounds, on a literal read, like it's describing a genuinely cross-team view. It isn't. `owningTeamId` is how ownership is defined in this system — there's no separate "correct category" field — so a request that was miscategorized and landed with the wrong team **is, as far as authorization is concerned, owned by that team**. That team was never going to hit a block; the rule that matters is that their access still gets logged, specifically because the system has no way to tell a correctly-routed view from a misrouted one at the point of viewing. `findFullDetails` therefore logs every successful full-detail view **except the requester's own** — owning team and admin are logged, the person who submitted the request is not. That matches `data-model.md` §2.6. `GET /requests` and `GET /requests/:id` were never meant to expose anything to anyone outside that same circle either, and previously didn't enforce that — `findOne` had no authorization check at all until this pass. Both now use the identical `assertCanView` check as `findFullDetails`.

**Architectural note on how this is implemented:** authentication is enforced as a NestJS **Guard** (`JwtAuthGuard`), applied uniformly per-controller — this is appropriate because "is there a valid identity attached to this request" is the same check for every route. Authorization, by contrast, is enforced as explicit conditional logic _inside the service layer_ — this is appropriate because each rule depends on the specific record's current state (who currently owns it, who claimed it) which isn't known until that record has been loaded from the database. This is a standard, deliberate split, not an inconsistency.

**This exists on the frontend too, but as a second, separate layer.** `FullRequestPage.tsx` conditionally renders each action button using the same relationship checks (`isTeamMember`, `isRequester`, `isClaimant`, `user?.role === 'admin'`), so someone without permission for a given action typically never even sees the button. That's real UI-level guarding, not nothing — but it isn't the boundary that matters for this requirement. The backend re-checks every one of these independently on every request no matter what the UI rendered, and that's the check that can't be bypassed (a raw API call or a bug in the frontend's conditional logic would still hit it). Because of that, the denied-case demonstration below deliberately calls the API directly rather than relying on a hidden button in the UI.

**Scope note:** this submission implements the full set of lifecycle authorization rules above, exceeding the assignment's minimum requirement of one allowed/one denied case. This was confirmed as acceptable scope by the instructor when raised by a classmate.

**Known, deliberate gap:** Admin does not currently bypass the lifecycle action rules above (claim/unclaim/cancel/etc.) — the admin-only restriction only applies to the system-wide _read_ endpoints (users, access logs, etc.). This was a scope decision, not an oversight.

**Known, deliberate gap:** the exact rule for `GET /requests/:id/events` (requester/owning-team/admin) is not explicitly written in `data-model.md`; it was extrapolated from the explicit rule that messages and attachments "carry no independent access rules of their own, they follow whatever request they belong to" (§2.6), applied by analogy to the event timeline.

### 2.1 The two required failure-handling cases

The assignment asks for these as two items distinct from the authorization allow/deny pair above: one invalid request rejected on purpose, and one expected failure handled on purpose. Both already exist in `requests.service.ts`, not newly added for the writeup:

**Invalid request, rejected on purpose.** Submitting a new request through the `"Other"` category without a `teamId` — `create()` in `requests.service.ts` — throws `400 Bad Request`: _"Category 'other' has no default team; a teamId must be provided."_ This isn't an invented rule; `product-spec.md`'s acceptance criteria state it directly — submitting with no category, or `"Other"` with no team selected, must be blocked with the employee shown which field is missing. `"Other"` is the one category row in the schema with a deliberately nullable, and actually null, `default_team_id`, specifically to force this manual choice (`data-model.md`).

**Expected failure, handled on purpose.** Claiming a request that's already claimed — `claim()` in `requests.service.ts` — throws `409 Conflict`: _"Request {id} is already claimed by {claimedBy}."_ This is an ordinary, foreseeable race (two team members opening the same shared queue and reaching for the same request within moments of each other), not a bug path — which is why it gets a specific status code and message instead of silently overwriting the existing claim or falling through to a generic 500. `product-spec.md` is explicit that only one team member may hold a claim at a time and the rest of the team can't claim it until it's released; this exception is that rule's actual enforcement point.

Both are a different kind of check from the claim/unclaim/status/cancel/reassign/priority/details rules in the table above: those answer _"is this actor allowed to do this at all,"_ while these two answer _"is this specific attempt, by an otherwise-allowed actor, something the system can sensibly do right now."_ `requireRequest()` (`404 Not Found` for a nonexistent request id) and `assertNotTerminal()` (`400 Bad Request` for acting on an already-resolved/cancelled request) are further instances of the same "expected failure" category, reused across almost every mutating action. Editing after a claim or after the request has left New (`updateDetails()`, `400`) is the same kind of check.

---

## 3. External notifications (Mailtrap)

`architecture.md` specifies a notification dispatcher that fans out to "whichever tool employees already use day to day, such as email or a chat platform — still undecided." This submission resolves that open decision: **email, via Mailtrap's Email Sandbox.**

Mailtrap's sandbox intentionally never delivers to a real inbox — it captures outgoing SMTP traffic in a private testing dashboard. This was chosen specifically because the seeded test users have fake `@company.com` addresses; a sandbox lets the entire dispatch pipeline be built and demonstrated honestly without needing real employee email addresses or risking a real delivery.

**Trigger rules implemented** (`requests.service.ts`):

- New request created → notify every member of the owning team
- Request unclaimed → notify every member of the owning team (treated the same as a fresh arrival)
- Request status changed → notify the requester
- Request reassigned → notify every member of the new owning team
- Claiming a request → **no** external notification (per spec — the live SSE push, see §4, already reflects it for anyone watching)

**Design constraint honored:** notification sends are fire-and-forget (`void`, not `await`) from the triggering action. This is required by `architecture.md`: "sending a notification happens asynchronously and separately from saving the request, so a slow or failed notification never delays or blocks the action the person is actually waiting on." Every send failure is caught and logged inside `NotificationsService`, never surfaced to or blocking the caller.

**Known limitation:** Mailtrap's free sandbox tier enforces a stricter per-minute send limit than this project occasionally exceeds during testing (e.g., notifying a 3-person team in quick succession). When this happens, the affected individual send is logged as failed and swallowed — per the design constraint above, this never affects the underlying request action, only that one recipient's notification for that event. A production deployment on a paid email tier would not hit this limit at normal usage volume.

Step-by-step Mailtrap setup (creating the sandbox account, where to find the SMTP credentials, which `.env` keys to set) lives in `backend/README.md` — this document explains _why_ Mailtrap and _what_ triggers a send, not how to configure it.

---

## 4. Live updates (SSE)

`architecture.md` specifies that the backend pushes live updates to anyone currently viewing a request — distinct from the email notifications above, which reach people whether or not they're looking. SSE only reaches someone with the request's page open right now.

**What it's on:** `GET /requests/:id/stream?token=<accessToken>`, one stream per request. Events emitted: `claimed`, `unclaimed`, `status_changed`. Both the full detail page and the limited-view page subscribe while open and live-refresh on each event.

**How it's authorized:** the same rule as `GET /requests/:id/events` — requester, owning-team member, or admin. The token travels as a query param (not a header) because the browser's `EventSource` API can't send custom headers; it's verified inside the controller with the same JWT secret and logic the guard uses everywhere else, just delivered differently for this one route.

**Not an external integration** — it's a direct connection between this project's own backend and frontend, no third party involved.

---

## 5. Running this project

Full setup — env vars, Entra ID app registration, Mailtrap sandbox, database seeding — lives in `backend/README.md` and `frontend/README.md`, one per app, so this document can stay focused on _why_ things work the way they do. Once both are configured:

```bash
# backend
cd backend && npm install && npx prisma generate && npx prisma migrate dev && npx prisma db seed && npm run start:dev

# frontend, separate terminal
cd frontend && npm install && npm run dev
```

**Exercising the flow:** open the frontend, log in via the test-identity picker as **Dev Employee**, submit a request, log out and back in as **Dev Manager** (seeded on the IT team), claim it from the team queue and change its status, then log back in as the employee to see the update reflected. Note that trying this as an identity _not_ on the owning team won't produce a visible `403` in the UI — the frontend hides the Claim/Reassign/Priority buttons entirely for anyone who isn't on the owning team (§2 covers both layers). To see the actual denial happen, call the endpoint directly — either the Postman walkthrough in `backend/README.md`, or the E2E test (§6), both of which bypass the UI and hit the backend's check head-on. Real Entra ID login (`GET /auth/login`) works the same way once configured, but isn't required to exercise this flow — see `backend/README.md`.

---

## 6. Running the automated tests

```bash
cd backend
npm run test        # unit + integration tests
npm run test:e2e    # end-to-end tests
```

**Unit test** (`src/modules/requests/requests.service.spec.ts`) — tests the claim authorization rule in isolation, with every dependency (repository, notifications, live updates) replaced with mocks. Covers both the denied case (actor not on owning team → `ForbiddenException`) and the allowed case (actor on owning team → success). This also serves as regression protection: it guards the Week 2 → Week 3 transition, where any `actorId` could once claim anything, to the current rule requiring real team membership.

**Integration test** (`src/modules/requests/requests.repository.integration.spec.ts`) — writes and reads back a real row via `RequestsRepository` against a real SQLite database, no mocks. It runs against a **dedicated test database** (`prisma/test.db`, separate from `dev.db`), provisioned automatically by `test/test-database.ts` via `prisma db push` and reset to a small, known fixture set (`u1`, `dev-manager`, `dev-employee`, `laptop-issue`, `other`, `Normal`, teams `IT`/`HR`) before each test — so isolation comes from starting every test from a clean slate, not from deleting what the test itself created.

**E2E test** (`test/requests.e2e-spec.ts`) — boots the real NestJS application in-memory and drives it with real HTTP requests via `supertest`, against the same dedicated `test.db` as the integration test above (never `dev.db`): logs in as two different seeded identities via `dev-login`, creates a request, then covers the edit rule (requester allowed while New and unclaimed, non-requester denied `403`, requester rejected `400` after a claim) and the claim authorization outcomes (denied `403` from an actor not on the owning team, allowed `200` from an actor on the owning team), plus confirms an unauthenticated request is rejected (`401`).

---

## 7. What's intentionally out of scope for this submission

Per the assignment's own guidance ("no external integration, no CI/CD, no deployment, no monitoring, no production infrastructure"), the following are deliberately not built:

- Messages, Attachments, and the `Silence` (escalation mute) mechanism — these tables exist in the Prisma schema but have no service/controller logic yet.
- The escalation reminder scheduler.
- Any admin CRUD (create/edit/delete) for users, teams, categories, or priorities — the admin-only pages in this submission are view-only, per spec for this phase.
- Rate limiting — evaluated and deliberately deferred, as it falls under production-hardening rather than the "protect the boundaries" requirement this assignment targets.
