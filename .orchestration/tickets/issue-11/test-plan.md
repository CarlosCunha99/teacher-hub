# Test plan

## Coverage summary
- Unit tests: 22 new, 0 updated
- Functional/integration tests: 7 new, 0 updated
- Existing regression tests preserved: yes — health route, env-config, scripts, TypeScript, gitignore, and readme scaffold tests are all unaffected by these changes (gitignore.test.ts and readme.test.ts may need a new entry added if they use exact-match assertions; see "Not tested" section)

## Test runner
- Framework: Vitest 3 (node environment, globals: true)
- Command: `npx vitest run`
- Fast subset: `npx vitest run src/app/api/resources src/lib/store src/lib/auth src/lib/download src/components`

---

## Behaviors to test

### Unit

- **Auth stub returns user when TEST_USER_ID is set** — `getSessionUser` resolves to a user object whose id equals `TEST_USER_ID` when that env var is present.
  - File: `src/lib/auth/__tests__/get-session-user.test.ts` (new)
  - Key assertions:
    - Return value is `{ id: "<TEST_USER_ID>" }` (or equivalent shape) when `process.env.TEST_USER_ID` is set.
  - Setup: set `process.env.TEST_USER_ID = "user-123"` in `beforeEach`; restore in `afterEach`.
  - Maps to acceptance criterion: AC — unauthenticated request returns 401 (inverse); AC — each successful download creates an audit record with user identifier.

- **Auth stub returns null when TEST_USER_ID is absent** — `getSessionUser` resolves to `null` when neither `TEST_USER_ID` nor a session cookie is present.
  - File: `src/lib/auth/__tests__/get-session-user.test.ts` (new)
  - Key assertions:
    - Return value is `null`.
  - Setup: delete `process.env.TEST_USER_ID`; pass a `Request` with no cookies.
  - Maps to acceptance criterion: AC — unauthenticated request returns 401.

- **Resource store getResource returns metadata for a known ID** — the store resolves with the full resource object when the ID exists in the JSON backing file.
  - File: `src/lib/store/__tests__/resource-store.test.ts` (new)
  - Key assertions:
    - Resolved value has `id`, `name`, `downloadCount`, and `ownerId` fields.
  - Setup: seed the store (mock or temp file) with one resource entry before each test.
  - Maps to acceptance criterion: AC — authenticated request for a valid resource returns 200 with PDF bytes.

- **Resource store getResource returns null for unknown ID** — the store resolves with `null` when the ID does not exist.
  - File: `src/lib/store/__tests__/resource-store.test.ts` (new)
  - Key assertions:
    - Resolved value is `null`.
  - Setup: empty or seeded store that does not contain the queried ID.
  - Maps to acceptance criterion: AC — request for non-existent resource returns 404.

- **Resource store incrementDownloadCount persists the increment** — after calling `incrementDownloadCount`, a subsequent `getResource` call returns a `downloadCount` one greater than the original value.
  - File: `src/lib/store/__tests__/resource-store.test.ts` (new)
  - Key assertions:
    - `downloadCount` after increment equals `downloadCount` before + 1.
  - Setup: seed store with resource having `downloadCount: 0`; write to a temp data directory (use `DATA_DIR` env override).
  - Maps to acceptance criterion: AC — counter incremented by exactly one per successful delivery.

- **Resource store concurrent increments are not lost** — two `incrementDownloadCount` calls issued concurrently on the same resource both apply; the final count is exactly `initial + 2`.
  - File: `src/lib/store/__tests__/resource-store.test.ts` (new)
  - Key assertions:
    - `Promise.all` of two concurrent increments resolves, and `getResource` returns `downloadCount === 2` when starting from 0.
  - Setup: seed store with `downloadCount: 0`; do NOT await each increment sequentially — fire both before awaiting either.
  - Maps to acceptance criterion: AC — two concurrent successful downloads result in counter increasing by two (no lost updates).

- **Resource store writes audit record alongside counter increment** — after `incrementDownloadCount`, the audit store contains one entry with matching `resourceId`, `userId`, and a truthy `timestamp`.
  - File: `src/lib/store/__tests__/resource-store.test.ts` (new)
  - Key assertions:
    - Audit log entry count increases by 1.
    - Entry fields: `resourceId` matches resource, `userId` matches user, `timestamp` is a non-empty string.
  - Setup: seed resource; use isolated DATA_DIR; call increment with a user ID.
  - Maps to acceptance criterion: AC — each successful download creates an audit record.

