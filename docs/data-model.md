# Data Model: Internal Operations Service Hub

This document describes what the system stores, how the pieces relate to each other, the rules that govern how a request moves through its life, the queries the product actually needs to answer, and how the data is stored.

---

## 1. Domain

### 1.1 Entities

**Team:** an owning team, such as IT or HR, defined by the Admin.

| Field      | Type      | Notes         |
| ---------- | --------- | ------------- |
| name       | text      | Admin-defined |
| created_at | timestamp |               |

**TeamMembership:** links a user to a team they belong to. A user may have any number of these rows.

| Field       | Type                      | Notes |
| ----------- | ------------------------- | ----- |
| user\_id    | FK to User (composite PK) |       |
| team\_id    | FK to Team (composite PK) |       |
| created\_at | timestamp                 |       |

**Category:** an Admin-defined request category, each with one default owning team.

| Field           | Type       | Notes         |
| --------------- | ---------- | ------------- |
| category_id     | PK         |               |
| name            | text       | Admin-defined |
| default_team_id | FK to Team,nullable |  null only for the "Other" category, which has no default team              |
| created_at      | timestamp  |               |

One Category row, named 'Other,' is a permanent fixture with default_team_id left null. Selecting it is what triggers the manual team picker in the submission flow, since the system can tell there's no default to fall back to.

**Priority:** a fixed, Admin-defined urgency level, each with its own default escalation window.

| Field             | Type     | Notes                                   |
| ----------------- | -------- | --------------------------------------- |
| priority_id       | PK       |                                         |
| name              | text     | Low, Normal, or Urgent                  |
| escalation_window | duration | default reminder cadence for this level |

**User:** a person known to the hub, layered on top of the identity the identity provider confirms.

| Field          | Type                               | Notes                                                                                   |
| -------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| user_id        | PK                                 |                                                                                         |
| idp_subject_id | unique                             | stable reference to the identity provider's identity, used for login, never for contact |
| email          | text                               | contact address for notifications, Admin-set                                            |
| phone          | text, nullable                     | optional, Admin-set                                                                     |
| role           | enum(employee, team_member, admin) | Admin-assigned, independent of the identity provider                                    |
| team_id        | FK to Team, nullable               | set only when role equals team_member                                                   |
| created_at     | timestamp                          |                                                                                         |

**Request:** the central entity, representing one submitted request from creation to resolution.

| Field          | Type                                        | Notes                                  |
| -------------- | ------------------------------------------- | -------------------------------------- |
| request_id     | PK                                          |                                        |
| requester_id   | FK to User                                  |                                        |
| category_id    | FK to Category                              |                                        |
| owning_team_id | FK to Team                                  | current owner, changes on reassignment |
| priority_id    | FK to Priority                              |                                        |
| status         | enum(New, In Progress, Resolved, Cancelled) |                                        |
| claimed_by     | FK to User, nullable                        | at most one at a time                  |
| subject        | short text                                  | shown in the limited misrouted view    |
| description    | text                                        |                                        |
| created_at     | timestamp                                   |                                        |
| updated_at     | timestamp                                   |                                        |

**Message:** a single entry in a request's conversation thread.

| Field      | Type          | Notes |
| ---------- | ------------- | ----- |
| message_id | PK            |       |
| request_id | FK to Request |       |
| sender_id  | FK to User    |       |
| body       | text          |       |
| created_at | timestamp     |       |

**Attachment:** a file tied to a request, optionally to a specific message.

| Field         | Type                    | Notes                                                              |
| ------------- | ----------------------- | ------------------------------------------------------------------ |
| attachment_id | PK                      |                                                                    |
| request_id    | FK to Request           | always set                                                         |
| message_id    | FK to Message, nullable | set only if attached alongside a message rather than at submission |
| uploader_id   | FK to User              |                                                                    |
| file_ref      | storage key or blob     | lives in the database, no separate file store                      |
| file_name     | text                    |                                                                    |
| content_type  | text                    |                                                                    |
| size_bytes    | integer                 |                                                                    |
| created_at    | timestamp               |                                                                    |

**RequestEvent:** an append-only entry in a request's timeline. It records status changes, claims, unclaims, reassignments, and escalation reminders sent.

| Field      | Type                                                                     | Notes                                                       |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| event_id   | PK                                                                       |                                                             |
| request_id | FK to Request                                                            |                                                             |
| event_type | enum(status_change, claimed, unclaimed, reassigned, escalation_reminder) |                                                             |
| actor_id   | FK to User, nullable                                                     | null for escalation_reminder, since no person triggers it   |
| from_value | text, nullable                                                           | for example the old status, or the old team on reassignment |
| to_value   | text, nullable                                                           | for example the new status, or the new team on reassignment |
| created_at | timestamp                                                                |                                                             |

**Silence:** records that one user has muted escalation reminders for one request.

