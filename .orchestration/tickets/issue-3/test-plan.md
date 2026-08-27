# Test plan

## Coverage summary
- Unit tests: 22 new, 0 updated
- Functional/integration tests: 15 new, 0 updated
- Existing regression tests preserved: yes — `env-config.test.ts`, `scripts.test.ts`,
  `readme.test.ts`, `gitignore.test.ts`, `typescript.test.ts`, and the health-route test are
  untouched in behavior; two existing files (`env-config.test.ts`, `scripts.test.ts`) gain new
  assertions appended to their existing `describe` blocks rather than being restructured.

## Test runner
- Framework: Vitest (`vitest run`, already configured via `vite-tsconfig-paths`), invoked
  through `npm test`. Integration tests that need a live PostgreSQL run in the same Vitest
  process but are gated behind a `DATABASE_URL` presence check (see "Fixtures & data").
- Command (all tests): `npm test`
- Fast subset (schema/migration/seed tests only):
  `npx vitest run prisma/__tests__ src/__tests__/env-config.test.ts src/__tests__/scripts.test.ts`
- Fast subset (unit-only, no DB required):
  `npx vitest run prisma/__tests__/schema.unit.test.ts src/__tests__/env-config.test.ts`

## Behaviors to test

### Unit

- **Schema declares all required entities** — the Prisma schema file defines models for
  Teacher, Resource, Subject, YearLevel, Board, BoardItem, and Like.
  - File: `prisma/__tests__/schema.unit.test.ts` (new)
  - Key assertions:
    - Reading `prisma/schema.prisma` (or the generated DMMF via `@prisma/client`) exposes a
      model named `Teacher`, `Resource`, `Subject`, `YearLevel`, `Board`, `BoardItem`, `Like`
      (one assertion per model).
    - No unexpected duplicate/renamed models drift from the documented shape.
  - Setup: Parse `prisma/schema.prisma` as text or load Prisma's DMMF (`Prisma.dmmf.datamodel`)
    from the generated client — no live database needed.
  - Maps to acceptance criterion: "Entities and relationships" AC1 (issue #3 AC 1).

- **Teacher model has no password field** — the Teacher model omits any credential column.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions:
    - `Teacher` model fields do NOT include `password`, `passwordHash`, or similar.
    - `Teacher` model includes `displayName`/`name`, `bio`, and a joined/registered timestamp
      field.
  - Setup: DMMF field inspection.
  - Maps to acceptance criterion: Entities AC (profile attributes), resolved Ambiguity A1.

- **Teacher supports linked identity providers** — a Teacher can be linked to one or more
  external OAuth identities (Google/Microsoft) rather than a single email+password pair.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions:
    - A related model (e.g. `Identity`/`AuthAccount`) exists with a foreign key to `Teacher`
      and fields for `provider` and `providerAccountId`.
    - A unique compound constraint exists on `(provider, providerAccountId)` so the same
      external account cannot link to two teachers.
  - Setup: DMMF field/index inspection.
  - Maps to acceptance criterion: resolved Ambiguity A1 ("identity and provider linkage must
    be representable").

- **Resource core fields** — a Resource records title, description, owning teacher reference,
  PDF file reference, publication state, and creation timestamp.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions: DMMF fields for `Resource` include `title`, `description`, `ownerId` (or
    equivalent relation scalar), `fileUrl`/`pdfKey`, `published` (boolean/enum), `createdAt`.
  - Setup: DMMF inspection.
  - Maps to acceptance criterion: Entities AC2, AC "draft vs. published" edge case.

- **Resource–Subject and Resource–YearLevel are many-to-many** — a resource can carry more
  than one subject and more than one year level.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions: join models/tables exist (e.g. `ResourceSubject`, `ResourceYearLevel`) each
    with foreign keys to `Resource` and to `Subject`/`YearLevel` respectively, and no
    single-valued scalar FK column (e.g. `subjectId`) exists directly on `Resource`.
  - Setup: DMMF inspection.
  - Maps to acceptance criterion: resolved Ambiguity A2.

- **Board carries a visibility attribute** — Board has a boolean/enum sharing field.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions: `Board` model has a field such as `isShared`/`visibility` with a
    non-null default.
  - Setup: DMMF inspection.
  - Maps to acceptance criterion: resolved Ambiguity A5.

- **No standalone "saved" entity distinct from BoardItem** — the "saved" concept is
  represented solely via `BoardItem`.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions: no model named `Save`/`Bookmark`/`SavedResource` exists in the DMMF;
    `BoardItem` has a `createdAt` field (needed for "most recent saves" ordering).
  - Setup: DMMF inspection.
  - Maps to acceptance criterion: resolved Ambiguity A3, edge case "Timestamps & ordering".

- **Unique constraint on Like (teacher, resource)** — the schema declares a compound unique
  index preventing duplicate likes.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions: DMMF/index metadata for `Like` shows a unique constraint on
    `(teacherId, resourceId)`.
  - Setup: DMMF/index inspection (statically, no DB write needed for this check).
  - Maps to acceptance criterion: Integrity AC ("same teacher cannot like the same resource
    twice").

- **Unique constraint on BoardItem (board, resource)** — prevents adding the same resource to
  the same board twice.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions: DMMF/index metadata for `BoardItem` shows a unique constraint on
    `(boardId, resourceId)`.
  - Setup: DMMF/index inspection.
  - Maps to acceptance criterion: Integrity AC ("same resource cannot be added to the same
    board twice").

- **Foreign keys required (NOT NULL) on all relational join fields** — Resource.ownerId,
  Board.teacherId, BoardItem.boardId/resourceId, Like.teacherId/resourceId are all mandatory.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions: DMMF field metadata shows `isRequired: true` for each listed scalar FK.
  - Setup: DMMF inspection.
  - Maps to acceptance criterion: Integrity AC ("cannot exist referencing a teacher or
    resource that does not exist" — the NOT NULL half of that guarantee; the FK-enforcement
    half is covered by the integration tests below).

- **Indexes exist on documented access patterns** — composite indexes for feed and discovery
  queries are declared in the schema.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions:
    - An index covering `(ownerId, createdAt)` exists on `Resource` (feed ordering).
    - An index covering `(createdAt)` or a subject/year-level join table index supports
      filtered discovery by subject + year level.
    - Title/description columns are flagged for search prep (index or documented as
      deferred — assert whatever the implementation declares, matching solution.md's "prep
      the schema" decision).
  - Setup: DMMF/index metadata inspection.
  - Maps to acceptance criterion: Query performance AC1.

- **Deletion behavior columns match documented semantics** — Resource has a soft-delete
  marker (e.g. `deletedAt`/`status`); Like and BoardItem foreign keys are configured with
  cascade delete.
  - File: `prisma/__tests__/schema.unit.test.ts`
  - Key assertions:
    - `Resource` model has a nullable `deletedAt` (or `status` enum including a tombstoned
      state).
    - The generated SQL/DMMF relation metadata shows `onDelete: Cascade` for
      `Like.resource`, `Like.teacher`, `BoardItem.resource`, `BoardItem.board`.
  - Setup: Inspect `prisma/schema.prisma` relation attributes directly (textual) since DMMF
    does not always expose `onDelete` — fall back to raw schema text search if DMMF lacks it.
  - Maps to acceptance criterion: Integrity AC ("deletion behaviour... documented and
    consistent"), edge case "Deletion semantics".

- **`.env.example` documents `DATABASE_URL` without a real secret** — extends the existing
  `env-config.test.ts` suite.
  - File: `src/__tests__/env-config.test.ts` (modified — new `it` blocks appended)
  - Key assertions:
    - `DATABASE_URL` line is present and NOT commented out (`^DATABASE_URL=` matches, not
      `^#\s*DATABASE_URL`).
    - The value does not match a real-looking secret pattern (reuse existing secret regex).
  - Setup: none beyond existing file read.
  - Maps to acceptance criterion: Developer workflow AC ("DATABASE_URL... documented... no
    real secret").

- **`package.json` declares required Prisma scripts** — `prisma:generate`,
  `prisma:migrate:dev`/`prisma:migrate`, and `db:seed` scripts exist.
  - File: `prisma/__tests__/schema.unit.test.ts` or a new
    `src/__tests__/package-scripts.test.ts`
  - Key assertions: `package.json` `scripts` object contains keys for generate/migrate/seed
    (exact names matched against solution.md's stated script names once implemented).
  - Setup: read and JSON-parse `package.json`.
  - Maps to acceptance criterion: Developer workflow (supports migrations/seed being runnable).

- **`docs/DATABASE.md` exists and documents cascade/soft-delete semantics** — the DAL guide
  is present and covers required topics.
  - File: `prisma/__tests__/schema.unit.test.ts` or `src/__tests__/docs.test.ts` (new)
  - Key assertions:
    - File exists and is non-empty.
    - Content mentions each entity name (Teacher, Resource, Board, BoardItem, Like, Subject,
      YearLevel).
    - Content contains a section documenting soft-delete on resources and cascade on
      likes/board items (string/heading match, not full semantic check).
  - Setup: read file from repo root.
  - Maps to acceptance criterion: Developer workflow AC ("data access conventions...
    documented"), edge case "Deletion semantics".

### Functional / integration

> All tests in this section require a real PostgreSQL instance reachable via `DATABASE_URL`.
> They are skipped (via `describe.skipIf(!process.env.DATABASE_URL)`) when no database is
> configured, so `npm test` never fails or hangs on a machine/CI job without Postgres — this
> preserves the existing "npm test does not require a live database" guarantee for the
> pre-existing suite while still running in CI once `DATABASE_URL` is provisioned there.

- **Migration applies cleanly to an empty database** — `prisma migrate deploy` (or
  `migrate dev` in test mode) succeeds against a fresh, empty schema.
  - File: `prisma/__tests__/migrations.integration.test.ts`
  - Preconditions: an empty PostgreSQL database/schema (created via a dedicated test schema
    name or a Dockerized ephemeral Postgres, per CI setup).
  - Actions: run `npx prisma migrate deploy` via `spawnSync` against the test `DATABASE_URL`;
    then connect and list tables via `information_schema.tables`.
  - Assertions: process exits 0; all 8 expected tables (Teacher, Resource, Subject,
    YearLevel, Board, BoardItem, Like, and the identity/auth-account join table) exist.
  - Cleanup: drop and recreate the test schema (`DROP SCHEMA ... CASCADE; CREATE SCHEMA ...`)
    in `afterAll`.
  - Maps to acceptance criterion: Developer workflow AC1 ("migrations can be applied to an
    empty database").

- **Migration rolls back / resets cleanly with no partial state** — reverting the migration
  (or resetting via `prisma migrate reset --force`) leaves no leftover tables/rows.
  - File: `prisma/__tests__/migrations.integration.test.ts`
  - Preconditions: schema from the previous test already applied and possibly seeded.
  - Actions: run `npx prisma migrate reset --force --skip-seed`; then query
    `information_schema.tables` for the test schema.
  - Assertions: process exits 0; only Prisma's internal `_prisma_migrations` table (and no
    leftover application tables with stale data) remain inconsistent — specifically assert
    row counts in `Resource`/`Teacher` are 0 after reset-without-seed.
  - Cleanup: drop test schema in `afterAll`.
  - Maps to acceptance criterion: Developer workflow AC1 ("rolled back cleanly, leaving no
    partial state").

- **Foreign key rejects orphaned Resource** — inserting a Resource with a non-existent
  `ownerId` fails at the database level.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: migrated, empty database.
  - Actions: attempt `prisma.resource.create({ data: { ownerId: <random uuid>, ... } })`.
  - Assertions: the call throws a Prisma foreign-key-violation error (`P2003` or underlying
    Postgres `23503`); no row is inserted (verify via count).
  - Cleanup: transaction rollback or truncate tables in `afterEach`.
  - Maps to acceptance criterion: Integrity AC ("cannot exist referencing a teacher or
    resource that does not exist").

- **Foreign key rejects orphaned BoardItem and Like** — same guarantee for BoardItem→Resource,
  BoardItem→Board, Like→Teacher, Like→Resource.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: one valid Teacher + one valid Resource + one valid Board seeded in
    `beforeEach`.
  - Actions: attempt to create a `BoardItem` referencing a non-existent `resourceId`; a `Like`
    referencing a non-existent `teacherId`. Run as two independent test cases (one axis
    changed per case: only the dangling FK under test differs, all other fields point to
    valid seeded rows).
  - Assertions: each throws a foreign-key-violation error; no row inserted.
  - Cleanup: truncate/rollback per test.
  - Maps to acceptance criterion: Integrity AC (same as above, applied to BoardItem and Like).

- **Duplicate Like is rejected or is a no-op** — a teacher cannot like the same resource
  twice as two distinct rows.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: one Teacher, one Resource, existing Like row for that pair.
  - Actions: attempt to insert a second `Like` with the identical `(teacherId, resourceId)`.
  - Assertions: the insert throws a unique-constraint violation (`P2002`); `Like` row count
    for that pair remains 1.
  - Cleanup: truncate in `afterEach`.
  - Maps to acceptance criterion: Integrity AC ("same teacher cannot like the same resource
    twice").

- **Duplicate BoardItem is rejected or is a no-op** — a resource cannot be added to the same
  board twice.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: one Teacher, one Board (owned by that teacher), one Resource, existing
    BoardItem row for that `(boardId, resourceId)` pair.
  - Actions: attempt to insert a second `BoardItem` with the identical pair.
  - Assertions: throws unique-constraint violation; row count for that pair remains 1.
  - Cleanup: truncate in `afterEach`.
  - Maps to acceptance criterion: Integrity AC ("same resource cannot be added to the same
    board twice").

- **Concurrent duplicate likes resolve to exactly one row** — simulates two simultaneous
  like requests for the same (teacher, resource) pair.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: one Teacher, one Resource, no existing Like.
  - Actions: fire two `prisma.like.create(...)` calls concurrently via `Promise.allSettled`
    for the identical pair.
  - Assertions: exactly one promise fulfills, the other rejects with a unique-constraint
    violation (or both succeed if the implementation uses an idempotent upsert — assert
    whichever the implementation guarantees, but in either case final row count is exactly 1
    and the user-facing action is not a hard failure with no retry path documented).
  - Cleanup: truncate in `afterEach`.
  - Maps to acceptance criterion: Edge case "Concurrency".

- **Concurrent duplicate board-saves resolve to exactly one row** — same concurrency check
  for BoardItem.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: one Teacher, one Board, one Resource, no existing BoardItem.
  - Actions: fire two concurrent `prisma.boardItem.create(...)` calls for the identical
    `(boardId, resourceId)` pair.
  - Assertions: final BoardItem row count for that pair is exactly 1.
  - Cleanup: truncate in `afterEach`.
  - Maps to acceptance criterion: Edge case "Concurrency".

- **Deleting a Resource cascades to Likes and BoardItems, not left dangling** — verifies the
  documented deletion behavior end-to-end.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: one Resource with at least one Like and one BoardItem referencing it.
  - Actions: soft-delete the Resource per the documented mechanism (set `deletedAt`, or hard
    delete if solution.md's final design uses hard delete + cascaded FKs — assert whichever
    mechanism is implemented, consistent with `docs/DATABASE.md`).
  - Assertions: if hard-deleted, dependent Like/BoardItem rows are also removed (row count 0,
    no orphaned FK errors on query); if soft-deleted, the Resource row still exists with
    `deletedAt` set and dependent Like/BoardItem rows are unaffected but the resource is
    excluded from standard "active resource" queries used elsewhere in the suite.
  - Cleanup: truncate in `afterEach`.
  - Maps to acceptance criterion: Integrity AC ("deleting a resource or teacher leaves no
    dangling likes or board entries"), edge case "Deletion semantics".

- **Deleting a Teacher cascades to their Boards, BoardItems, and Likes** — same guarantee
  from the teacher side.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: one Teacher owning a Board (with a BoardItem) and a Like.
  - Actions: delete the Teacher row.
  - Assertions: dependent Board, BoardItem, and Like rows are cascade-deleted (counts drop to
    0); no orphaned rows remain queryable.
  - Cleanup: none needed (data already removed); reset schema in `afterAll` regardless.
  - Maps to acceptance criterion: Integrity AC (teacher deletion side), edge case "Deletion
    semantics".

- **Tag/taxonomy value outside approved Subject/YearLevel set is rejected** — a
  ResourceSubject/ResourceYearLevel row cannot reference a subject/year-level id that isn't
  in the seeded reference table.
  - File: `prisma/__tests__/integrity.integration.test.ts`
  - Preconditions: migrated database with the standard seeded Subject/YearLevel reference
    rows present (via seed script or a minimal fixture insert).
  - Actions: attempt to create a `ResourceSubject` row with a `subjectId` not present in the
    `Subject` table.
  - Assertions: foreign-key violation thrown; no row inserted.
  - Cleanup: truncate in `afterEach`.
  - Maps to acceptance criterion: Integrity AC ("tag value that is not part of the approved
    subject/year-level reference data cannot be stored").

- **Seed script populates a representative dataset** — running the seed produces the
  documented minimum data richness.
  - File: `prisma/__tests__/seed.integration.test.ts`
  - Preconditions: freshly migrated, empty database.
  - Actions: run `npx prisma db seed` (or `npm run db:seed`) via `spawnSync`.
  - Assertions: process exits 0; post-seed row counts satisfy the documented minimums —
    Teacher count ≥ 5, Resource count ≥ 20 spanning ≥ 3 distinct Subjects and ≥ 3 distinct
    YearLevels, Board count ≥ 5 with at least one BoardItem each, Like count ≥ 20; every
    seeded Resource has a non-null `ownerId` resolving to a seeded Teacher (referential
    sanity, not just count).
  - Cleanup: reset schema in `afterAll`.
  - Maps to acceptance criterion: Developer workflow AC ("seed script... data rich enough to
    exercise the MVP scenarios").

- **Seed script is idempotent / rerunnable without duplicate-key failures** — running seed
  twice against the same database either upserts cleanly or is documented as reset-only.
  - File: `prisma/__tests__/seed.integration.test.ts`
  - Preconditions: database already seeded once (from the previous test, in sequence).
  - Actions: run the seed command a second time.
  - Assertions: matches whatever contract the implementation documents in
    `docs/DATABASE.md`/README — either (a) exits 0 and row counts remain stable (upsert
    semantics), or (b) exits non-zero with a clear unique-constraint error, in which case the
    README's documented `db:reset`-before-reseed workflow is asserted instead. Exactly one of
    these two behaviors must hold; the test picks the one matching the implementation and
    documents which was observed.
  - Cleanup: reset schema in `afterAll`.
  - Maps to acceptance criterion: Developer workflow AC (seed script), edge case
    "Portability" (reproducible without manual steps).

- **Discovery queries avoid full-table scans on seeded-scale data** — feed, subject/year-level
  filter, and keyword search queries use the declared indexes.
  - File: `prisma/__tests__/query-performance.integration.test.ts`
  - Preconditions: database seeded via the seed script (≥20 resources).
  - Actions: run `EXPLAIN (FORMAT JSON)` via `prisma.$queryRaw` for: (a) feed query ordered by
    `(ownerId, createdAt)`; (b) filter query by subject + year level; (c) keyword search over
    title/description (`ILIKE` or prep index, per implementation).
  - Assertions: the JSON query plan's node type for the `Resource` table scan is not
    `Seq Scan` (or, if the implementation intentionally does a seq scan on such a small seeded
    table because Postgres' planner prefers it at low row counts, assert instead that the
    expected index is `Index Scan`-eligible by checking `pg_indexes` for the expected index
    name — avoid a flaky assertion purely on planner choice at tiny scale).
  - Cleanup: none (read-only).
  - Maps to acceptance criterion: Query performance AC2.

- **Profile aggregate counts (resources, boards, likes received) are queryable via a single
  grouped query, not N+1** — validates the model supports issue #13's aggregation need.
  - File: `prisma/__tests__/query-performance.integration.test.ts`
  - Preconditions: seeded database with a Teacher who owns multiple Resources and Boards and
    has received multiple Likes.
  - Actions: run the documented aggregate query pattern (e.g. `prisma.resource.count`,
    `prisma.like.count` grouped by owner, or a single raw aggregate query) for that Teacher.
  - Assertions: returned counts match manually computed expected counts from the fixture
    data; query does not require iterating per-resource in application code (assert by
    checking the implementation issues a bounded number of SQL statements, e.g. via a Prisma
    query-logging spy, not one query per resource).
  - Cleanup: none (read-only).
  - Maps to acceptance criterion: Query performance AC3.

## Edge cases covered
- **Deletion semantics** (third party sees tombstone vs. silent disappearance) → tested by:
  "Deleting a Resource cascades to Likes and BoardItems, not left dangling" and the schema
  unit test "Deletion behavior columns match documented semantics".
- **Concurrency** (duplicate likes/saves under simultaneous requests) → tested by:
  "Concurrent duplicate likes resolve to exactly one row" and "Concurrent duplicate
  board-saves resolve to exactly one row".
- **Counter accuracy** (like counts must not drift from underlying records) → tested by:
  "Profile aggregate counts... are queryable via a single grouped query" (asserts counts are
  derived directly from Like/Resource rows, not a separately maintained counter column that
  could drift) — if the schema introduces a denormalized counter column, this test must be
  extended to also assert it stays in sync after insert/delete; flagged in "Not tested" below
  pending final schema shape.
- **Taxonomy evolution** (retiring/renaming a subject must not orphan or silently retag
  resources) → tested by: "Tag/taxonomy value outside approved Subject/YearLevel set is
  rejected" (covers insert-time enforcement); the retirement/renaming *procedure* itself is
  not testable at the schema level and is covered only by the `docs/DATABASE.md` content
  check in "docs/DATABASE.md exists and documents cascade/soft-delete semantics" being
  extended to also require a taxonomy-evolution note (see Not tested).
- **Auth shape / identity linkage** → tested by: "Teacher supports linked identity providers".
- **Draft vs. published** → tested by: "Resource core fields" (asserts `published` field
  exists); actual feed-filtering behavior by publication state is out of scope for this
  ticket (no feed query implementation ships here) and is left to issue #4/#6.
- **Timestamps & ordering** (creation time on resources AND board entries) → tested by:
  "Resource core fields" and "No standalone 'saved' entity..." (asserts `BoardItem.createdAt`
  exists); actual "sort by most recent saves" query correctness is exercised indirectly by
  "Discovery queries avoid full-table scans" for the analogous resource-feed case.
- **Text search semantics** (case/accents/partial words) → explicitly deferred; see Not
  tested.
- **Portability** (reproducible setup locally and in CI without manual steps) → tested by:
  "Migration applies cleanly to an empty database" and "Seed script is idempotent /
  rerunnable" run against a CI-provisioned `DATABASE_URL` with no manual SQL.
- **No secrets in git** → tested by: existing `.env.example`/gitignore regression tests, plus
  the new `.env.example` `DATABASE_URL` assertion in `env-config.test.ts`.

## Not tested (with reason)
- **Full-text search correctness (case-insensitivity, accents, partial-word matches)** — not
  tested here. Solution.md explicitly defers full-text indexes (GIN/GiST) to Phase 2 (#17);
  this ticket only prepares the schema. Actual search query behavior belongs to issue #6.
- **Denormalized counter drift** (if the implementation adds a `likeCount`/`downloadCount`
  column to Resource for performance) — not tested because solution.md does not commit to
  such a column; if the implementer adds one, a follow-up test asserting the counter matches
  `COUNT(*)` on the underlying Like table after insert/delete must be added before merge.
  Flagged here so the implementer and reviewer are aware.
- **Download counts and terms-of-use acceptance** — not tested; explicitly out of scope per
  ticket (Ambiguity A4), owned by issues #11 and #12 in their own migrations.
- **CI provisioning of PostgreSQL itself** (e.g. GitHub Actions service container) — not
  tested by application-level tests; this is infra/workflow configuration outside the test
  suite's reach. Covered by manual verification: confirm the CI workflow file starts a
  Postgres service and sets `DATABASE_URL` before `npm test` runs.
- **Production backup/recovery** — explicitly out of scope per ticket; no test applicable.
- **`npm run lint` / `npm run build` continuing to pass with the new Prisma dependency** —
  not a new test; covered by the existing `scripts.test.ts` regression tests, which already
  assert `lint`, `format:check`, and `build` exit 0. No new test needed beyond ensuring those
  keep passing after `@prisma/client`/`prisma` are added as dependencies.

## Fixtures & data
- **Unit tests** (`schema.unit.test.ts`): no fixtures; read `prisma/schema.prisma` as text
  and/or import the generated Prisma Client DMMF (`import { Prisma } from "@prisma/client"`
  → `Prisma.dmmf.datamodel`). Requires `npx prisma generate` to have run in CI before tests
  (add as a pretest step, not a live DB).
- **Integration tests**: require `process.env.DATABASE_URL` pointing at a real, disposable
  PostgreSQL instance. Use `describe.skipIf(!process.env.DATABASE_URL)` at the top of each
  integration file so these tests no-op locally without Postgres and only run where CI
  provisions one. Each integration file:
  - `beforeAll`: run `prisma migrate deploy` (or reuse a shared migrated schema) once per
    file/run.
  - `beforeEach`/`afterEach`: insert minimal fixture rows (one Teacher, one Resource, etc.)
    scoped to that test, then truncate affected tables (`TRUNCATE ... RESTART IDENTITY
    CASCADE`) to keep tests independent — avoid relying on the shared seed dataset for
    integrity/concurrency tests so row-count assertions stay exact.
  - The seed-specific tests (`seed.integration.test.ts`) and query-performance tests are the
    only ones that rely on the full `prisma/seed.ts` output; they run against a database
    reset immediately before seeding to keep counts deterministic.
  - A shared test helper `prisma/__tests__/helpers/testDb.ts` (new) should export a Prisma
    Client instance configured with the test `DATABASE_URL` and a `resetDatabase()` /
    `truncateAll()` utility reused across all integration test files to avoid duplication.

## Reproduction test (bugs only)
- Not applicable — this is a feature ticket (new schema/migrations), not a bug fix. No
  `reproduction.md` was provided.
