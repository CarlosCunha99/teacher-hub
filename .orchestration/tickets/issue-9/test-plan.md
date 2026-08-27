# Test plan

## Coverage summary
- Unit tests: 21 new, 0 updated
- Functional/integration tests: 12 new, 0 updated
- Existing regression tests preserved: yes — `env-config.test.ts`, `readme.test.ts`, `scripts.test.ts`, `typescript.test.ts`, and the `/api/health` route test are not modified in content, but they are sensitive to two required changes (`.env.example` gains `DATABASE_URL`, `README.md` gains a terms/env section) and to any new source files needing to typecheck/build cleanly. No existing test file is edited by this ticket; passing continues to depend on those two doc/env additions being present.

## Test runner
- Framework: Vitest (`vitest run`), colocated `__tests__` directories, `describe`/`it`/`expect` globals (matches existing suite style, no new test tooling needed).
- Command: `npm test` (runs `vitest run`, the full suite including regression tests).
- Fast subset: `npx vitest run src/lib/__tests__/terms.test.ts src/lib/__tests__/terms-acceptance.test.ts src/app/api/terms-acceptance/__tests__/route.test.ts src/app/api/upload/__tests__/route.test.ts src/components/__tests__/TermsAcceptanceModal.test.tsx src/app/settings/__tests__/page.test.tsx src/app/terms/__tests__/page.test.tsx`

## Behaviors to test

### Unit

- **Terms module exposes a current version and non-empty text** — `CURRENT_TERMS_VERSION` is a defined, non-empty string and `TERMS_TEXT` (or equivalent export) is a non-empty string.
  - File: `src/lib/__tests__/terms.test.ts` (new)
  - Key assertions:
    - `typeof CURRENT_TERMS_VERSION === "string"` and length > 0
    - Terms text export is a non-empty string
  - Setup: none (pure module import)
  - Maps to acceptance criterion: "The terms-of-use text is stored in the application and carries an explicit, comparable version identifier."

- **`hasAcceptedCurrentTerms` returns false when no acceptance record exists** — a teacher with zero acceptance rows for any version is reported as not accepted.
  - File: `src/lib/__tests__/terms-acceptance.test.ts` (new)
  - Key assertions:
    - `hasAcceptedCurrentTerms(teacherId)` resolves to `false` when the mocked DB query returns no rows for that teacher
  - Setup: mock/stub DB client (`src/lib/db.ts`) so no live Postgres connection is required; inject a fake query result of `[]`
  - Maps to acceptance criterion: "The upload request path (server-side) rejects uploads from teachers who have no acceptance record for the current terms version."

- **`hasAcceptedCurrentTerms` returns true when the teacher's latest acceptance matches `CURRENT_TERMS_VERSION`** — only the version axis changes; teacher identity and DB behavior are held constant relative to the previous case.
  - File: `src/lib/__tests__/terms-acceptance.test.ts` (new)
  - Key assertions:
    - `hasAcceptedCurrentTerms(teacherId)` resolves to `true` when the mocked DB returns one row with `terms_version === CURRENT_TERMS_VERSION`
  - Setup: same mocked DB client; row fixture `{ teacher_id: teacherId, terms_version: CURRENT_TERMS_VERSION, accepted_at: <ISO string> }`
  - Maps to acceptance criterion: "A teacher who has already accepted the current terms version is not re-prompted on subsequent uploads."

- **`hasAcceptedCurrentTerms` returns false when the teacher's latest acceptance is for an older version** — isolates the version-mismatch axis only (same teacher, same DB shape, only the stored version differs from the case above).
  - File: `src/lib/__tests__/terms-acceptance.test.ts` (new)
  - Key assertions:
    - `hasAcceptedCurrentTerms(teacherId)` resolves to `false` when the mocked row has `terms_version` !== `CURRENT_TERMS_VERSION` (e.g. `"2024-01-01"` vs current)
  - Setup: same mocked DB client, row fixture with an older version string
  - Maps to acceptance criterion: "When the terms are updated to a new version, previously-accepted teachers are ... required to act before their next upload" (forced re-acceptance / version-bump semantics per solution.md)