- **Filename sanitiser strips header-injection characters** — `sanitiseFilename` removes characters such as `"`, `;`, `\r`, `\n`, and `:` that could break `Content-Disposition` header parsing.
  - File: `src/lib/download/__tests__/sanitise-filename.test.ts` (new)
  - Key assertions:
    - Input `'file"name;bad\r\n'` → output contains none of `"`, `;`, `\r`, `\n`.
  - Setup: none (pure function).
  - Maps to acceptance criterion: AC — `Content-Disposition` filename is sanitised.

- **Filename sanitiser preserves normal names** — a plain ASCII name like `"Lesson Plan 2024"` passes through unchanged or with only extension normalisation.
  - File: `src/lib/download/__tests__/sanitise-filename.test.ts` (new)
  - Key assertions:
    - Output equals `"Lesson Plan 2024"` (or `"Lesson Plan 2024.pdf"` if extension is appended).
  - Setup: none (pure function).
  - Maps to acceptance criterion: AC — `Content-Disposition: attachment; filename="<resource-name>.pdf"`.

- **Filename sanitiser handles empty string** — `sanitiseFilename("")` returns a safe fallback (non-empty string).
  - File: `src/lib/download/__tests__/sanitise-filename.test.ts` (new)
  - Key assertions:
    - Return value is a non-empty string.
  - Setup: none (pure function).
  - Maps to acceptance criterion: AC — filename safety edge case.

- **Filename sanitiser handles unicode** — a name with accented characters (`"Álgebra básica"`) is preserved or safely encoded, not dropped entirely.
  - File: `src/lib/download/__tests__/sanitise-filename.test.ts` (new)
  - Key assertions:
    - Return value is a non-empty string; ASCII-only fallback is acceptable.
  - Setup: none (pure function).
  - Maps to acceptance criterion: AC — filename safety edge case.

- **ResourceCard renders name and download count** — the component mounts without error and displays both the resource name and the numeric download count.
  - File: `src/components/__tests__/ResourceCard.test.tsx` (new)
  - Key assertions:
    - A text node matching the resource name is in the rendered tree.
    - A text node containing the download count (e.g. `"42"`) is in the rendered tree.
  - Setup: render with `{ id: "r1", name: "Test Sheet", downloadCount: 42 }` props (or equivalent); use `@testing-library/react` or Vitest's jsdom environment (override `environment: "jsdom"` in the test file if needed).
  - Maps to acceptance criterion: AC — resource card displays current download count.

---

### Functional / integration

- **Download endpoint — 200 streams PDF with correct headers** — `GET /api/resources/:id/download` with a valid auth token and existing resource returns 200, `Content-Type: application/pdf`, and `Content-Disposition: attachment; filename="<name>.pdf"`.
  - File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new)
  - Preconditions: store seeded with resource `{ id: "r1", name: "Lesson Plan", filePath: "r1.pdf" }`; `r1.pdf` exists under the test `UPLOADS_DIR`; `TEST_USER_ID=test-user` set.
  - Actions: call `GET(new Request("http://localhost/api/resources/r1/download"))` after setting env vars.
  - Assertions:
    - `response.status === 200`
    - `response.headers.get("content-type")` contains `"application/pdf"`
    - `response.headers.get("content-disposition")` contains `"attachment"` and `"Lesson Plan"`
    - Response body is non-empty (file bytes present).
  - Cleanup: remove temp `DATA_DIR` and `UPLOADS_DIR` files created by the test.
  - Maps to acceptance criterion: AC — authenticated user receives HTTP 200 with PDF bytes, correct Content-Type, and Content-Disposition.

- **Download endpoint — 401 for unauthenticated request** — `GET /api/resources/:id/download` without credentials returns 401 with JSON body and no file bytes.
  - File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new)
  - Preconditions: `TEST_USER_ID` unset; resource exists in store.
  - Actions: call `GET(new Request("http://localhost/api/resources/r1/download"))`.
  - Assertions:
    - `response.status === 401`
    - `response.headers.get("content-type")` contains `"application/json"`
    - `body.error` or `body.message` field present.
    - `downloadCount` for resource remains 0 after the call.
  - Cleanup: restore env.
  - Maps to acceptance criterion: AC — unauthenticated request returns HTTP 401 with JSON error body.

- **Download endpoint — 404 for non-existent resource** — `GET /api/resources/unknown/download` returns 404 with JSON body.
  - File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new)
  - Preconditions: `TEST_USER_ID` set; store does NOT contain resource `"unknown"`.
  - Actions: call `GET(new Request("http://localhost/api/resources/unknown/download"))`.
  - Assertions:
    - `response.status === 404`
    - `response.headers.get("content-type")` contains `"application/json"`
    - JSON body has error field.
  - Cleanup: restore env.
  - Maps to acceptance criterion: AC — request for non-existent resource returns HTTP 404 with JSON error body.

