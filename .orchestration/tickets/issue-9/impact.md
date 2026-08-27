# Impact analysis

## Direct changes

- `src/lib/terms.ts` *(new)* — exports `CURRENT_TERMS_VERSION` constant and terms text; single source-of-truth for version comparisons across the gate and UI
- `src/lib/db.ts` *(new)* — DB client (PostgreSQL connection) used by the acceptance-check and acceptance-write helpers
- `src/lib/terms-acceptance.ts` *(new)* — `hasAcceptedCurrentTerms(teacherId)` and `recordAcceptance(teacherId, version)` helper functions; the server-side gate logic lives here
- `src/app/api/terms-acceptance/route.ts` *(new)* — `POST /api/terms-acceptance` (write acceptance record) and `GET /api/terms-acceptance` (check status for the current user); reads session identity, calls `recordAcceptance` / `hasAcceptedCurrentTerms`
- `src/app/api/upload/route.ts` *(new)* — Upload API route; calls `hasAcceptedCurrentTerms` before processing; returns HTTP 403 with a structured error body if terms not yet accepted
- `src/app/terms/page.tsx` *(new)* — Static terms-of-use page; renders terms text from `src/lib/terms.ts`; linked from the acceptance modal and auth flows
- `src/components/TermsAcceptanceModal.tsx` *(new)* — Client component rendered on the upload page when the teacher has no valid acceptance; checkbox + submit calls `POST /api/terms-acceptance`
- `src/app/upload/page.tsx` *(new)* — Upload page; fetches acceptance status server-side; conditionally renders `TermsAcceptanceModal` before showing the upload form
- `src/app/settings/page.tsx` *(new)* — Account settings page; fetches and displays accepted terms version + timestamp for the current user
- `migrations/<timestamp>_create_terms_acceptances.sql` *(new)* — Creates `terms_acceptances(id, teacher_id, terms_version, accepted_at)` table; unique constraint on `(teacher_id, terms_version)` to prevent duplicate rows on concurrent first-upload race
- `.env.example` *(modified)* — Must add `DATABASE_URL=` entry (currently absent from project; `env-config.test.ts` validates this file)
- `README.md` *(modified)* — Add "Terms of use" section and document `DATABASE_URL` env var; the existing `readme.test.ts` checks for `.env|environment variable` documentation

## Indirect: callers & consumers

- `src/app/api/health/route.ts` calls nothing that changes — impact: **none**
- `src/lib/health.ts` is unrelated to terms logic — impact: **none**
- `src/__tests__/env-config.test.ts` validates `.env.example`; adding `DATABASE_URL` to that file keeps the test green — impact: **behavior-change** (test stays passing only if `.env.example` is updated in the same PR)
- `src/__tests__/readme.test.ts` checks README documents env config — impact: **behavior-change** (test stays passing only if README is updated)
- `src/__tests__/scripts.test.ts` runs `npm run build`; adding new source files and potentially new npm dependencies (DB driver, ORM) may extend build time and must not introduce build errors — impact: **behavior-change** (build must succeed with new files)
- `src/__tests__/typescript.test.ts` runs `tsc --noEmit`; all new `.ts`/`.tsx` files must be type-correct — impact: **compile-break** if any new file has type errors

## Public API surface

- Exported: `CURRENT_TERMS_VERSION` in `src/lib/terms` — new constant; consumed by acceptance helpers and UI
- Exported: `hasAcceptedCurrentTerms(teacherId: string): Promise<boolean>` in `src/lib/terms-acceptance` — new function
- Exported: `recordAcceptance(teacherId: string, version: string): Promise<void>` in `src/lib/terms-acceptance` — new function
- HTTP endpoint: `POST /api/terms-acceptance` — new route; body `{ version: string }`; response `201 { acceptedAt: string }`
- HTTP endpoint: `GET /api/terms-acceptance` — new route; response `200 { accepted: boolean, version?: string, acceptedAt?: string }`
- HTTP endpoint: `POST /api/upload` — new route; returns `403 { error: "terms_not_accepted" }` when gate fires

**Breaking:** None. All changes are additive; no existing symbols are modified.

## Tests affected