| Field       | Type                         | Notes |
| ----------- | ---------------------------- | ----- |
| user_id     | FK to User (composite PK)    |       |
| request_id  | FK to Request (composite PK) |       |
| silenced_at | timestamp                    |       |

A row existing means that user currently has that request silenced. Un-silencing deletes the row.

**AccessLog:** records that a user opened a request's full details despite not owning it.

| Field       | Type          | Notes |
| ----------- | ------------- | ----- |
| access_id   | PK            |       |
| user_id     | FK to User    |       |
| request_id  | FK to Request |       |
| accessed_at | timestamp     |       |

Each access creates its own row, so the same user opening the same request more than once produces multiple entries rather than overwriting the first.

### 1.2 Relationships and cardinality

- A user can be the requester on many requests, though each request has exactly one requester. A team owns many requests, though each request has exactly one owning team at any given time. A user can belong to many teams, and a team can have many users as members, through TeamMembership. This is optional on both sides; an employee who never handles requests belongs to no team, and a team member is not limited to one team.

- A category applies to many requests, though each request has exactly one category. Each category has at most one default owning team, even though many categories can share the same default team. The one exception is the 'Other' category, which has no default team, which is what forces the requester to pick one manually. A priority level applies to many requests, though each request has exactly one priority.

- A request can have at most one current claimant, and that claimant is a single user. This is optional, since a request may not be claimed by anyone yet.

- A request can have many messages, though each message belongs to exactly one request. A user can send many messages, though each message has exactly one sender. A request can have many attachments, though each attachment belongs to exactly one request. An attachment can optionally belong to a specific message, but it always belongs to a request regardless.

- A request has many events in its timeline, though each event belongs to exactly one request. A user can be the actor behind many events, though this is optional, since some events, like an escalation reminder, aren't triggered by a person at all.

- A user can silence many requests, and a request can be silenced by many different users independently of each other. A user can appear in many access log entries, and a request can also appear in many access log entries.

### 1.3 Ownership

Every entity other than Team, Category, and Priority (which the Admin owns directly) traces back to exactly one request, and every request traces back to exactly one requester and one owning team at any point in time. Nothing is shared across requests except the Admin-defined reference data (Team, Category, Priority) and the User records that participate in many requests over time. No entity's meaning depends on more than one request.

---

## 2. Lifecycle and Rules

### 2.1 Request status transitions

A request starts in the New status. From there, the owning team can move it into In Progress, typically once someone on the team claims it, though claiming and changing the status are two separate actions. Once a request is claimed, only the claimant can move it forward, and only the owning team can ever move a request into the Resolved status, never the requester. Separately, while a request is still New or In Progress, the requester can move it into the Cancelled status themselves. Resolved and Cancelled are both terminal; nothing can move a request out of either status once it has reached one of them.

### 2.2 Claim invariant

At most one claimed_by value exists per request at any time. While claimed, only the claimant may change status, though the rest of the owning team retains read access and can see who holds the claim. Unclaiming clears claimed_by and re-triggers the same notification as a new request landing. Claiming itself writes a claimed event but does not notify anyone, since the queue view already reflects it live.

### 2.3 Reassignment

Any member of the current owning team can reassign a request to a different team. This updates owning_team_id and writes a reassigned event recording the old and new team, without touching status, claim state, or any existing message or attachment. There is no dedicated loop detection. The full reassignment trail is already visible through the request's own timeline to anyone with access to it, including the Admin.

### 2.4 Escalation

The escalation scheduler checks unclaimed New requests independently of how often it actually sends a reminder. A reminder for a given request only fires once that request's priority escalation window has elapsed since the most recent escalation reminder event for that request; there is no separate "last reminded" field on Request, since that value is read from the request's own timeline instead. Each reminder is sent to every member of the owning team except those with an active silence on that request. Claiming or reassigning a request clears that person's own silence automatically.

### 2.5 Editability

A request's subject and description can only be edited by the requester while the status is still New. Once any owning team action moves it out of New, the requester loses edit access to those fields, and messages become the only channel left for adding more information.

The same restriction applies to attachments. Whoever uploaded an attachment can edit or remove it only while the request is still New. Once the status moves to anything else, attachments become read only, including for the person who added them.

Messages follow a different restriction, tied to the terminal statuses rather than New. Neither the requester nor the owning team can send a new message once a request has reached Resolved or Cancelled.

### 2.6 Authorization boundaries

These rules are enforced on every read and write, not assumed from what any interface happens to show.

A requester may read and write only requests where they are the requester. A team member may read requests owned by any team they belong to, and may change a request's status only if they are the current claimant; an unclaimed request must be claimed first before its status can be moved. Messages and attachments carry no independent access rules of their own, they follow whatever request they belong to. The Admin may read every request, but by default sees only the limited fields (category, requester, created at, and subject) unless deliberately opening the full detail, the same limited view a misrouted receiving team sees. Silence records are only readable and writable by the user they belong to. Access log entries are written automatically whenever someone opens a request's full detail outside their normal ownership, and are readable only by the Admin.