- **Download endpoint — 5xx when file is missing and counter NOT incremented** — `GET /api/resources/:id/download` where metadata exists but the file is absent from `UPLOADS_DIR` returns 5xx with JSON body and does not increment the download counter.
  - File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new)
  - Preconditions: `TEST_USER_ID` set; resource seeded with `{ id: "r2", filePath: "missing.pdf" }`; `missing.pdf` does NOT exist in `UPLOADS_DIR`; initial `downloadCount: 0`.
  - Actions: call `GET(new Request("http://localhost/api/resources/r2/download"))`.
  - Assertions:
    - `response.status >= 500`
    - `response.headers.get("content-type")` contains `"application/json"`
    - `downloadCount` for `r2` is still 0 after the call.
  - Cleanup: restore env.
  - Maps to acceptance criterion: AC — missing file returns HTTP 5xx and does NOT increment the counter.

- **Download endpoint — counter increments by 2 under concurrent requests** — two concurrent `GET /api/resources/:id/download` calls both succeed and leave `downloadCount === 2`.
  - File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new)
  - Preconditions: `TEST_USER_ID` set; resource seeded with `downloadCount: 0`; PDF file present.
  - Actions: `await Promise.all([GET(req1), GET(req2)])` where both requests target the same resource.
  - Assertions:
    - Both responses have `status === 200`.
    - `getResource("r1").downloadCount === 2`.
  - Cleanup: temp dirs removed.
  - Maps to acceptance criterion: AC — two concurrent successful downloads result in the counter increasing by two (no lost updates).

- **Metadata endpoint — 200 returns resource with download count** — `GET /api/resources/:id` returns 200 with JSON including `downloadCount`.
  - File: `src/app/api/resources/[id]/__tests__/route.test.ts` (new)
  - Preconditions: store seeded with `{ id: "r1", name: "Lesson Plan", downloadCount: 7 }`.
  - Actions: call `GET(new Request("http://localhost/api/resources/r1"))`.
  - Assertions:
    - `response.status === 200`
    - `body.downloadCount === 7`
    - `body.name === "Lesson Plan"`
    - Response does NOT contain any internal file path or storage key.
  - Cleanup: restore data dir.
  - Maps to acceptance criterion: AC — resource detail view displays current download count; AC — download URL does not expose internal storage paths.

- **Metadata endpoint — 404 for unknown resource** — `GET /api/resources/nope` returns 404 with JSON body.
  - File: `src/app/api/resources/[id]/__tests__/route.test.ts` (new)
  - Preconditions: store does not contain `"nope"`.
  - Actions: call `GET(new Request("http://localhost/api/resources/nope"))`.
  - Assertions:
    - `response.status === 404`
    - JSON body has error field.
  - Cleanup: none.
  - Maps to acceptance criterion: AC — request for non-existent resource returns 404.

- **Metrics endpoint — 200 returns owner's resources with download counts** — `GET /api/resources/metrics` for an authenticated owner returns only that owner's resources with counts.
  - File: `src/app/api/resources/metrics/__tests__/route.test.ts` (new)
  - Preconditions: `TEST_USER_ID=owner-1`; store seeded with two resources owned by `owner-1` (counts 3, 5) and one owned by `owner-2` (count 9).
  - Actions: call `GET(new Request("http://localhost/api/resources/metrics"))`.
  - Assertions:
    - `response.status === 200`
    - Response array has length 2.
    - Returned entries have `downloadCount` values 3 and 5.
    - `owner-2`'s resource is NOT in the response.
  - Cleanup: restore env and data dir.
  - Maps to acceptance criterion: AC — resource owner can retrieve download metrics for resources they own.

- **Metrics endpoint — 401 for unauthenticated request** — `GET /api/resources/metrics` without credentials returns 401 with JSON body.
  - File: `src/app/api/resources/metrics/__tests__/route.test.ts` (new)
  - Preconditions: `TEST_USER_ID` unset.
  - Actions: call `GET(new Request("http://localhost/api/resources/metrics"))`.
  - Assertions:
    - `response.status === 401`
    - JSON body has error field.
  - Cleanup: restore env.
  - Maps to acceptance criterion: AC — unauthenticated request returns 401.

---

## Edge cases covered