- **`recordAcceptance` writes teacher id, version, and timestamp** — the write path persists all three required fields.
  - File: `src/lib/__tests__/terms-acceptance.test.ts` (new)
  - Key assertions:
    - The mocked DB `insert`/`query` call receives `teacherId`, `CURRENT_TERMS_VERSION` (or the version argument passed in), and a timestamp value (either DB-default `NOW()` or an explicit `accepted_at` argument, whichever the implementation produces)
    - `recordAcceptance` resolves without throwing on a successful insert
  - Setup: mocked DB client capturing call arguments (e.g. `vi.fn()` spy)
  - Maps to acceptance criterion: "When a teacher accepts, the system records an acceptance consisting of at least: the teacher's identity, the accepted terms version, and a timestamp."

- **`recordAcceptance` handles a duplicate-acceptance race without throwing an unhandled error** — a second concurrent call for the same `(teacherId, version)` pair hits the unique-constraint violation and is treated as a no-op success, not surfaced as a 500.
  - File: `src/lib/__tests__/terms-acceptance.test.ts` (new)
  - Key assertions:
    - When the mocked DB client rejects with a simulated unique-violation error (e.g. Postgres error code `23505`) on the second call, `recordAcceptance` resolves (does not rethrow) or resolves to an idempotent result
  - Setup: mock DB client whose second invocation rejects with a fixture error shaped like a Postgres unique-violation
  - Maps to acceptance criterion: edge case "Two concurrent first-upload attempts from the same teacher must not create duplicate or conflicting acceptance records."

### Functional / integration

- **`GET /api/terms-acceptance` reports not-accepted for a teacher with no record** — status check endpoint reflects DB state.
  - File: `src/app/api/terms-acceptance/__tests__/route.test.ts` (new)
  - Preconditions: mocked/stubbed session identity resolves to a fixed teacher id; mocked `hasAcceptedCurrentTerms` returns `false`
  - Actions: call the route's exported `GET` handler with a `Request`
  - Assertions: response status `200`; body equals `{ accepted: false }` (no `version`/`acceptedAt` keys, or they are `undefined`/absent per the documented shape)
  - Cleanup: restore mocks between tests
  - Maps to acceptance criterion: "A teacher can view which terms version they accepted (and when) from their account/settings area" (status read path) and "not re-prompted" logic depends on this read.

- **`GET /api/terms-acceptance` reports accepted with version and timestamp for a teacher with a matching-version record** — only the "has accepted" axis changes vs. the previous test; same route, same mocked session.
  - File: `src/app/api/terms-acceptance/__tests__/route.test.ts` (new)
  - Preconditions: same session mock; `hasAcceptedCurrentTerms`-backing data mocked to return an acceptance row for the current version
  - Actions: call `GET`
  - Assertions: response status `200`; body equals `{ accepted: true, version: CURRENT_TERMS_VERSION, acceptedAt: <ISO timestamp> }`
  - Cleanup: restore mocks
  - Maps to acceptance criterion: "A teacher can view which terms version they accepted (and when) from their account/settings area."

- **`POST /api/terms-acceptance` records acceptance and returns 201** — the write endpoint persists and confirms.
  - File: `src/app/api/terms-acceptance/__tests__/route.test.ts` (new)
  - Preconditions: mocked session identity; mocked `recordAcceptance` resolves successfully
  - Actions: call `POST` with a `Request` whose JSON body is `{ version: CURRENT_TERMS_VERSION }`
  - Assertions: response status `201`; body contains `acceptedAt` (ISO timestamp string); `recordAcceptance` mock was called with the session's teacher id and the current version
  - Cleanup: restore mocks
  - Maps to acceptance criterion: "When a teacher accepts, the system records an acceptance consisting of at least: the teacher's identity, the accepted terms version, and a timestamp."

- **`POST /api/terms-acceptance` rejects a body requesting an outdated/incorrect version** — isolates the "wrong version submitted" axis (same teacher, same route, only the request body version differs from the previous accepted-write test).
  - File: `src/app/api/terms-acceptance/__tests__/route.test.ts` (new)
  - Preconditions: same session mock
  - Actions: call `POST` with body `{ version: "not-the-current-version" }`
  - Assertions: response status `400` (or documented error status); `recordAcceptance` mock was not called
  - Cleanup: restore mocks
  - Maps to acceptance criterion: derived from "records ... the accepted terms version" — the endpoint must not silently record acceptance of a stale/incorrect version.