- `src/__tests__/env-config.test.ts` — `.env.example` must gain `DATABASE_URL=`; test currently passes, will break if the file change is omitted
- `src/__tests__/readme.test.ts` — README must document new env var; test currently passes, will break if README is not updated
- `src/__tests__/scripts.test.ts` — `npm run build` must succeed with all new files and any new npm dependencies added; currently passes, sensitive to new syntax/import errors
- `src/__tests__/typescript.test.ts` — `tsc --noEmit` must pass; sensitive to type errors in any of the ~8 new source files
- `src/app/api/health/__tests__/route.test.ts` — unaffected; health route unchanged
- *(new)* `src/lib/__tests__/terms.test.ts` — unit tests for `CURRENT_TERMS_VERSION` export and terms text shape
- *(new)* `src/lib/__tests__/terms-acceptance.test.ts` — unit tests for `hasAcceptedCurrentTerms` and `recordAcceptance` (requires DB mock)
- *(new)* `src/app/api/terms-acceptance/__tests__/route.test.ts` — integration tests for GET/POST endpoints (requires session mock)
- *(new)* `src/app/api/upload/__tests__/route.test.ts` — tests that upload returns 403 when no acceptance record, 200 when accepted
- *(new)* `src/components/__tests__/TermsAcceptanceModal.test.tsx` — rendering and checkbox interaction tests

## Docs to update

- `README.md` — "Environment variables" section: add `DATABASE_URL` with description; "Architecture" section: mention terms-acceptance gate, new routes, and settings page

## Migrations / config / infra

- `migrations/<timestamp>_create_terms_acceptances.sql` — new table `terms_acceptances(id SERIAL PRIMARY KEY, teacher_id TEXT NOT NULL, terms_version TEXT NOT NULL, accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(teacher_id, terms_version))`; append-only by design (no UPDATE/DELETE in application layer)
- `.env.example` — add `DATABASE_URL=postgres://user:password@localhost:5432/teacher_hub`
- `CURRENT_TERMS_VERSION` in `src/lib/terms.ts` — app-level config key; bumping this value re-engages the upload block for all previously-accepted teachers
- `package.json` — new runtime dependency required: a PostgreSQL client (e.g. `pg` + `@types/pg`, or an ORM such as Prisma/Drizzle); not currently present

## External systems

- **PostgreSQL database** — new dependency for the project; the `terms_acceptances` table must be provisioned before any acceptance calls succeed; local dev requires a running Postgres instance; CI/CD environment must supply `DATABASE_URL`

## Estimated diff size

- **Files touched:** ~14 (8 new source files, 2 new migration files, 2 new test suites for existing infrastructure, README, .env.example) + ~5 new test files = ~19 total
- **Rough lines changed:** ~600–800 production lines; ~300–400 test/fixture lines
- **Confidence:** medium — auth (#2), DB (#3), and upload (#4) are unbuilt stubs; the exact shape of session identity and DB client will drive churn in `terms-acceptance.ts` and the upload route
- **Downstream churn:** The new `terms_acceptances` DB schema is a persisted shape change. DB migration file (1), acceptance helper tests (mocks of the table shape, ~50 lines), and upload-route tests (fixture for the 403 payload, ~30 lines) must all be counted — included above. The `POST /api/terms-acceptance` response body `{ acceptedAt }` is a new wire format; its shape is tested in route tests (~20 lines of fixture). Total fixture/test rewrite cost: ~100 lines.

## Warnings

- **Auth dependency not yet built (#2):** Both API routes (`/api/terms-acceptance`, `/api/upload`) must read the authenticated teacher's identity from the session. Auth is an open issue; until it exists these routes cannot be wired end-to-end. The gate will need to be built against a stub/mock session layer and replaced when #2 ships.
- **DB dependency not yet built (#3):** PostgreSQL and the application DB client do not exist in the project. Adding a DB client (pg, Prisma, Drizzle) introduces a new transitive dependency tree and may require CI/CD infrastructure changes (Postgres service in pipeline).
- **Upload workflow not yet built (#4):** The upload API route is being introduced by this ticket as a stub with only the terms gate; its actual file-handling logic comes from #4. There is a risk of merge conflict or duplication when #4 ships.
- **Concurrency / duplicate acceptance race:** Two simultaneous first-upload requests from the same teacher could race to insert an acceptance record. The `UNIQUE(teacher_id, terms_version)` constraint in the migration handles this at the DB level, but the application layer must handle the resulting unique-violation error gracefully (idempotent upsert or caught error).
- **`CURRENT_TERMS_VERSION` is a code-level config key:** Any bump to the terms version requires a code change and redeploy to re-engage the block. This is intentional for MVP but should be flagged as a future migration path to a DB-driven config when an admin interface exists.
- **`env-config.test.ts` and `readme.test.ts` will fail** if `.env.example` and `README.md` are not updated in the same PR as the source changes — these are pre-existing enforcement tests that will surface the omission immediately.
