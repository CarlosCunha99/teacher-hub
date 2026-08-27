# Impact analysis — Issue #3 (PostgreSQL schema + Prisma MVP)

## Direct changes

- **`prisma/schema.prisma`** — New file (~200–300 lines). Defines 7–9 entities: Teacher (users), Resource, Subject, YearLevel, Board, BoardItem (saved resources), Like. Includes relationships, indexes on access patterns, and database constraints (foreign keys, unique compound keys for likes and board items).

- **`prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql`** — Auto-generated migration file. Creates all tables, foreign keys, unique indexes, and performance indexes.

- **`prisma/seed.ts`** — New file (~200–300 lines). Deterministic fixture script populating 5–10 teachers, ~20 resources across 3 subjects × 3 year levels, 5–10 boards with varied contents, and 20–50 likes. Runs only locally and in QA via `npm run db:seed` (or similar).

- **`docs/DATABASE.md`** — New file (~150–250 lines). DAL guide documenting: entity roles, relationship cardinality, query patterns for feed ordering, subject/year-level filtering, keyword search, and profile lookups. Explicitly covers soft-delete semantics for resources and cascade behavior for other entities.

- **`package.json`** — Updated to add:
  - New dependencies: `@prisma/client` (production), `prisma` (dev)
  - New scripts: `prisma:generate`, `prisma:migrate`, `prisma:migrate:dev`, `prisma:seed`, `db:push` (for rapid iteration)
  - Possibly: `db:reset` to drop + recreate + reseed in dev

- **`.env.example`** — Updated to uncomment and document:
  - `DATABASE_URL=postgresql://user:password@localhost:5432/teacher_hub` (with placeholder values and format guidance)
  - Possibly `DATABASE_URL_MIGRATION` if separate credentials needed for migrations

- **`.gitignore`** — May need to add:
  - `prisma/.env*` if Prisma uses separate env files (already covered by existing `.env*.local` rule, but may clarify)
  - Generally: no changes needed; migrations are committed, `.env.local` is already gitignored

- **`tsconfig.json`** — No changes required; existing `@/*` path alias supports `src/lib/db.ts` or similar

- **`next.config.ts`** — No changes required; Prisma client initialization can happen in `src/lib/db.ts` without next.config modification

## Indirect: callers & consumers

