# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Employees submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox. This replaces those informal channels with one system of record.

## Status: v0.2, Requests Lifecycle Backend (mock data, no auth)

The product definition, system architecture, and data model are complete. The **request lifecycle**, creating, claiming, updating, cancelling, reassigning, and changing the priority of a request, plus its event history and access logging, is now implemented as a working backend API, running against mock JSON data rather than a real database, with no authentication wired up yet. See [`backend/README.md`](backend/README.md) for setup and the full endpoint list.

Everything outside the request lifecycle (user/category/priority/team management, escalation reminders, notifications, a real database, real auth, and any frontend) is still design-only or not yet started, see "What's not built yet" below.

## Where to start

Read the docs in this order, each one builds on the last:

1. [`docs/product-spec.md`](docs/product-spec.md), what the system needs to do and why, written for anyone regardless of technical background.
2. [`docs/architecture.md`](docs/architecture.md), how the system is structured to meet that spec, its components, data flows, failure handling, and the reasoning behind the major design choices.
3. [`docs/data-model.md`](docs/data-model.md), what the system actually stores, how the pieces relate to each other, and how the real queries get answered.
4. [`docs/decisions/ADR-001.md`](docs/decisions/ADR-001.md), a deeper look at one specific decision, why the data lives in a relational database rather than a document store.
5. [`backend/README.md`](backend/README.md), how to run the current backend, its full endpoint list, and its current mock-data/no-auth limitations.
6. [`backend/docs/agentic-workflow.md`](backend/docs/agentic-workflow.md), the implementation-level rules and boundaries for the requests feature specifically, written for extending or debugging the code, not for a first read of the product.

## What's done

- A complete product spec: the problem, the actors, functional requirements, non-functional requirements, and acceptance criteria.
- A complete architecture: components, external dependencies, data flows, authorization boundaries, and failure handling.
- A complete data model: entities, relationships, lifecycle rules, real access patterns, and justified indexes.
- One fully reasoned architecture decision record, covering the choice of database.
- A working backend for the request lifecycle: create, view (list/limited/full detail), claim, unclaim, change status, cancel, reassign, and change priority, each enforcing the access and workflow rules from the spec, backed by an event history and an access log, running on mock JSON data.

## What's not built yet

- No frontend, the backend is API-only, tested via Postman.
- No database actually running, deployed, or seeded, the schema described in the data model hasn't been created anywhere; the backend currently persists to flat JSON files as a stand-in, structured so the database described in the data model can be dropped in later without changing the service/controller layer.
- No authentication actually wired up to a real identity provider, the backend currently accepts a manually supplied `actorId` in place of a verified identity.
- No admin management of users, categories, priorities, or teams, that reference data is currently fixed, seeded JSON.
- No escalation reminders, per-user silencing, or notifications, these are described in the product spec but not implemented.
- No CI/CD or production infrastructure.
