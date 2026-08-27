# Implementation context (shared A/B brief)

> This brief is for both the **coder** and the **tester**. Read it before touching any
> file. It captures codebase conventions, utilities to reuse, and commands that are
> verified to work.

---

## Files this touches

- `src/lib/terms.ts` *(new)* — `CURRENT_TERMS_VERSION` constant + `TERMS_TEXT` body
- `src/lib/db.ts` *(new)* — lazily-initialized `pg.Pool`, exports `query<T>()`
- `src/lib/auth.ts` *(new)* — narrow current-user adapter, `getCurrentTeacherId()`
- `src/lib/terms-acceptance.ts` *(new)* — `hasAcceptedCurrentTerms`, `getAcceptanceStatus`, `recordAcceptance`
- `src/app/api/terms-acceptance/route.ts` *(new)* — `GET` (status) + `POST` (accept)
- `src/app/api/upload/route.ts` *(new)* — server-side terms gate + placeholder boundary
- `src/app/terms/page.tsx` *(new)* — readable full terms page
- `src/components/TermsAcceptanceModal.tsx` *(new)* — checkbox + submit acceptance UI
- `src/app/upload/page.tsx` *(new)* — renders modal or upload form based on status
- `src/app/settings/page.tsx` *(new)* — shows accepted version/timestamp or stale status
- `migrations/001_create_terms_acceptances.sql` *(new)* — append-only acceptance table
- `package.json` *(modified)* — adds `pg` (runtime) and `@testing-library/react`,
  `jsdom`, `@types/pg` (dev)
- `.env.example` *(modified)* — uncomments/activates `DATABASE_URL=`
- `README.md` *(modified)* — documents `DATABASE_URL`, new routes, version-bump behavior
- `src/lib/__tests__/terms.test.ts` *(new)* — unit tests for terms module
- `src/lib/__tests__/terms-acceptance.test.ts` *(new)* — unit tests, mocked `@/lib/db`
- `src/app/api/terms-acceptance/__tests__/route.test.ts` *(new)* — GET/POST integration tests
- `src/app/api/upload/__tests__/route.test.ts` *(new)* — gate/pass-through integration tests
- `src/components/__tests__/TermsAcceptanceModal.test.tsx` *(new)* — jsdom rendering test
- `src/app/upload/__tests__/page.test.tsx` *(new)* — jsdom rendering test, both status cases
- `src/app/settings/__tests__/page.test.tsx` *(new)* — jsdom rendering test
- `src/app/terms/__tests__/page.test.tsx` *(new)* — jsdom rendering test
- `src/lib/__tests__/test-utils/mockSession.ts` *(new, test-only)* — shared
  `MOCK_TEACHER_ID` constant + `createAuthModuleMock()` factory for `vi.mock("@/lib/auth")`

---

## Patterns to follow

- **Naming:** `camelCase` for functions/variables; `PascalCase` for React components,
  interfaces, and type aliases; `SCREAMING_SNAKE_CASE` for module-level constants
  (`CURRENT_TERMS_VERSION`, `TERMS_TEXT`); `kebab-case` for file/directory names except
  React component files, which are `PascalCase.tsx` (matches `TermsAcceptanceModal.tsx`
  precedent — there is no existing precedent component file, this is the first one).
- **Error handling:** Route Handlers return structured JSON error bodies with an
  appropriate HTTP status (`401`/`400`/`403`/`501`) rather than throwing. Only genuinely
  unexpected failures (DB connection errors) are allowed to propagate as uncaught
  rejections/500s — this mirrors the existing `src/app/api/health/route.ts` style of
  never throwing for expected conditions.
- **Async style:** `async`/`await` throughout, no bare `.then()` chains, no callbacks.
  All Route Handlers and data-fetching Server Components (`UploadPage`, `SettingsPage`)
  are `async function`. `TermsPage` stays synchronous since it has no I/O.
- **Testing style:** Vitest with Jest-compatible API (`describe`, `it`, `expect`).
  Arrange/Act/Assert inside each `it`. `beforeEach`/`afterEach` (or per-test setup) to
  reset mocks between cases — mirrors the existing `route.test.ts` pattern of
  save/restore around `process.env`. Route-handler tests import the exported `GET`/`POST`
  and invoke them directly with a constructed `Request`, exactly like
  `src/app/api/health/__tests__/route.test.ts`.
- **Module imports:** Use the `@/` path alias for all cross-directory imports (e.g.
  `import { CURRENT_TERMS_VERSION } from "@/lib/terms"`). Relative imports are only
  acceptable within the same feature folder (e.g. a test importing its sibling
  `route.ts` via `../route` is also fine, but the codebase precedent — `route.test.ts` —
  uses `@/` even for same-folder imports, so prefer `@/` consistently).
- **React Server/Client boundary:** `TermsAcceptanceModal.tsx` is the **only** new
  Client Component (`"use client"`); every `page.tsx` in this ticket is a Server
  Component. Do not pass function props from a Server Component into
  `TermsAcceptanceModal` — it is self-contained (internal `fetch` + optional
  `onAccepted` prop used only in unit tests, see contract.md Interface 8).

---

## Utilities to reuse

