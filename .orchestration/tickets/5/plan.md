---
role: planner
ticket: 5
deliverable_path: plan.md
confidence: high
depends_on: [ticket.md, solution.md, impact.md]
owns: [taxonomy constants, taxonomy service/validation, taxonomy API endpoint]
excludes: [schema, migrations, DB client, resource entity, resource UI, filter query logic]
---

# Implementation plan

## Goal
A read-only taxonomy API endpoint plus in-memory subject/year-level constants and
service-layer validation helpers that any resource flow (#4/#6) can consume.

## Approach
Per `solution.md`, the MVP taxonomy is a **fixed, seeded controlled vocabulary**:
6 subjects (Math, English, Science, Social Studies, Arts, Physical Education) and
3 year levels (Elementary, Middle School, High School), each with a stable text
`id` and a human-readable `label`. Schema, migrations and the DB client are owned
by **#3** and are **not** part of this ticket. The repo currently has **no DB
dependency at all** (`package.json` has zero database packages), so this ticket
ships the taxonomy as **pure in-memory TypeScript constants** — the endpoint and
validators read those constants directly, never a DB. This is the "unblock
independently" path called out in `impact.md`'s warnings, and it keeps this
ticket self-contained and testable today. #3's migration seed rows must mirror
these exact ids/labels (this module is the source of truth for their values).

Three layers, mirroring the existing `health` pattern (`src/lib/health.ts` +
`src/app/api/health/route.ts`): (1) `taxonomy.ts` holds typed constants and
exported types; (2) `taxonomy-service.ts` holds `getTaxonomy()` and the two
`validate*Ids` helpers that enforce "known ids only" and "at least one"; (3) a
thin `GET /api/taxonomy` route returns `{ subjects, yearLevels }` using
`NextResponse.json`, exactly like the health route. Validation lives in the
service layer so #4's resource create/update can import and reuse it unchanged.

Filtering logic (OR-within / AND-across) is explicitly **out of scope** — it
lives in #6's resource-listing endpoint. This ticket only supplies the data and
validation primitives that make it possible.

## Steps
1. **Add taxonomy constants** — Create `src/lib/taxonomy.ts`. Define
   `SUBJECTS` and `YEAR_LEVELS` as `as const` readonly arrays of
   `{ id, label }`. Ids are stable slugs (e.g. `"mathematics"`, `"english"`,
   `"science"`, `"social-studies"`, `"arts"`, `"physical-education"`;
   `"elementary"`, `"middle-school"`, `"high-school"`). Export types:
   `Subject`, `YearLevel`, `SubjectId`, `YearLevelId` (id unions derived from
   the const arrays), and a `Taxonomy` type `{ subjects; yearLevels }`.
   Depends on: none.
2. **Add taxonomy service** — Create `src/lib/taxonomy-service.ts`. Implement
   `getTaxonomy(): Taxonomy` returning `{ subjects: SUBJECTS, yearLevels:
   YEAR_LEVELS }`. Implement `validateSubjectIds(ids: string[])` and
   `validateYearLevelIds(ids: string[])`: reject empty/undefined input
   (min-cardinality "at least one"), reject any id not present in the
   corresponding const set, and on success return the narrowed valid ids.
   Define a clear, catchable error contract (e.g. throw a typed
   `TaxonomyValidationError` or return a discriminated `{ ok, errors }` result —
   coder's choice, but it must distinguish "empty" from "unknown id" so #4 can
   surface a 422 with a clear message). Depends on: step 1.
3. **Add taxonomy API route** — Create `src/app/api/taxonomy/route.ts`. Export
   an `async GET` that calls `getTaxonomy()` and returns
   `NextResponse.json({ subjects, yearLevels }, { status: 200 })`. Mirror the
   import style and signature of `src/app/api/health/route.ts`. Do not add a
   POST/PUT handler (unsupported methods return 405 automatically). Depends on:
   step 2.
4. **Document the endpoint** — In `README.md`, add `GET /api/taxonomy` to the
   API section alongside the existing health-endpoint entry, noting the response
   shape `{ subjects: [{id,label}], yearLevels: [{id,label}] }`. Depends on:
   step 3.

## Files
### Create
- `src/lib/taxonomy.ts` — typed seed constants + exported id/entity/`Taxonomy` types.
- `src/lib/taxonomy-service.ts` — `getTaxonomy`, `validateSubjectIds`, `validateYearLevelIds`.
- `src/app/api/taxonomy/route.ts` — thin `GET` handler returning `{ subjects, yearLevels }`.

### Modify
- `README.md` — document the new `GET /api/taxonomy` endpoint (keeps docs accurate).

### Delete
- None.

## Data / schema / migration
None owned here. DB tables (`subjects`, `year_levels`, `resource_subjects`,
`resource_year_levels`), seed inserts, and the DB/ORM client are owned by **#3**.
Constraint for #3: seed row ids/labels **must** match `src/lib/taxonomy.ts`
exactly, and taxonomy ids must be stable `TEXT` PKs (not `SERIAL`) so validation
is consistent across environments. Backward compatibility: the vocabulary is
additive-only — new subjects/year levels can be appended without altering
existing ids (satisfies #17's migration-path requirement).

## Rollout
- Feature flag? No — purely additive new module and endpoint; nothing existing changes.
- Backfill? No — no data owned by this ticket.
- Ordering: None for this ticket's deliverables. Cross-ticket: #3's join-table
  migrations must run after #4's `resources` table (FK dependency) — noted for
  the orchestrator, not actioned here.

## Assumptions and non-decisions
- In-memory constants (no DB read) are the MVP transport, per `impact.md`'s
  unblock path; if #3 later wants the endpoint to read the DB, `getTaxonomy()` is
  the single seam to swap without changing the wire contract.
- Response keys are `subjects` and `yearLevels` (camelCase), item keys `id` and
  `label` — this is the frozen wire contract #4/#6 depend on.
- Exact error type/shape from the validators is left to the coder, provided it
  distinguishes "empty" vs "unknown id".
- Slug spelling of ids is proposed above; coder may adjust casing/wording but
  must keep them stable slugs and inform #3 of final values.

## Not doing
- No database client, ORM, migrations, or seed SQL (owned by #3).
- No resource entity, create/update handlers, or resource UI (owned by #4).
- No filter/search query logic or listing endpoint (owned by #6).
- No admin/CRUD UI for editing the taxonomy (out of MVP scope).
- No tests — owned by the test planner.
