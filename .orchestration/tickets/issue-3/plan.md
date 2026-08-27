# Implementation plan

## Goal

A committed Prisma + PostgreSQL data layer — schema, initial migration, seed fixtures, a
shared client module, and developer/DAL documentation — that any downstream MVP issue
(#4–#8) can build on without redesign, and that leaves `npm run lint`, `npm test`, and
`npm run build` green without a live database.

## Approach

The repo today is a bare Next.js 15 / TypeScript / Vitest skeleton with no persistence.
We add Prisma as the single source of truth: one `prisma/schema.prisma` describing
Teacher, Resource, Subject, YearLevel, Board, BoardItem and Like, with referential
integrity and uniqueness enforced by PostgreSQL rather than by application code. Per the
ticket's ambiguity resolutions: this ticket owns the user/teacher entity (no password
column, with a linked social-identity table), resource↔subject and resource↔year-level are
many-to-many join tables, and a "save" **is** a board item (no separate bookmark list).
Boards carry a visibility attribute; resources carry publication state and soft-delete
(`deletedAt`); downloads and terms acceptance are not modelled.

Ordering is: tooling first (deps, scripts, env, client singleton), then schema, then the
generated migration, then seed data, then docs. Prisma client generation must be wired
into `postinstall` so `npm run build` and the existing `scripts.test.ts` (which shells out
to `next build`) keep working on a machine with no database — generation reads only the
schema file, never the DB. Nothing in the default `npm test` path may open a connection.

Migrations are produced with `npx prisma migrate dev --name init` against a throwaway local
Postgres and committed under `prisma/migrations/`; the SQL is reviewed by hand to confirm
foreign keys, unique compound indexes and performance indexes landed as intended. Seeding
is deterministic (fixed IDs/slug keys, upsert-based) so it can be re-run idempotently, and
is invoked only through `npm run db:seed` / `prisma db seed`.

## Steps

1. **Add Prisma tooling and scripts** — add `@prisma/client` (dependency), `prisma` and
   `tsx` (devDependencies) to `package.json`; add scripts `prisma:generate`,
   `db:migrate` (`prisma migrate dev`), `db:migrate:deploy`, `db:seed`, `db:reset`, and a
   `postinstall` running `prisma generate`; add the `"prisma": { "seed": "tsx prisma/seed.ts" }`
   block. Add `/prisma/migrations/` and `src/generated/` (if used) to `.prettierignore` so
   `format:check` stays green. Depends on: none.
2. **Document the connection string** — uncomment and annotate `DATABASE_URL` in
   `.env.example` with the `postgresql://user:password@host:port/dbname` format and a
   placeholder-only value; keep the "no secrets" convention. Depends on: none.
3. **Define the schema** — create `prisma/schema.prisma` (postgresql datasource from
   `env("DATABASE_URL")`, `prisma-client-js` generator) with models: `Teacher`
   (id, email unique, displayName, bio?, avatarUrl?, createdAt, updatedAt),
   `Identity` (provider enum Google/Microsoft + providerAccountId, unique compound, FK to
   Teacher, cascade), `Resource` (title, description, fileUrl/fileKey, ownerId FK,
   status enum DRAFT/PUBLISHED, createdAt, updatedAt, deletedAt?), `Subject` and
   `YearLevel` (slug unique, name, sortOrder), join models `ResourceSubject` and
   `ResourceYearLevel` (compound PK, cascade), `Board` (ownerId FK, name, description?,
   visibility enum PRIVATE/PUBLIC, createdAt), `BoardItem` (boardId + resourceId unique
   compound, createdAt), `Like` (teacherId + resourceId unique compound, createdAt).
   Depends on: step 1.
4. **Add indexes and delete semantics** — in the same file, add `@@index` entries for
   `Resource(ownerId, createdAt)`, `Resource(status, createdAt)`, `Resource(deletedAt)`,
   `ResourceSubject(subjectId)`, `ResourceYearLevel(yearLevelId)`, `BoardItem(boardId, createdAt)`,
   `Like(resourceId)`, `Board(ownerId)`; set `onDelete: Cascade` for teacher-owned and
   join rows, `Restrict` where a taxonomy row is referenced. Depends on: step 3.
5. **Add the Prisma client singleton** — create `src/lib/db.ts` exporting a `prisma`
   instance reusing a `globalThis` cached client in non-production to survive Next.js hot
   reload; no top-level connection or query. Depends on: steps 1, 3.
