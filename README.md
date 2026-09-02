# Internal Operations Service Hub

A single, trackable entry point for internal employee requests, starting with IT and HR. Employees submit a request once, it lands automatically with the right team, and nothing gets lost in DMs, hallway conversations, or the wrong inbox. This replaces those informal channels with one system of record.

## Status: v0.1, Product Foundation

This repository currently contains the product definition, the system architecture, and the data model. There is no working application yet, this is the design the implementation will be built from.

## Where to start

Read the docs in this order, each one builds on the last:

1. [`docs/product-spec.md`](docs/product-spec.md), what the system needs to do and why, written for anyone regardless of technical background.
2. [`docs/architecture.md`](docs/architecture.md), how the system is structured to meet that spec, its components, data flows, failure handling, and the reasoning behind the major design choices.
3. [`docs/data-model.md`](docs/data-model.md), what the system actually stores, how the pieces relate to each other, and how the real queries get answered.
4. [`docs/decisions/ADR-001.md`](docs/decisions/ADR-001.md), a deeper look at one specific decision, why the data lives in a relational database rather than a document store.

## What's done

- A complete product spec: the problem, the actors, functional requirements, non-functional requirements, and acceptance criteria.
- A complete architecture: components, external dependencies, data flows, authorization boundaries, and failure handling.
- A complete data model: entities, relationships, lifecycle rules, real access patterns, and justified indexes.
- One fully reasoned architecture decision record, covering the choice of database.

## What's not built yet

- No working frontend or backend, this is the design, not the implementation.
- No database actually running, deployed, or seeded, the schema described in the data model hasn't been created anywhere.
- No CI/CD or production infrastructure.
- No authentication actually wired up to a real identity provider.