- `next/server::NextResponse` — `NextResponse.json(body, { status })` in every new Route
  Handler; matches `src/app/api/health/route.ts`. Do not use the raw `Response`
  constructor.
- `next/navigation::useRouter` — used only inside `TermsAcceptanceModal.tsx` for the
  default (no-`onAccepted`-prop) refresh behavior. Import from `"next/navigation"`
  (App Router), never `"next/router"`.
- `src/lib/db.ts::query` — the **only** place `pg` is imported directly; all DB access
  elsewhere goes through `query<T>(text, params)`.
- `src/lib/terms.ts::CURRENT_TERMS_VERSION` / `TERMS_TEXT` — the single source of truth;
  do not duplicate the version string or terms body as a literal anywhere else
  (tests should also import these rather than hardcoding fixture strings, per test-plan's
  fixture note).
- `src/lib/__tests__/test-utils/mockSession.ts::MOCK_TEACHER_ID` /
  `createAuthModuleMock()` — shared across `route.test.ts` (both routes) and the two
  page tests that need a resolved teacher id; avoids four separate ad-hoc auth mocks.

---

## Anti-patterns in this codebase

- **Do not instantiate `pg.Pool`/`pg.Client` outside `src/lib/db.ts`.** Every other file
  goes through `query()`.
- **Do not call `vi.mock()` from inside a helper function defined in another module.**
  Vitest's hoisting only lifts `vi.mock(...)` calls that are lexically present at the
  top level of the test file itself; wrapping it in `mockSession.ts` and calling that
  wrapper from a test file will **not** be hoisted correctly and the real `@/lib/auth`
  module will load instead. Test files must call `vi.mock("@/lib/auth", () =>
  createAuthModuleMock())` directly.
- **Do not change the global `vitest.config.ts` `test.environment` value.** It must stay
  `"node"` for every existing/route-handler test; only the four new UI test files opt
  into `jsdom` via the per-file `// @vitest-environment jsdom` pragma (contract.md
  Interface 12).
- **Do not add `@testing-library/jest-dom`.** Assert on raw DOM (`.hasAttribute`,
  `.textContent`) — keeps the new-tooling footprint to exactly two new devDependencies.
- **Do not hard-code a real auth/session mechanism in `src/lib/auth.ts`.** It is a
  placeholder for issue #2; returning `null` (or a clearly-temporary stub) is correct.
- **Do not let `POST /api/upload`'s placeholder boundary do any real file handling.**
  Issue #4 owns that; this ticket only owns the gate in front of it.
- **Do not use `lodash` or other utility libraries** — none exist in this project's
  dependency tree.
- **Do not add a GitHub Actions workflow or CI/CD infra change** for the new Postgres
  dependency — out of scope per plan.md "Not doing".
- **Do not perform `UPDATE`/`DELETE` against `terms_acceptances`** anywhere in
  application code — it is append-only by convention (enforced by code review, not a DB
  trigger).
- **Do not commit secrets** — `.env.example`'s `DATABASE_URL` stays a placeholder
  connection string; real values live only in `.env.local` (already gitignored).

---

## Sentinels

- No non-ASCII, zero-width, or private-use-area characters were observed in
  `plan.md`, `test-plan.md`, or `impact.md`. `.env.example`'s existing
  `DATABASE_URL=******localhost:5432/teacher_hub` placeholder uses six literal ASCII
  asterisk characters (`*`) as a redaction placeholder, not a special sentinel — copied
  through unchanged in contract.md Interface 13.

---

## Repo commands (verified)

- **Test:** `npm test` (maps to `vitest run`); fast subset per test-plan.md:
  `npx vitest run src/lib/__tests__/terms.test.ts src/lib/__tests__/terms-acceptance.test.ts src/app/api/terms-acceptance/__tests__/route.test.ts src/app/api/upload/__tests__/route.test.ts src/components/__tests__/TermsAcceptanceModal.test.tsx src/app/settings/__tests__/page.test.tsx src/app/terms/__tests__/page.test.tsx`
- **Lint:** `npm run lint` (maps to `next lint`)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build` (maps to `next build`)
- **Format check:** `npm run format:check` (maps to `prettier --check .`)

> All commands verified present in `package.json` as of this brief. `npm install` must
> be re-run after `package.json` gains `pg`, `@testing-library/react`, `jsdom`, and
> `@types/pg` before any of the above will pick up the new packages.

---

## Creation order constraint

1. `src/lib/terms.ts`, `src/lib/db.ts`, `src/lib/auth.ts` (no dependencies on each other)
2. `migrations/001_create_terms_acceptances.sql` + `src/lib/terms-acceptance.ts` (depends
   on `db.ts` and `terms.ts`)
3. `package.json` dependency additions + `npm install` (needed before anything imports
   `pg` or `@testing-library/react` will resolve)
4. `src/app/api/terms-acceptance/route.ts`, `src/app/api/upload/route.ts` (depend on
   step 2 + `auth.ts`)
5. `src/app/terms/page.tsx`, `src/components/TermsAcceptanceModal.tsx` (depend on
   `terms.ts`; modal has no server dependency)
6. `src/app/upload/page.tsx`, `src/app/settings/page.tsx` (depend on steps 2 and 4)
7. `.env.example`, `README.md` (documentation, last)