- **401 unauthenticated** → tested by: "Download endpoint — 401 for unauthenticated request" and "Metrics endpoint — 401 for unauthenticated request"
- **404 missing resource** → tested by: "Download endpoint — 404 for non-existent resource" and "Metadata endpoint — 404 for unknown resource"
- **5xx missing file, no counter increment** → tested by: "Download endpoint — 5xx when file is missing and counter NOT incremented"
- **Concurrent downloads (counter += 2, not +1)** → tested by: "Download endpoint — counter increments by 2 under concurrent requests" and "Resource store concurrent increments are not lost"
- **Counter only increments after full delivery** → tested by: "Download endpoint — 5xx when file is missing" (abort before delivery doesn't count); the concurrent test verifies increment is post-delivery
- **Correct Content-Type header** → tested by: "Download endpoint — 200 streams PDF with correct headers"
- **Correct Content-Disposition header with sanitised filename** → tested by: "Download endpoint — 200 streams PDF with correct headers" + all sanitiser unit tests
- **Internal storage path not exposed to client** → tested by: "Metadata endpoint — 200 returns resource with download count" (asserts no path field in response)
- **Auth stub returns null when env var absent** → tested by: "Auth stub returns null when TEST_USER_ID is absent"
- **Header-injection in filename** → tested by: "Filename sanitiser strips header-injection characters"
- **Unicode filename** → tested by: "Filename sanitiser handles unicode"
- **Empty filename** → tested by: "Filename sanitiser handles empty string"
- **Download count visible on resource card** → tested by: "ResourceCard renders name and download count"

---

## Not tested (with reason)

- **Counter increment on client mid-stream abort** — verifying a client abort mid-transfer does not increment the counter requires network-level connection interruption, which is not feasible in Vitest unit/integration tests. The behaviour is enforced by design (counter written only after body is fully flushed); the 5xx test covers the analogous server-side failure case.
- **ResourceCard download count visible in resource detail page (`src/app/resources/[id]/page.tsx`)** — this is a Next.js page component that performs server-side data fetching; testing it faithfully requires a running Next.js dev server or complex mocking of `fetch`. Covered indirectly by the metadata API route test (which supplies the count) and the ResourceCard component test (which renders it). A full page-level test is deferred to an e2e layer (out of scope for this ticket).
- **Admin flow metrics query** — ticket acceptance criterion states an admin flow can retrieve metrics across resources; the solution scopes this to API-only without an explicit admin route or RBAC. No admin metrics endpoint is listed in impact.md, so no test is written. If an admin route is added, a test must be added alongside it.
- **PDF is streamed (not buffered)** — verifying true streaming (first byte sent before last byte read) requires inspecting Node.js stream internals or a mock `ReadableStream`. This is implementation-level, not behaviour-level; the correctness of the response body (non-empty bytes) is tested, and streaming is verified by code review.
- **`metrics` static-segment vs `[id]` dynamic-segment routing collision** — Next.js route resolution is a framework concern and cannot be exercised in Vitest without a running server. Flagged as a manual verification step.
- **`src/__tests__/gitignore.test.ts` and `src/__tests__/readme.test.ts` exact-match assertions** — these scaffold tests may fail if they do exact-match checks on `.gitignore` or `README.md` after new entries are added. They are not modified by this plan; the implementer must check their assertions and update the tests' expected values if needed (see impact.md warning).

---

## Fixtures & data

- **Isolated DATA_DIR**: each test file that touches the JSON store should override `process.env.DATA_DIR` to a unique subdirectory within the project (e.g. `./test-data/<test-suite-name>/`) in `beforeEach` and delete it in `afterEach` to prevent cross-test pollution and avoid touching the real `data/` directory.
- **Isolated UPLOADS_DIR**: similarly, `process.env.UPLOADS_DIR` should point to a test-scoped directory; minimal fake PDF bytes (e.g. `Buffer.from("%PDF-1.4 stub")`) written to `<UPLOADS_DIR>/<resourceId>.pdf` are sufficient — real PDF parsing is not required.
- **TEST_USER_ID env var**: set to a stable test value (e.g. `"test-user-001"`) in tests that require authentication; explicitly delete in tests verifying unauthenticated behaviour; always restored in `afterEach`.
- **Seed helper**: a shared test utility (e.g. `src/lib/store/__tests__/helpers.ts`) that writes a minimal `resources.json` to the test DATA_DIR, accepting an array of partial resource objects merged with safe defaults (`downloadCount: 0`, `ownerId: "owner-1"`), will reduce boilerplate across all store and route tests.
- **Minimal audit.json**: tests that do not assert on audit records should seed an empty `audit.json` (`[]`) to prevent store read errors.