- **All future API routes (#4–#8 issues)** will import and use Prisma client (e.g., `import { prisma } from "@/lib/db"`). New files created by this ticket:
  - `src/lib/db.ts` (or similar) — Exports singleton Prisma client instance, may include type helpers
  - Will be **compile-time safe** for all downstream consumers (Prisma type generation)

- **`src/app/api/health/route.ts`** — No changes; remains intentionally database-free. Unaffected.

- **Existing tests** (`src/__tests__/env-config.test.ts`, `src/__tests__/scripts.test.ts`, `src/app/api/health/__tests__/route.test.ts`):
  - `env-config.test.ts` — May add check that `DATABASE_URL` is uncommented and well-formatted
  - `scripts.test.ts` — Must ensure `npm test` does NOT require a live database. Seed runs only on `npm run db:seed`, not on `npm test`
  - Health check test — Unaffected; health route never calls Prisma
  - **Impact: none** (no breaking changes to existing tests; new assertions may be added)

- **CI pipeline** (implied by README: install → lint → test → build):
  - Must run `prisma migrate deploy` before tests/build to provision schema
  - `npm test` assumes migrations are applied (but does not seed; seeding optional for test suite)
  - May add environment variable checks in CI

## Public API surface

- **Exported: `prisma` client instance** from `src/lib/db.ts` — Type-safe access to all entities. Downstream issues #4–#8 import and use directly.
  - **Change type: new** (no existing surface being modified; entirely new module)

- **Exported: Prisma-generated types** from `@prisma/client` — All entity types (`Teacher`, `Resource`, `Board`, etc.) available for import in API handlers and tests.
  - **Change type: new**

- **Breaking: No.** This is a foundational add; no existing public API is being changed.

## Tests affected

- **`src/__tests__/env-config.test.ts`** — Existing tests will continue to pass. May add assertion:
  - `DATABASE_URL` is uncommented and non-empty in `.env.example`
  - **Why: Ensure developers see the requirement and can configure it correctly**

- **`src/__tests__/scripts.test.ts`** — Will continue to pass. CI workflow MUST ensure:
  - `npm test` runs WITHOUT seeding (seed only on manual `npm run db:seed`)
  - Migrations are applied before test suite
  - **Why: Acceptance Criteria 4 requires clean rollback; tests must not pollute or require seed data**

- **New: `src/__tests__/db.schema.test.ts` (optional but recommended)** — Could verify:
  - Prisma client can instantiate without error
  - Expected tables/indexes exist (or defer this to migration smoke test)
  - **Why: Catch schema drift early**

- **New: `prisma/__tests__/migrations.test.ts` (optional)** — Could verify:
  - Migrations apply cleanly on empty database
  - Migrations roll back without dangling state (if reverting is supported)
  - **Why: Acceptance Criteria 4**

## Docs to update

- **`README.md`** — Add section "Database setup" covering:
  - PostgreSQL 14+ required (or specify version)
  - `cp .env.example .env.local` and uncomment `DATABASE_URL`
  - `npm run prisma:migrate:dev` to apply migrations locally
  - `npm run db:seed` to populate dev fixtures
  - `npm run db:reset` to drop + recreate + reseed (if provided)
  - **Why: Developers need explicit steps; currently only health-check is DB-free**

- **`docs/DATABASE.md`** — New file. Cover:
  - Entity overview (Teacher, Resource, Board, etc.) and cardinality
  - Soft-delete semantics on resources; cascade on likes/board items
  - Query patterns: feed (ordered by created_at), filtering by subject + year level, text search prep, profile lookups
  - Example Prisma queries for each pattern
  - **Why: Acceptance Criteria 6; downstream issues must follow consistent pattern**

- **`.env.example`** — Already reserves the line; update to:
  - Uncomment the `DATABASE_URL` line
  - Add format guide: `postgresql://[user[:password]@]host[:port]/dbname`
  - Add note: "Use localhost:5432 for local PostgreSQL; CI/prod values injected by environment"
  - **Why: Acceptance Criteria 5 and existing README guidance**

## Migrations / config / infra

- **`prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql`** — Auto-generated. Contains:
  - `CREATE TABLE` statements for all entities
  - Foreign key constraints
  - Unique indexes (resource_id + teacher_id for likes; resource_id + board_id + teacher_id for board items)
  - Indexes on: `(owner_id, created_at)`, `(subject_id, year_level_id, created_at)`, `(title, description)`
  - **Why: Acceptance Criteria 1, 2, 3**

- **`prisma/.prismaignore`** — Typically not needed; Prisma defaults are sensible. Only if custom ignore is required (rare).

- **CI environment variables:**
  - `DATABASE_URL` must be set in CI before `prisma migrate deploy` runs
  - Consider `NODE_ENV=test` to ensure no seed data in CI tests
  - **Why: Acceptance Criteria 4 (clean migration lifecycle)**

- **Development database provisioning:**
  - Manual: Install PostgreSQL locally, create `teacher_hub` database
  - Or: Use Docker Compose or similar (optional; not defined here)
  - **Why: README must include this**

## External systems

- **PostgreSQL 14+** — Required to run locally, in CI, and in production.
  - Schema will include standard SQL features (foreign keys, unique constraints, indexes)
  - No exotic PostgreSQL-only syntax (Prisma abstracts most differences)
  - **Impact: must be available before `npm test` and `npm run build`**

- **CI/CD pipeline** — Must:
  - Provision PostgreSQL container or use existing service
  - Set `DATABASE_URL` environment variable
  - Run `prisma migrate deploy` before tests/build
  - Optional: run `npm run db:seed` for integration tests (not blocking)
  - **Impact: new step in CI; must not fail the build**

- **Prisma Data Platform** (optional) — If used, migrations can be viewed/reviewed in web UI. Not required for MVP.

## Estimated diff size

- **Files touched:** 10–12
  - `prisma/schema.prisma` (new)
  - `prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql` (new, auto-generated)
  - `prisma/seed.ts` (new)
  - `docs/DATABASE.md` (new)
  - `src/lib/db.ts` (new, minimal; ~20–40 lines)
  - `package.json` (modified)
  - `.env.example` (modified, ~2–5 lines added/uncommented)
  - `.gitignore` (modified or no change, ~0–5 lines)
  - `README.md` (modified, ~30–50 lines in new section)
  - `tsconfig.json` (no change)
  - `next.config.ts` (no change)

- **Rough lines changed:** 1,000–1,500
  - `prisma/schema.prisma`: 200–300 lines (all new)
  - `prisma/seed.ts`: 250–400 lines (all new)
  - `prisma/migrations/.../migration.sql`: 150–250 lines (auto-generated)
  - `docs/DATABASE.md`: 150–250 lines (all new)
  - `src/lib/db.ts`: 20–40 lines (all new)
  - `package.json`: 20–40 lines (dependencies + scripts)
  - `.env.example`: 3–5 lines (uncomment + clarify)
  - `README.md`: 40–80 lines (new "Database setup" section)
  - Existing test updates: 10–30 lines (optional assertions)

- **Confidence: high**
  - Scope is precisely defined in ticket and solution.md
  - No ambiguity around entities or migration strategy
  - Prisma tooling generates predictable artifacts

- **Downstream churn analysis:**
  - Schema shape **IS** observable to all downstream issues (#4–#8). Any test fixtures, mock data, or API contract tests in #4–#8 will reference this schema.
  - **Counted explicitly:**
    - Each of issues #4–#8 will likely add 50–150 lines of new tests for their own API routes (out of scope here, but downstream cost)
    - Each issue may add fixture data to `prisma/seed.ts` (e.g., #4 adds sample uploaded PDFs, #6 adds resources with various keyword distributions)
    - Database tests for each feature (#4–#8, #11, #12, #13) will assume this schema exists and is applied before their test runs
  - **Asset count in this ticket only:**
    - No rewrite of existing code (health check untouched)
    - New test files optional (db.schema.test.ts, migrations.test.ts)
    - Existing test files (env-config.test.ts) may gain 5–10 lines
  - **Summary:** This ticket introduces ~1,000–1,500 lines of new infrastructure code (schema, seed, docs, db client). Downstream issues (#4–#8) will each add 200–500 lines dependent on this foundation (fixtures, API handlers, integration tests), but that cost is external and tracked in those issues.

## Warnings

- **Auth shape tie-in:** This ticket defines the `Teacher` / `users` entity with social-identity linkage support, without passwords. Issue #2 (auth, still OPEN) will build session/credential handling on top. If #2 changes the shape unexpectedly, this schema may need revision. Mitigation: ensure #2's output is synchronized with this schema before merging.

- **No draft/published state on resources yet:** Ticket AC implies publication state ("newly published resources appear in feed"), but the detailed semantics (draft, published, archived) are not defined here. Solution assumes a `published` boolean or enum; if #4 decides otherwise, schema must be revised. Recommend: coordinate with #4's implementation.

- **Soft-delete visibility:** Resources use soft-delete (tombstone), but board entries and likes cascade. If a resource is deleted, it disappears from boards silently; if a teacher is deleted, all their resources/boards/likes are gone. The exact deletion behavior must be documented in `docs/DATABASE.md` and synchronized with #4, #7, #8. Currently specified only in solution.md.

- **Taxonomy evolution:** Subjects and year-level taxonomies are seeded with fixed data. If a subject is retired in Phase 2 (#17), existing resources tagged with it must be handled (cascade delete? soft-delete? reassign?). Schema supports it, but the operational procedure is not defined here. Recommend: add a note in `docs/DATABASE.md`.

- **No download/terms tables:** Issues #11 (download counting) and #12 (terms acceptance) are out of scope, per ticket. This schema does NOT include `downloads` or `terms_acceptance` tables. Each will add their own migrations in their own PR. Ensure downstream issues know this split.

- **Performance indexes incomplete for Phase 2:** Indexes optimize for MVP access patterns (#6 keyword search, #8 feed ordering, #8 profile aggregates). Full-text search indexes are prep only (no GiST/GIN indexes yet); Phase 2 #17 will add them. Solution correctly defers this.

- **CI database provisioning not yet automated:** Ticket assumes `DATABASE_URL` will be provided in CI environment (likely via secrets or test database service). The CI workflow file (e.g., `.github/workflows/test.yml`) does not exist yet and is NOT created by this ticket. A separate infrastructure ticket or manual setup will be required. Mitigation: README must document the required CI variables.

- **No backup/recovery procedure:** Out of scope per ticket, but critical for production. Recommend: file a separate ops/infra ticket to define backup strategy and recovery runbook.

- **Test database isolation:** No discussion of test vs. dev vs. production database isolation strategy. Seed script runs only locally, but CI tests will run against a shared CI database (or a per-run ephemeral one). Schema supports this, but the operational procedure (reset between test runs? separate test DB container?) must be clarified in CI docs or a follow-up ticket.

