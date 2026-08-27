# Implementation plan

## Goal
Add persistent teacher-scoped custom tags and resource tag filtering to the API using Prisma-backed storage and Next.js App Router route handlers.

## Approach
Introduce Prisma as the persistence layer with a minimal schema that is just large enough for this feature: teacher-owned `Tag` records, a stub `Resource` owned by a teacher, and a `ResourceTag` join table for many-to-many assignment. Keep the datasource driven by `DATABASE_URL` so local/CI can use SQLite while production swaps to PostgreSQL without changing the API.

Keep the API surface narrow and explicit. Management endpoints require the temporary `X-Teacher-Id` header, while resource listing stays readable without auth and accepts `tags` plus `mode=or|and` query params. Slugs should be derived from trimmed names with deterministic kebab-case normalization and enforced as unique per teacher.

Wire the feature through shared infrastructure rather than per-route duplication: add package scripts and env/docs updates for Prisma, create a reusable Prisma client singleton, centralize slug generation, and make route handlers return stable validation/auth/authorization errors. Leave room for future subject/year filters by building resource-list query composition around additive `where` clauses.

## Steps
1. **Add Prisma tooling and runtime config** — Update `package.json` with `prisma` and `@prisma/client`, add generate/migrate scripts plus `postinstall`, and update `.env.example`, `.gitignore`, and `README.md` so local setup, generated client behavior, and SQLite dev files are documented. Depends on: none.
2. **Define the database schema and generate the initial migration** — Create `prisma/schema.prisma` with `Resource`, `Tag`, and `ResourceTag`; add teacher ownership fields, timestamps, composite uniqueness on `(teacherId, slug)` and `(resourceId, tagId)`, and cascading join cleanup; then generate and commit the initial migration files under `prisma/migrations/`. Depends on: 1.
3. **Create shared server utilities** — Add `src/lib/prisma.ts` for a Next.js-safe singleton `PrismaClient`, and add `src/lib/slug.ts` to trim input, reject blank names, normalize Unicode, collapse separators to kebab-case, and return deterministic slugs that route handlers can reuse before persistence. Depends on: 2.
4. **Implement tag management endpoints** — Build `src/app/api/tags/route.ts` for authenticated tag listing and creation, and `src/app/api/tags/[id]/route.ts` for authenticated deletion. Enforce `X-Teacher-Id`, return only the caller’s tags, reject blank names, reject same-teacher slug collisions with a documented conflict response, and delete owned tags so join rows are removed automatically. Depends on: 3.
5. **Implement resource creation and filtered listing** — Build `src/app/api/resources/route.ts` with authenticated creation of the minimal resource stub and public `GET` listing. Parse `tags=slug1,slug2` and `mode=or|and`, default to OR, and translate each mode into Prisma relation filters so unknown slugs naturally yield empty matches without widening results. Depends on: 3.
6. **Implement resource-tag assignment endpoints** — Build `src/app/api/resources/[id]/tags/route.ts` for authenticated attach/detach operations. Verify the caller owns both the resource and the tag, make attach idempotent via the join-table uniqueness constraint, and make detach remove only the targeted association with clear not-found/forbidden behavior. Depends on: 4, 5.
7. **Wire and harden the feature surface** — Ensure route responses are JSON and consistent, confirm generated Prisma client imports resolve in the app/build pipeline, and document the temporary auth header plus tag-filter contract in the API-facing docs/comments so future subject/year filters can compose without changing current semantics. Depends on: 4, 5, 6.

## Files
### Create
- `prisma/schema.prisma` — Prisma datasource/generator config and the `Resource`, `Tag`, and `ResourceTag` models.
- `prisma/migrations/0001_init/migration.sql` — initial SQL for the three tables, constraints, and indexes.
- `prisma/migrations/migration_lock.toml` — Prisma migration lock file for the SQLite-backed initial migration.
- `src/lib/prisma.ts` — shared Prisma client singleton for route handlers.
- `src/lib/slug.ts` — deterministic tag-name normalization and slug generation utility.
- `src/app/api/tags/route.ts` — list/create teacher-owned tags.
- `src/app/api/tags/[id]/route.ts` — delete a teacher-owned tag.
- `src/app/api/resources/route.ts` — create resources and list/filter resources by tag slugs.
- `src/app/api/resources/[id]/tags/route.ts` — attach and detach tags on owned resources.

### Modify
- `package.json` — add Prisma dependencies and db lifecycle scripts.
- `.env.example` — define the dev `DATABASE_URL` shape and production swap note.
- `.gitignore` — ignore local SQLite database artifacts.
- `README.md` — document Prisma setup, migration flow, and the temporary auth/filter contract for API consumers.

## Data / schema / migration
Add a first Prisma schema with `Resource`, `Tag`, and `ResourceTag`. `Tag.slug` must be unique per teacher via `(teacherId, slug)`, and the join table must prevent duplicates via `(resourceId, tagId)`. Foreign keys from `ResourceTag` should cascade on resource or tag deletion so associations clean up automatically. The migration is additive and becomes the baseline for later resource-schema expansion; backward compatibility is preserved because all routes are new.

## Rollout
- Feature flag? no
- Backfill? no
- Ordering: install dependencies and generate the Prisma client before build/test runs; apply the migration before starting the server in any environment, and run `prisma migrate deploy` before exposing the new routes in production.

## Assumptions and non-decisions
- `X-Teacher-Id` is the temporary authentication source until real auth lands.
- Multi-tag filtering defaults to OR; `mode=and` is the stable opt-in for intersection behavior.
- Slug collisions for the same teacher are rejected with a conflict response rather than auto-suffixed.
- Subject/year taxonomy fields are not present yet, but the resource query should be structured so future filters can be appended cleanly.

## Not doing
- Frontend UI for creating, assigning, or browsing custom tags.
- Real authentication/session management beyond the header stub.
- Tag rename/merge/search/autocomplete, pagination, or analytics.
- The standard subject/year taxonomy implementation itself.