### 2.7 Sensitive data rule

A request routed to the wrong team never exposes its description or attachments to the receiving team by default. Only the category, requester, created at, and subject are shown. Opening the full detail anyway is permitted but logged, not blocked, per the authorization boundaries and access log above.

---

## 3. Access

This section describes the real questions the product needs to answer, and how the data is shaped to answer them quickly.

The most common action in the system is a requester checking their own requests: finding every request where they are the requester, usually narrowed to a specific status, most recently updated first.

The highest traffic query overall is a team member loading their queue: finding every request owned by any team they belong to (via TeamMembership), usually narrowed by status, team, and sometimes category, since every team member checks this repeatedly throughout the day.

Opening a single request is a lookup by its id, followed immediately by an authorization check that decides whether the requester gets the full view or the limited view.

Reading a request's message thread means finding every message tied to that request, in the order they were sent.

Reading a request's timeline, its status changes, claims, unclaims, and reassignments, means finding every event tied to that request, in order. The same lookup is reused to find the most recent escalation reminder for a request.

The escalation scheduler periodically finds every request that is still New and unclaimed, then checks how long it has been since the last reminder, against that request's priority escalation window.

The Admin runs the same kind of search a team member does, but without being limited to one team, filtering across any combination of team, category, or status.

Checking whether a specific person has silenced a specific request is a quick lookup by that person and that request together, run once per candidate during each escalation sweep.

**Indexes**

Only indexes tied to one of the queries above are included; this system's volume doesn't call for indexing defensively.

* **Request, on owning team**: supports the team queue lookup, the highest frequency query in the system.
* **Request, on requester and status together**: supports the "my requests" lookup.
* **RequestEvent, on request, event type, and time together**: supports reading a full timeline in order, and quickly finding the most recent event of a given type, which the escalation logic depends on.
* **Message, on request and time together**: supports displaying a thread in order.
* **TeamMembership, on team**: supports notifying every member of a team when a new request lands. No separate index was added on user, since the composite primary key on (user, team) already covers lookups by user alone.

No index was added on category alone, since the Admin's cross-team search is infrequent enough that a full scan narrowed by the team and status indexes is sufficient. No full text index was added, since nothing in the requirements calls for free text search.

---

## 4. Storage

### Database type

The hub's system of record is a relational database. A short explanation: the data here is a tightly connected network, requests joined against teams, categories, and timelines, with rules like "at most one claimant" that must always hold, which a relational database enforces directly. The full reasoning, the options considered, and what this choice commits the system to are recorded in ADR-001, in the decisions folder.

### What is durable versus derived

Team, Category, Priority, User, the core Request fields, Message, Attachment, every RequestEvent row, Silence rows, and AccessLog rows are all durable. Each one is written once and kept as the actual record of what happened, and none of them can be reconstructed from anything else in the system if they were lost. A Message, for instance, only exists because someone wrote it, there's no other table that remembers its contents, so it has to be stored directly.

Two values work differently, though. Instead of being stored directly, they're worked out fresh every time they're needed.

The first is how long it's been since a request's last reminder. There's no field on Request that says "last reminded at this time." Instead, every time a reminder actually gets sent, that gets written down as its own row in the request's timeline, the RequestEvent table, with the time it happened. So whenever the system needs to know how long it's been, it just looks through that request's timeline, finds the most recent row that says "reminder sent," and checks its timestamp against right now. The answer is always calculated fresh from that one row, never stored anywhere else.

The second is whether a request is currently silenced for a specific person. There's no true or false flag sitting on the request saying "silenced: yes" or "silenced: no." Instead, the system just checks: is there a row in the Silence table for this exact person and this exact request? If a row exists, it's silenced for them. If it doesn't, it isn't. Silencing something means adding that row, un-silencing means deleting it, there's nothing else to keep track of separately.

The reason both work this way instead of being stored as their own fields, in both cases the real, original information is already sitting somewhere else, the timeline for reminders, the Silence table for muting. Adding a second field that just repeats that same information would mean two places that are supposed to agree with each other, and if they ever don't, because of a bug or a missed update, nothing would catch it. Always calculating the answer from the one real place it came from means there's nothing to fall out of sync in the first place.

The difference matters because a derived value can never disagree with the durable data it comes from, there's only ever one place holding the real answer. If the last-reminder time were also saved as its own field on Request, a bug or a missed update could leave that field claiming one thing while the RequestEvent table actually said another, and nothing would flag the mismatch. Keeping it derived means that situation simply can't happen, since the value is recalculated from the same source every time it's needed rather than copied and left to drift.
