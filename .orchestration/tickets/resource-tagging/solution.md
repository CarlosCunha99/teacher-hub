# Solution: Teacher-scoped custom tags with Prisma + SQLite

## Direction

We are building an API-only custom tagging layer for Teacher Hub resources. Tags are
scoped to the teacher who creates them — no shared global namespace. Each tag has a
name, a deterministic kebab-case slug, an owner (teacher), and a creation timestamp.

Persistence is handled through Prisma with SQLite as the dev/CI database, configured
to point at PostgreSQL in production via a single environment variable swap. The schema
introduces a minimal `Resource` stub (id, teacherId, title, createdAt) sufficient for
tags to attach to, alongside a `Tag` model and a many-to-many `ResourceTag` join.

Authentication is stubbed via an `X-Teacher-Id` request header that injects a teacher
identity into request context. Real auth wiring follows once issue #2 lands. The API
surface follows Next.js App Router route-handler conventions already present in the
codebase.

The delivered API surface covers full CRUD on tags, attach/detach of tags to owned
resources, and a resource-filter endpoint that supports both OR and AND tag-slug
semantics. No pagination, tag search, or UI components are in scope.

## Key decisions

- Decided teacher-scoped tags (not global) because global tags create name pollution
  and ambiguous delete semantics, and the ticket ACs explicitly forbid a shared namespace.
- Decided Prisma + SQLite (dev/CI) → PostgreSQL (prod) because it matches the project's
  stated persistence target (issue #3) and keeps CI self-contained without a Postgres
  container.
- Decided a minimal Resource stub (id, teacherId, title, createdAt) rather than the full
  entity because subject/yearLevel fields belong to issue #5 and are out of scope here.
- Decided API-only (no UI) because the ticket explicitly defers frontend wiring to a
  separate ticket.
- Decided OR as the default multi-tag filter mode (broader discovery), with an explicit
  switch to AND, to be documented in the API.

## Explicitly rejected

- Global tags with per-teacher attribution — rejected due to name pollution and silent
  delete side-effects on other teachers' resources.
- JSON file store instead of Prisma — rejected because it cannot safely target
  PostgreSQL in production and is inconsistent with issue #3.
- Full Resource model in this ticket — rejected as out of scope; subject/yearLevel
  tagging belongs to issue #5.

## Open questions

- None.