- **`POST /api/upload` returns 403 with `{ error: "terms_not_accepted" }` when the teacher has no acceptance for the current version** — server-side gate is authoritative regardless of UI state.
  - File: `src/app/api/upload/__tests__/route.test.ts` (new)
  - Preconditions: mocked session identity resolves to a teacher id; `hasAcceptedCurrentTerms` mocked to return `false`
  - Actions: call the upload route's `POST` handler with a representative upload request
  - Assertions: response status `403`; body equals `{ error: "terms_not_accepted" }`; no upload-processing side effect occurs (e.g. underlying upload logic mock is not invoked)
  - Cleanup: restore mocks
  - Maps to acceptance criterion: "The upload request path (server-side) rejects uploads from teachers who have no acceptance record for the current terms version — the block cannot be bypassed by skipping the UI."

- **`POST /api/upload` proceeds past the terms gate when the teacher has accepted the current version** — only the acceptance-state axis changes vs. the previous test; same route, same session mock.
  - File: `src/app/api/upload/__tests__/route.test.ts` (new)
  - Preconditions: same session mock; `hasAcceptedCurrentTerms` mocked to return `true`
  - Actions: call `POST` with the same representative upload request
  - Assertions: response status is **not** `403`/not the terms-blocked shape (given #4 is unbuilt, assert the gate is bypassed — e.g. the handler proceeds to its stub/placeholder success path — rather than asserting a full upload-success contract that doesn't exist yet)
  - Cleanup: restore mocks
  - Maps to acceptance criterion: "A teacher who has accepted the current terms can upload without seeing the terms prompt again" (server-side half of this behavior).

- **`POST /api/upload` returns 403 when the teacher's only acceptance record is for a version older than `CURRENT_TERMS_VERSION`** — isolates the version-bump/re-acceptance axis (same teacher and route as above, only the stored version is stale rather than absent).
  - File: `src/app/api/upload/__tests__/route.test.ts` (new)
  - Preconditions: session mock; `hasAcceptedCurrentTerms` mocked to return `false` because the underlying record is for an old version (test documents this distinction from "no record at all" even though the route's observable behavior is the same 403)
  - Actions: call `POST`
  - Assertions: response status `403`; body equals `{ error: "terms_not_accepted" }`
  - Cleanup: restore mocks
  - Maps to acceptance criterion: "When the terms are updated to a new version, previously-accepted teachers are ... required to act before their next upload" (blocking ambiguity resolved as forced re-acceptance in solution.md).

- **`TermsAcceptanceModal` renders terms text, a checkbox, and a disabled submit until checked** — UI affirmative-consent control.
  - File: `src/components/__tests__/TermsAcceptanceModal.test.tsx` (new)
  - Preconditions: render the component with a mocked `onAccept`/submit handler and mocked terms text prop or import
  - Actions: render; query for checkbox and submit button; assert submit is disabled; check the checkbox; assert submit becomes enabled
  - Assertions: checkbox present with accessible label; submit button `disabled` before check, enabled after; a link/reference to the full terms page is present (`href` to `/terms` or equivalent)
  - Cleanup: unmount / testing-library cleanup (automatic)
  - Maps to acceptance criterion: "A teacher who has not accepted the current terms version is prevented from completing their first resource upload and is presented with the current terms and an explicit affirmative acceptance control (e.g. a checkbox they must tick before continuing)."

- **`TermsAcceptanceModal` calls the acceptance API and closes/resolves on submit** — checked-and-submitted flow triggers the write path.
  - File: `src/components/__tests__/TermsAcceptanceModal.test.tsx` (new)
  - Preconditions: mock `fetch` (or the injected submit callback) to resolve successfully
  - Actions: check the checkbox, click submit
  - Assertions: the mocked submit call (`POST /api/terms-acceptance` or equivalent prop callback) is invoked exactly once with the current version; on success the modal invokes its "accepted"/close callback
  - Cleanup: restore `fetch`/mocks
  - Maps to acceptance criterion: "When a teacher accepts, the system records an acceptance..." (client trigger half) and "not re-prompted on subsequent uploads" (modal closes so it isn't shown again in the same session).

- **Upload page renders the modal when acceptance status is not accepted, and omits it when accepted** — two integration cases sharing one page/component, varying only the acceptance-status axis.
  - File: `src/app/upload/__tests__/page.test.tsx` (new)
  - Preconditions (case A): mocked server-side acceptance check resolves `{ accepted: false }`
  - Preconditions (case B): same page/component, only the mocked acceptance check resolves `{ accepted: true }`
  - Actions: render the upload page (or its server component logic) for each case
  - Assertions: case A shows `TermsAcceptanceModal` (or its trigger) and does not show the upload form controls; case B shows the upload form and does not show the modal
  - Cleanup: restore mocks between cases
  - Maps to acceptance criterion: "presented with the current terms and an explicit affirmative acceptance control" / "not re-prompted on subsequent uploads."

- **Settings page displays the teacher's accepted terms version and acceptance timestamp** — read-only account view.
  - File: `src/app/settings/__tests__/page.test.tsx` (new)
  - Preconditions: mocked acceptance-status fetch/helper returns `{ accepted: true, version: "2026-08-01", acceptedAt: "2026-08-01T12:00:00.000Z" }`
  - Actions: render the settings page
  - Assertions: rendered output contains the version string and a human-readable rendering of the timestamp
  - Cleanup: restore mocks
  - Maps to acceptance criterion: "A teacher can view which terms version they accepted (and when) from their account/settings area."

- **Terms page renders the current terms text and is reachable/linkable** — standalone page requirement.
  - File: `src/app/terms/__tests__/page.test.tsx` (new)
  - Preconditions: none beyond importing `src/lib/terms.ts`
  - Actions: render the terms page component
  - Assertions: rendered output contains the terms text (or a recognizable substring of it) and the terms version identifier
  - Cleanup: none
  - Maps to acceptance criterion: "The terms of use content is reachable as a readable page/view that can be linked from the acceptance prompt (and, per #12, from the authentication and upload flows)."

## Edge cases covered
- Concurrent first-upload race producing duplicate/conflicting acceptance records → tested by: "`recordAcceptance` handles a duplicate-acceptance race without throwing an unhandled error" (unit).
- Version-bump semantics (forced re-acceptance, not just notification) → tested by: "`hasAcceptedCurrentTerms` returns false when the teacher's latest acceptance is for an older version" (unit) and "`POST /api/upload` returns 403 when the teacher's only acceptance record is for a version older than `CURRENT_TERMS_VERSION`" (integration).
- Server-authoritative enforcement (cannot bypass via UI) → tested by: both `POST /api/upload` 403/pass-through tests, which exercise the route handler directly without going through any UI layer.
- Accessibility of the acceptance control (keyboard/screen-reader) → **not tested** — see "Not tested" below.

## Not tested (with reason)
- Full end-to-end upload success after acceptance (actual file storage/processing) — the upload workflow itself is issue #4, still unbuilt; the upload-route test only asserts the terms gate is bypassed, not a complete upload contract, per impact.md's stub-route caveat.
- Real PostgreSQL integration (actual DB round-trip against a live `terms_acceptances` table) — no CI/local Postgres infra exists yet per impact.md; all DB interactions are tested via a mocked `src/lib/db.ts` client. Real-DB verification is deferred to when issue #3 provisions the database and should be covered by a follow-up manual/integration test against a real instance.
- Real authentication/session resolution — issue #2 is unbuilt; all routes are tested with a mocked/stubbed session identity function, not a real auth flow.
- Automated accessibility assertions (axe/screen-reader simulation) for the modal and terms page — no a11y test tooling exists in the repo today (per impact.md, "no a11y conventions found in-repo"); covered by manual verification only, flagged as a follow-up for whoever adds a11y tooling.
- Notification/reminder UI copy or channel for teachers on version bump (e.g. banner, email) — solution.md resolves this ambiguity as forced re-acceptance via the existing block-and-modal mechanism, so no separate notification component exists to test; the re-block behavior itself is covered by the version-mismatch tests above.

## Fixtures & data
- `CURRENT_TERMS_VERSION` fixture value: reuse the real exported constant from `src/lib/terms.ts` in tests rather than a separate fixture, so tests fail if implementation and fixture drift.
- Mocked DB client: a `vi.mock("@/lib/db")` (or equivalent) module mock shared across `terms-acceptance.test.ts` and the two route test files, returning a `vi.fn()`-based query/insert interface so call arguments and resolved/rejected values can be asserted per test case.
- Mocked session identity: a shared test helper (e.g. `src/lib/__tests__/test-utils/mockSession.ts`, new) that stubs whatever minimal session-resolution function the routes/pages call, returning a fixed teacher id (e.g. `"teacher-1"`) — needed because auth (#2) doesn't exist yet; both API route tests and page tests depend on it.
- Sample acceptance row fixture: `{ teacher_id: "teacher-1", terms_version: <version>, accepted_at: <ISO string> }`, parameterized by version to drive the independent version-axis test cases.

## Reproduction test (bugs only)
- Not applicable — this is a feature ticket, not a bug fix. No `reproduction.md` was provided and none is required.