6. **Generate and commit the initial migration** — run `npx prisma migrate dev --name init`
   against a local Postgres; commit `prisma/migrations/<timestamp>_init/migration.sql` and
   `prisma/migrations/migration_lock.toml`. Manually verify the SQL contains every FK,
   unique constraint and index from steps 3–4, and confirm `prisma migrate reset` applies
   cleanly from empty. Depends on: step 4.
7. **Checkpoint** — after step 6, verify `npm install` (postinstall generate), `npm run lint`,
   `npm run format:check` and `npm run build` all pass with **no** `DATABASE_URL` set,
   before writing seed or docs. If generation requires a URL, fix it here.
8. **Seed the taxonomy** — start `prisma/seed.ts` with idempotent `upsert` of the fixed
   subject and year-level reference data (≥3 subjects, ≥3 year levels), keyed by slug.
   Depends on: steps 1, 6.
9. **Seed teachers, resources, boards, likes** — extend `prisma/seed.ts` with ~5 teachers
   (each with one identity), ~20 published resources spread across subjects and year
   levels (including at least one multi-subject and one multi-year-level resource, one
   draft, one soft-deleted), 5–10 boards of mixed visibility with board items, and 20–50
   likes. Deterministic ids, safe to re-run. Depends on: step 8.
10. **Write the DAL guide** — create `docs/DATABASE.md`: entity/cardinality overview,
    the `import { prisma } from "@/lib/db"` convention, worked query patterns for feed
    ordering, subject+year-level filtering, keyword search (`contains`, `mode: "insensitive"`),
    profile lookups and counts (`_count`), plus documented soft-delete/cascade rules and a
    note on taxonomy evolution. Depends on: steps 4, 5.
11. **Update the README** — add a "Database setup" section (PostgreSQL 14+, `.env.local`
    `DATABASE_URL`, `npm run db:migrate`, `npm run db:seed`, `npm run db:reset`), extend
    the scripts table with the new scripts, add `prisma/` and `docs/` to the folder-structure
    table, and link `docs/DATABASE.md`. Depends on: steps 1, 10.
12. **Final verification** — run `npm run lint`, `npm run format:check`, `npm test`,
    `npm run build` with no database, then separately run migrate + seed against a local
    Postgres and confirm the fixtures land. Depends on: all above.

## Files

### Create

- `prisma/schema.prisma` — datasource, generator, all MVP models, indexes, constraints.
- `prisma/migrations/<timestamp>_init/migration.sql` — generated initial DDL.
- `prisma/migrations/migration_lock.toml` — provider lock.
- `prisma/seed.ts` — deterministic fixture seeding.
- `src/lib/db.ts` — Prisma client singleton.
- `docs/DATABASE.md` — DAL conventions and query patterns.

### Modify

- `package.json` — Prisma deps, db scripts, `postinstall`, `prisma.seed` config.
- `.env.example` — uncomment/document `DATABASE_URL`.
- `.prettierignore` — exclude generated migration SQL / generated client.
- `README.md` — database setup section, scripts table, folder structure.

### Delete

- None.

## Data / schema / migration

Greenfield: one `init` migration creating all tables from empty. No backward-compatibility
concerns since no data exists. `prisma migrate reset` is the documented rollback for local
and QA; production deploy uses `prisma migrate deploy`.

## Rollout

- Feature flag? No — additive foundation with no runtime callers yet.
- Backfill? No — no existing data.
- Ordering: `prisma generate` must run on install (`postinstall`) so build/test work
  without a database; `prisma migrate deploy` must run before any future DB-backed test or
  runtime path. No CI workflow file exists yet, so CI wiring is out of scope.

## Assumptions and non-decisions

- Ambiguity resolutions taken as settled: A1 this ticket owns Teacher (no password,
  separate `Identity` rows), A2 many-to-many subjects and year levels, A3 a save is a board
  item, A4 downloads/terms deferred, A5 boards carry visibility.
- Exact enum member names, id strategy (`cuid()` vs `uuid()`), and field naming
  (`@map`/`@@map` to snake_case or leave Prisma defaults) are the coder's judgment — just be
  internally consistent and document the choice in `docs/DATABASE.md`.
- `tsx` is assumed as the seed runner; any equivalent TS runner is acceptable if it keeps
  `npm test` DB-free.
- Existing tests may gain assertions from the parallel test plan; do not pre-empt them.

## Not doing

- No CI workflow file, Docker Compose, or hosted database provisioning.
- No API routes, UI, or auth/session logic (#2, #4–#8).
- No `downloads` or `terms_acceptance` tables (#11, #12).
- No GIN/tsvector full-text search indexes (Phase 2 #17) — `contains` search only.
- No changes to `src/app/api/health/route.ts`; it stays database-free.
