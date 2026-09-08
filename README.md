# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Employees submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox. This replaces those informal channels with one system of record.

## Status: v0.2, Requests Lifecycle Backend (mock data, no auth)

The product definition, system architecture, and data model are complete. The request lifecycle (creating, claiming, updating, cancelling, reassigning, and changing the priority of a request, plus its event history and access log) is now implemented as a working backend API. It runs against mock JSON data instead of a real database, and there is no authentication or authorization wired up yet. See `backend/README.md` for setup and the full endpoint list.

Everything outside the request lifecycle (user, category, priority, and team management, escalation reminders, notifications, a real database, real auth, and any frontend) is still design only or not yet started. See "What's not built yet" below.

## Where to start

Read the docs in this order, each one builds on the last:

1. `docs/product-spec.md`, what the system needs to do and why, written for anyone regardless of technical background.
2. `docs/architecture.md`, how the system is structured to meet that spec, its components, data flows, failure handling, and the reasoning behind the major design choices.
3. `docs/data-model.md`, what the system actually stores, how the pieces relate to each other, and how the real queries get answered.
4. `docs/decisions/ADR-001.md`, a deeper look at one specific decision, why the data lives in a relational database rather than a document store.
5. `backend/README.md`, how to run the current backend, its full endpoint list, and its current limitations.
6. `backend/docs/agentic-workflow.md`, the implementation level rules for the requests feature specifically, written for extending or debugging the code, not for a first read of the product.

## What's done

A complete product spec: the problem, the actors, functional requirements, non functional requirements, and acceptance criteria.

A complete architecture: components, external dependencies, data flows, authorization boundaries, and failure handling.

A complete data model: entities, relationships, lifecycle rules, real access patterns, and justified indexes.

One fully reasoned architecture decision record, covering the choice of database.

A working backend for the request lifecycle: create, view (list, limited detail, full detail), claim, unclaim, change status, cancel, reassign, and change priority, backed by an event history and an access log, running on mock JSON data.

## What's not built yet

No frontend. The backend is API only, tested with Postman.

No database actually running, deployed, or seeded. The schema described in the data model has not been created anywhere. The backend currently persists to flat JSON files as a stand in, structured so the database described in the data model can be dropped in later without changing the service or controller layer.

No authentication or authorization. Some actions currently accept a manually supplied `actorId`, used only to record who did what, not to grant or deny access.

No admin management of users, categories, priorities, or teams. That reference data is currently fixed, seeded JSON.

No escalation reminders, per user silencing, or notifications. These are described in the product spec but not implemented.

No CI/CD or production infrastructure.
