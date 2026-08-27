# Impact analysis

## Direct changes

- `src/app/api/taxonomy/route.ts` *(new)* — `GET` handler that reads subjects and year levels and returns them as `{ subjects, yearLevels }`.
- `src/lib/taxonomy.ts` *(new)* — Canonical typed seed constants: the six subjects (Math, English, Science, Social Studies, Arts, PE) and three year levels (Elementary, Middle School, High School), each with a stable `id` and `label`. Exported as `SUBJECTS`, `YEAR_LEVELS`, and their corresponding union/id types.
- `src/lib/taxonomy-service.ts` *(new)* — Service functions: `getTaxonomy()` (returns full set), `validateSubjectIds(ids)`, `validateYearLevelIds(ids)`. These are the validation helpers consumed by the resource create/update flow (#4).
- `db/migrations/<timestamp>_create_subjects_year_levels.sql` *(new, owned by #3)* — DDL creating `subjects` and `year_levels` tables (id, label, created_at) with seed `INSERT` statements for the six subjects and three year levels.
- `db/migrations/<timestamp>_create_resource_taxonomy_joins.sql` *(new, owned by #3)* — DDL creating `resource_subjects` and `resource_year_levels` join tables (resource_id FK, taxonomy_id FK, composite PK). This is the many-to-many bridge.
- `package.json` *(likely changed by #3)* — An ORM / DB client (Prisma or Drizzle + `pg`/`postgres.js`) must be added before the taxonomy route can query the DB. Currently no DB dependency exists.

## Indirect: callers & consumers

- `src/app/api/resources/route.ts` *(created by #4, does not exist yet)* — resource `POST`/`PATCH` handlers will call `validateSubjectIds` and `validateYearLevelIds` from `taxonomy-service.ts`. Impact: **behavior-change** — creates/updates missing or invalid taxonomy IDs will be rejected with a 422; this is the intended enforcement.
- `src/app/api/resources/route.ts` `GET` *(created by #6, does not exist yet)* — resource listing will accept `?subjectId=&yearLevelId=` query params and join through the taxonomy tables. Impact: **behavior-change** — filter correctness depends on the join tables being populated.
- Any future UI component rendering a resource creation form *(#4)* — must `GET /api/taxonomy` to populate subject/year-level dropdowns. Impact: **none** until the UI is built; no existing component is affected today.
- `src/__tests__/readme.test.ts` — checks generic README content (npm install, folder structure, env config). Does **not** assert on specific API endpoint paths, so it will **not** break when `/api/taxonomy` is added. Impact: **none**.
- `src/__tests__/env-config.test.ts` — checks `.env.example` for existence and format, not specific keys. Impact: **none** unless `DATABASE_URL` is not yet present in `.env.example` (it should be added by #3).

## Public API surface

- Exported: `GET /api/taxonomy` in `src/app/api/taxonomy/route.ts` — **new endpoint**. Response shape:
  ```json
  { "subjects": [{ "id": "string", "label": "string" }], "yearLevels": [{ "id": "string", "label": "string" }] }
  ```
- Exported: `SUBJECTS`, `YEAR_LEVELS`, `SubjectId`, `YearLevelId`, `Subject`, `YearLevel` in `src/lib/taxonomy.ts` — **new module**, all new exports.
- Exported: `getTaxonomy()`, `validateSubjectIds()`, `validateYearLevelIds()` in `src/lib/taxonomy-service.ts` — **new module**, all new exports.

### Breaking
None. All changes are purely additive; no existing export or endpoint is modified.

## Tests affected

- `src/app/api/taxonomy/__tests__/route.test.ts` *(new)* — must cover: 200 with correct shape, correct subject/year-level counts and labels, no extra fields, method-not-allowed for POST.
- `src/lib/__tests__/taxonomy.test.ts` *(new)* — must cover: constant values match the solution's defined vocabulary (6 subjects, 3 year levels), stable IDs, TypeScript types narrow correctly.
- `src/lib/__tests__/taxonomy-service.test.ts` *(new)* — must cover: `validateSubjectIds` accepts valid IDs, rejects unknown IDs, rejects empty array; same for `validateYearLevelIds`; `getTaxonomy` returns both collections.
- `src/app/api/health/__tests__/route.test.ts` — **not affected**; health route is unchanged.
- `src/__tests__/readme.test.ts` — **not affected** by this ticket (see Indirect section above). Would need updating if README is required to document every API route.
- `src/app/api/resources/__tests__/route.test.ts` *(created by #4)* — **will need** test cases for: resource POST rejected when subjectIds empty, resource POST rejected when a subjectId is not in taxonomy, same for yearLevelIds. These are downstream tests written in #4 but directly triggered by the validation logic this ticket introduces.

## Docs to update

- `README.md` — "Available scripts" / API section: document the new `GET /api/taxonomy` endpoint alongside the health endpoint (same pattern already established). Low-priority but keeps the README accurate.

## Migrations / config / infra

- `db/migrations/<timestamp>_create_subjects_year_levels.sql` — creates `subjects(id TEXT PK, label TEXT NOT NULL)` and `year_levels(id TEXT PK, label TEXT NOT NULL)` tables; seeds 6 subject rows and 3 year-level rows. Owned by #3 but the content (exact IDs and labels) is specified by this ticket's solution.
- `db/migrations/<timestamp>_create_resource_taxonomy_joins.sql` — creates `resource_subjects(resource_id, subject_id, PRIMARY KEY (resource_id, subject_id), FK both sides)` and `resource_year_levels` mirror. Owned by #3, sequenced after the resources table migration from #4.
- `.env.example` — must document `DATABASE_URL` (expected to arrive in #3; already referenced in README). No change needed from this ticket if #3 adds it.
- `package.json` — ORM package (e.g. `@prisma/client` + `prisma` dev dep, or `drizzle-orm` + `drizzle-kit`) must be present before the taxonomy route can query the DB. The choice belongs to #3; this ticket is a consumer.

## External systems

- **PostgreSQL** — two new taxonomy reference tables (`subjects`, `year_levels`) seeded with the MVP controlled vocabulary; two new many-to-many join tables (`resource_subjects`, `resource_year_levels`). All reads by the taxonomy endpoint are simple full-table scans on tiny reference tables (9 total rows at MVP), so no indexing concern beyond the PKs and FKs defined in the migration.

## Estimated diff size

- **Files touched:** ~10–12
  - 2 new migration SQL files (subjects/year-levels + join tables)
  - 3 new `src/` production files (`route.ts`, `taxonomy.ts`, `taxonomy-service.ts`)
  - 3 new test files (route test, constants test, service test)
  - 1 `package.json` update (ORM dep — owned by #3)
  - 1 `README.md` update (API endpoint documentation)
  - 1–2 env/config files (`.env.example` — likely already covered by #3)
- **Rough lines changed:** ~350–500 total
  - Migration SQL: ~60–80 lines (DDL + seed inserts)
  - `src/lib/taxonomy.ts`: ~50–70 lines (typed constants)
  - `src/lib/taxonomy-service.ts`: ~40–60 lines (3 service functions)
  - `src/app/api/taxonomy/route.ts`: ~20–30 lines (thin handler)
  - Test files: ~150–200 lines across 3 files
  - README delta: ~10 lines
- **Confidence:** medium — ORM/DB client choice is not yet pinned in the repo (no Prisma or Drizzle present); if the taxonomy endpoint reads hardcoded constants instead of DB rows (feasible for a fixed vocabulary), the migration and DB query layers shrink and confidence rises to high.
- **Downstream churn:** The new `GET /api/taxonomy` response shape (`{ subjects, yearLevels }` with `id`/`label` per item) is the wire contract that #4's resource form and #6's filter UI will depend on. If the shape changes (e.g. key renamed `year_levels` vs `yearLevels`, or `id` renamed `slug`), both the resource creation tests/fixtures (#4) and the browse/filter tests/fixtures (#6) need updating. Counted assets: 2 downstream integration test files (resource route test from #4, resource listing/filter test from #6) — approximately 40–60 additional lines of fixture/mock rewrite risk if the shape is revised after #4/#6 land.

## Warnings

- **No ORM or DB client is installed.** `package.json` currently has zero database dependencies. The taxonomy API endpoint (as designed — "loaded via migration") requires a DB connection at runtime. This ticket is blocked on #3 choosing and installing the ORM. If the implementer needs to unblock independently, the taxonomy constants can be shipped as pure in-memory TypeScript (no DB query) and the endpoint returns them directly; the migration/seed data would still be owned by #3 for the FK constraints on the join tables.
- **Join tables depend on the resources table.** `resource_subjects` and `resource_year_levels` have a foreign key to a `resources` table that does not exist yet (owned by #3/#4). The join-table migrations must be sequenced *after* the resources table migration. If this ticket's migrations are applied before #4's, the FK constraint will fail at migration time.
- **Tag cardinality is many-to-many but validation enforces "at least one."** The service layer must enforce minimum cardinality (`validateSubjectIds([])` → error). This is a behavior contract that #4's resource service will depend on; if it is not enforced consistently, resources with zero tags can be persisted, silently breaking the AC.
- **Taxonomy IDs must be stable across environments.** If migrations use auto-increment integer PKs instead of stable text/slug IDs (e.g. `"mathematics"`, `"high-school"`), the seed data must guarantee identical IDs in every environment (dev, CI, staging, prod). A mismatch would cause validation to accept IDs in one environment and reject them in another. The solution calls for "stable identifiers" — enforce this explicitly in the migration (TEXT PK, not SERIAL).
- **Filtering logic (OR-within / AND-across) is not implementable from this ticket alone.** The query logic lives in the resource listing endpoint (#6). This ticket only provides the taxonomy data and validation primitives; the filter behavior AC cannot be verified end-to-end until #3, #4, and #6 all exist.
