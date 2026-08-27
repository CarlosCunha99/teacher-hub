# Impact analysis

## Direct changes

### New files (created from scratch)
- `prisma/schema.prisma` — defines `Resource` (stub: id, teacherId, title, createdAt), `Tag` (id, name, slug, teacherId, createdAt), and `ResourceTag` (join table) models; configures SQLite datasource with `env("DATABASE_URL")`
- `prisma/migrations/0001_init/migration.sql` — initial DDL for all three tables plus indexes on `Tag(teacherId)`, `Tag(teacherId, slug)` (unique), `ResourceTag(resourceId, tagId)` (unique)
- `prisma/migrations/migration_lock.toml` — Prisma migration lock (tracks provider = "sqlite")
- `src/lib/prisma.ts` — exports a singleton `PrismaClient` instance (global singleton pattern to prevent connection exhaustion in Next.js hot-reload)
- `src/lib/slug.ts` — exports `toSlug(name: string): string`; deterministic kebab-case slug with Unicode transliteration/normalisation; also validates non-empty input
- `src/app/api/tags/route.ts` — `GET` (list caller's tags, requires `X-Teacher-Id`), `POST` (create tag, requires `X-Teacher-Id` + `{ name }` body)
- `src/app/api/tags/[id]/route.ts` — `DELETE` (remove tag owned by caller + cascade-delete `ResourceTag` rows; requires `X-Teacher-Id`)
- `src/app/api/resources/route.ts` — `GET` (list/filter resources; accepts `?tags=slug1,slug2&mode=or|and`; publicly accessible); `POST` (create resource stub, requires `X-Teacher-Id`)
- `src/app/api/resources/[id]/tags/route.ts` — `POST` (attach tag to resource, requires ownership of both; `X-Teacher-Id`), `DELETE` (detach tag; requires ownership; `X-Teacher-Id`)
- `src/app/api/tags/__tests__/route.test.ts` — Vitest tests for `GET /api/tags` and `POST /api/tags` (happy path, empty-name validation, auth missing, cross-teacher isolation)
- `src/app/api/tags/[id]/__tests__/route.test.ts` — Vitest tests for `DELETE /api/tags/[id]` (happy path, not-found, wrong owner, auth missing, cascade verification)
- `src/app/api/resources/__tests__/route.test.ts` — Vitest tests for `GET /api/resources` (no filter, OR filter, AND filter, unknown slug returns empty, compose with no tags)
- `src/app/api/resources/[id]/tags/__tests__/route.test.ts` — Vitest tests for attach/detach (happy path, idempotent attach, tag not owned, resource not owned, auth missing, detach not attached)

### Modified files
- `package.json` — add `@prisma/client` to `dependencies`; add `prisma` to `devDependencies`; add scripts: `"db:generate": "prisma generate"`, `"db:migrate": "prisma migrate dev"`, `"db:migrate:deploy": "prisma migrate deploy"`; optionally add `"postinstall": "prisma generate"` to ensure client is generated after `npm install`
- `.env.example` — uncomment/update `DATABASE_URL` line to `DATABASE_URL=file:./prisma/dev.db` (SQLite dev default); add comment explaining PostgreSQL swap for production
- `.gitignore` — add `prisma/dev.db`, `prisma/dev.db-journal`, and `prisma/*.db` to ignore SQLite database files
- `README.md` — add "Database" section documenting: Prisma setup, `DATABASE_URL` env var (SQLite dev vs PostgreSQL prod), `npx prisma migrate dev` to apply migrations locally, `npx prisma generate` for client generation, and updated "Getting started" step referencing db setup

## Indirect: callers & consumers

- `src/app/api/health/route.ts` — impact: **none** (health route is intentionally database-free; no change required)
- `src/app/api/health/__tests__/route.test.ts` — impact: **none** (existing "works without DATABASE_URL" test continues to pass; health route does not import Prisma)
- `src/__tests__/scripts.test.ts` — impact: **behavior-change** — the `npm run build` test runs `next build`; if `@prisma/client` is imported by any route and the Prisma client has not been generated first (`prisma generate`), the build will fail. Mitigation: add `"postinstall": "prisma generate"` to `package.json` so `npm install` auto-generates the client; the test passes `npm install` implicitly in CI before running
- `src/__tests__/typescript.test.ts` — impact: **behavior-change** — `tsc --noEmit` will fail if generated Prisma types (`node_modules/.prisma/client`) do not exist. Same mitigation as above (postinstall hook)
- `src/__tests__/env-config.test.ts` — impact: **none** — the test already passes with `.env.example` having `APP_ENV=development`; adding `DATABASE_URL` only strengthens the "contains at least one variable key" assertion
- `src/__tests__/gitignore.test.ts` — impact: **none** — existing assertions remain valid; new `*.db` entries do not conflict
- `src/__tests__/readme.test.ts` — impact: **none** — existing assertions (npm install, npm run dev, folder structure, env config) remain satisfied; new "Database" section in README only adds content

## Public API surface

- Exported: `GET /api/tags` in `src/app/api/tags/route.ts` — new route, no prior consumers
- Exported: `POST /api/tags` in `src/app/api/tags/route.ts` — new route, no prior consumers
- Exported: `DELETE /api/tags/[id]` in `src/app/api/tags/[id]/route.ts` — new route, no prior consumers
- Exported: `GET /api/resources` in `src/app/api/resources/route.ts` — new route; accepts optional `?tags` and `?mode` query params; no filter = returns all resources (backward-compatible baseline)
- Exported: `POST /api/resources` in `src/app/api/resources/route.ts` — new route (resource stub creation), no prior consumers
- Exported: `POST /api/resources/[id]/tags` in `src/app/api/resources/[id]/tags/route.ts` — new route, no prior consumers
- Exported: `DELETE /api/resources/[id]/tags` in `src/app/api/resources/[id]/tags/route.ts` — new route, no prior consumers
- Exported: `toSlug` in `src/lib/slug.ts` — new internal utility; not a public HTTP surface but exported for reuse and direct unit testing
- Exported: `prisma` (default) in `src/lib/prisma.ts` — new singleton; internal only, no external consumers at this stage

## Tests affected

- `src/app/api/tags/__tests__/route.test.ts` — **new**; covers `GET /api/tags` and `POST /api/tags`
- `src/app/api/tags/[id]/__tests__/route.test.ts` — **new**; covers `DELETE /api/tags/[id]`
- `src/app/api/resources/__tests__/route.test.ts` — **new**; covers `GET /api/resources` with tag filter permutations
- `src/app/api/resources/[id]/tags/__tests__/route.test.ts` — **new**; covers tag attach/detach
- `src/__tests__/scripts.test.ts` — **indirectly affected**; `npm run build` step requires Prisma client to be generated; passes only if `postinstall` hook is in place
- `src/__tests__/typescript.test.ts` — **indirectly affected**; `tsc --noEmit` requires generated Prisma types in `node_modules/.prisma/client`
- `src/app/api/health/__tests__/route.test.ts` — **not affected** (no Prisma import in health route)

## Docs to update

- `README.md` — add "Database" section: how to set `DATABASE_URL`, run `npx prisma migrate dev` for local dev, run `npx prisma generate` after cloning; update "Getting started" to include a db-setup step between `npm install` and `npm run dev`
- `.env.example` — update `DATABASE_URL` comment to a usable SQLite dev default (`file:./prisma/dev.db`) with a note on swapping to a PostgreSQL URL in production
- `src/app/api/tags/route.ts` (JSDoc) — document `X-Teacher-Id` header requirement, `OR`/`AND` filter semantics, slug collision behaviour
- `src/app/api/resources/route.ts` (JSDoc) — document `?tags` (comma-separated slugs), `?mode=or|and` (default `or`), composition with future subject/year filters

## Migrations / config / infra

- `prisma/schema.prisma` — new Prisma schema; defines provider `sqlite` (dev) / `postgresql` (prod via env var swap)
- `prisma/migrations/0001_init/migration.sql` — initial DDL migration; creates `Resource`, `Tag`, `ResourceTag` tables and indexes
- `prisma/migrations/migration_lock.toml` — Prisma migration lock file; must be committed
- `DATABASE_URL` env var — **new required env var**; dev value: `file:./prisma/dev.db`; prod value: PostgreSQL connection string; must be set before `prisma migrate deploy` and before starting the Next.js server in any environment that uses tag/resource routes
- `package.json` `postinstall` script — `prisma generate`; ensures `@prisma/client` types are generated after `npm install` in CI and local environments
- `package.json` `db:generate` script — `prisma generate` (manual regeneration)
- `package.json` `db:migrate` script — `prisma migrate dev` (local dev migration)
- `package.json` `db:migrate:deploy` script — `prisma migrate deploy` (production/CI migration)
- `.gitignore` additions — `prisma/dev.db`, `prisma/dev.db-journal`, `prisma/*.db` to prevent SQLite database file from being committed

## External systems

- **SQLite (local/CI)** — new; a local file-based SQLite database at `prisma/dev.db` (path governed by `DATABASE_URL`). Created automatically on first `prisma migrate dev`. No external service required for dev/CI.
- **PostgreSQL (production)** — new dependency at deploy time; schema is Prisma-managed; deploy pipeline must run `prisma migrate deploy` before starting the server. No code changes required beyond swapping `DATABASE_URL` to a PostgreSQL connection string; Prisma abstracts dialect differences.
- **No queue/cache/other service** — this feature does not touch Redis, message queues, CDN, or any third-party API.

## Estimated diff size

- Files touched: **16** (12 new, 4 modified)
- Rough lines changed: **~520** (≈380 added across new source + test files, ≈80 added across new schema + migration, ≈60 added/modified across package.json, .env.example, .gitignore, README.md)
- Confidence: **medium** (counts are estimates; test file size depends on number of cases written per AC; migration SQL size depends on index choices)

## Warnings

- **Prisma client generation gate for existing CI tests:** `src/__tests__/scripts.test.ts` (build) and `src/__tests__/typescript.test.ts` (tsc) will fail in a clean checkout if Prisma client has not been generated. A `"postinstall": "prisma generate"` script in `package.json` is the canonical fix; without it, any CI pipeline that runs `npm ci` followed immediately by `npm test` will see TypeScript compilation errors from missing `@prisma/client` types.
- **`X-Teacher-Id` stub auth is not real auth:** the authentication mechanism is a plain request header. In any deployed environment (including preview/staging), this is trivially spoofable. The solution acknowledges this and defers to issue #2, but it must not land on a public URL without a note in docs warning that tag/resource endpoints require proper auth before production exposure.
- **SQLite → PostgreSQL silent differences:** Prisma abstracts most dialect differences, but SQLite does not enforce foreign-key constraints by default (requires `PRAGMA foreign_keys = ON`). If cascade behaviour is tested against SQLite and then relied upon in PostgreSQL, behaviour should be confirmed to be consistent. Prisma's `onDelete: Cascade` directive is applied at the Prisma level and should handle this, but it is worth an explicit test.
- **`Resource` stub will conflict with issue #5 schema:** the minimal `Resource` model (id, teacherId, title, createdAt) introduced here will need to be extended (subject, yearLevel) when issue #5 lands. The Prisma migration approach handles additive changes cleanly, but the issue #5 implementer must be aware of the existing `Resource` table and migration history.
- **No slug uniqueness collision strategy is confirmed:** the ticket notes that two tags with collision-producing names should be "rejected or disambiguated in a documented way." The solution must pick one (reject with 409 is the simpler choice); whichever is chosen must be reflected in tests and API docs.
- **No pagination on list endpoints:** `GET /api/tags` and `GET /api/resources` return unbounded result sets. Acceptable at MVP scale but must not be forgotten for production readiness.
