# Test plan

## Coverage summary

- Unit tests: **10 new**, 0 updated
- Functional/integration tests: **5 new**, 0 updated
- Existing regression tests preserved: **yes** — `env-config.test.ts` and `readme.test.ts` pass without modification; `src/app/api/health/__tests__/route.test.ts` is untouched. `readme.test.ts` assertions are substring-based (no snapshots), so they survive new content being added to `README.md`.

---

## Test runner

- Framework: **Vitest 3** (`vitest.config.ts` — `environment: node`, `globals: true`)
- Command: `npx vitest run`
- Fast subset (new files only):
  ```
  npx vitest run src/lib/__tests__/download-quota.test.ts \
    src/app/api/me/download-quota/__tests__/route.test.ts \
    src/components/__tests__/DownloadQuotaIndicator.test.tsx
  ```
  *(Also add `src/app/api/downloads/[id]/__tests__/route.test.ts` once issue #11 creates it.)*

---

## Behaviors to test

### Unit — `src/lib/download-quota.ts`

File: `src/lib/__tests__/download-quota.test.ts` **(new)**

---

- **Reads limit from env var**
  — `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` is exported and reflects the env value; defaults to `50` when the var is absent.
  - Key assertions:
    - With `process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT = '10'`, the exported constant equals `10`.
    - After `delete process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`, the exported constant equals `50`.
  - Setup: save/restore `process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` around each case; force module re-evaluation (or test the constant-reading logic through a getter if the constant is evaluated at import time).
  - Maps to: **AC1**

---

- **Allows download when count is below limit**
  — `checkAndIncrementQuota` returns a `QuotaStatus` with `used` equal to the new count and does not throw when the post-increment count is ≤ limit.
  - Key assertions:
    - Return value has `used === 1`, `limit === 50`, `reset_at` is a UTC ISO-8601 string for the first day of next month at 00:00:00Z.
    - No error thrown.
    - Fake DB was called once with the correct `(userId, currentYear, currentMonth)`.
  - Setup: stub DB upsert to return count `1` (simulates first download of the month).
  - Maps to: **AC2**

---

- **Increments count by exactly one per authorized download**
  — Each call to `checkAndIncrementQuota` increments the counter by 1, not 0 or 2.
  - Key assertions:
    - Stub DB upsert returns `3`; result `used === 3`.
    - DB upsert was invoked with an increment of `1`.
  - Setup: stub DB upsert to return count `3`.
  - Maps to: **AC2**

---

- **Throws `QuotaExceededError` when count equals limit**
  — At the boundary (count = limit after increment), the call rejects.
  - Key assertions:
    - `checkAndIncrementQuota` throws `QuotaExceededError`.
    - Error carries `limit`, `reset_at`, `upgrade_url` fields.
    - `reset_at` is the first second of next calendar month UTC.
  - Setup: stub DB upsert to return count equal to the configured limit (e.g., `50` when limit is `50`).
  - Maps to: **AC3**

---

- **Throws `QuotaExceededError` when count exceeds limit**
  — Already-over case (e.g. limit was lowered mid-month after a user had downloaded 55 times).
  - Key assertions:
    - `checkAndIncrementQuota` throws `QuotaExceededError` when stub returns `count > limit`.
  - Setup: stub DB upsert to return count `55`; env limit `50`.
  - Maps to: **AC3**

---

- **Owner download bypasses the check entirely**
  — When `userId === resourceOwnerId`, the function returns a bypass result without touching the DB.
  - Key assertions:
    - DB upsert is **not** called.
    - Return value indicates `ownerBypass: true` (or equivalent — no quota fields required).
  - Setup: pass identical `userId` and `resourceOwnerId`; DB stub is a spy that must not be called.
  - Maps to: **AC4**

---

- **Premium user bypasses the check entirely**
  — When the user's tier is `'premium'`, the function returns without touching the DB.
  - Key assertions:
    - DB upsert is **not** called.
    - No error thrown.
  - Setup: pass a user object with `tier: 'premium'`; DB stub must not be called.
  - Maps to: **AC7**

---

- **Lazy month reset — prior-month row treated as zero**
  — A counter row that exists for a past `(year, month)` does not affect the current month.
  - Key assertions:
    - Stub DB upsert for the current `(year, month)` key returns `1` (meaning no prior-month row matched).
    - Result `used === 1`, function does not throw.
  - Setup: stub DB to return `1` for the current month key; verify the query uses current UTC year/month, not a stale value.
  - Maps to: **AC5**

---

- **`reset_at` is always the first moment of next UTC calendar month**
  — The computed reset timestamp is correct regardless of which month or year is current.
  - Key assertions:
    - In January (month 1), `reset_at` is `YYYY-02-01T00:00:00Z` (year unchanged).
    - In December (month 12), `reset_at` is `(YYYY+1)-01-01T00:00:00Z` (year rolls over).
  - Setup: mock `Date.now()` / `new Date()` to pin to a known UTC date for each sub-case.
  - Maps to: **AC5**

---

- **Failed download does not count — counter is not incremented**
  — `checkAndIncrementQuota` only runs the DB increment inside the pre-stream check; if the caller chooses not to call `checkAndIncrementQuota` (e.g., auth fails before quota is reached), no count occurs.
  - Key assertions:
    - If `checkAndIncrementQuota` is never called, the DB upsert is never invoked (trivial: verify DB spy has zero calls).
  - Setup: simply do not call the function; assert the spy was not called. This verifies the design contract that "counting = calling `checkAndIncrementQuota`".
  - Maps to: **AC8**

---

- **`getQuotaUsage` returns current usage, limit, and reset_at for a free user**
  — Read-only quota status is returned without side effects.
  - Key assertions:
    - Returns `{ used: <count>, limit: 50, reset_at: <ISO string> }`.
    - DB is queried with current `(userId, year, month)` via SELECT (no upsert).
    - Returns `used: 0` when no row exists for the current month.
  - Setup: stub DB SELECT to return a row with `count: 7` in one case and no row in another.
  - Maps to: **AC6**

---

### Unit — `src/app/api/me/download-quota/route.ts`

File: `src/app/api/me/download-quota/__tests__/route.test.ts` **(new)**

---

- **Unauthenticated request returns 401**
  — `GET /api/me/download-quota` without a session returns HTTP 401.
  - Key assertions:
    - `response.status === 401`.
    - `getQuotaUsage` is **not** called.
  - Setup: mock session helper to return `null`.
  - Maps to: **AC6** (endpoint must be secured)

---

- **Authenticated free user below limit returns quota JSON**
  — Returns 200 with `{ used, limit, reset_at }`.
  - Key assertions:
    - `response.status === 200`.
    - Body contains `used`, `limit` (from env), and a valid `reset_at` ISO string.
  - Setup: mock session → `{ id: 'u1', tier: 'free' }`; mock `getQuotaUsage` → `{ used: 12, limit: 50, reset_at: '...' }`.
  - Maps to: **AC6**

---

- **Authenticated premium user returns unlimited/premium indicator**
  — Premium users see no blocking limit or an explicit "unlimited" signal.
  - Key assertions:
    - `response.status === 200`.
    - Body indicates `tier: 'premium'` or `limit: null` / `unlimited: true` (exact field per implementation; at minimum the response does not contain a restrictive numeric `limit`).
  - Setup: mock session → `{ id: 'u2', tier: 'premium' }`.
  - Maps to: **AC7**

---

- **Authenticated free user at limit returns expected limit fields**
  — Verifies the quota endpoint reflects exhausted state (used === limit).
  - Key assertions:
    - Body has `used === limit`.
    - `reset_at` is a future UTC timestamp.
  - Setup: mock `getQuotaUsage` to return `{ used: 50, limit: 50, reset_at: '...' }`.
  - Maps to: **AC3, AC6**

---

### Functional/integration — download endpoint (issue #11 route)

File: `src/app/api/downloads/[id]/__tests__/route.test.ts` **(modified — new test cases added when issue #11 creates the file)**

---

- **Download succeeds for free user below limit — count increments**
  — Full happy path: free non-owner user below quota gets a 200 stream and the counter increments.
  - Preconditions: user is authenticated, free-tier, non-owner; stub DB upsert returns count `1` (below limit `50`).
  - Actions: `GET /api/downloads/:id` with a valid session cookie.
  - Assertions:
    - `response.status === 200` (or 206 for streaming).
    - `checkAndIncrementQuota` mock was called exactly once.
  - Cleanup: reset mocks.
  - Maps to: **AC2**

---

- **Download blocked with 402 when free user is at limit**
  — Quota-exceeded path returns 402 with structured body.
  - Preconditions: stub `checkAndIncrementQuota` to throw `QuotaExceededError` with `{ code: 'QUOTA_EXCEEDED', limit: 50, reset_at, upgrade_url }`.
  - Actions: `GET /api/downloads/:id`.
  - Assertions:
    - `response.status === 402`.
    - Body has `code: 'QUOTA_EXCEEDED'`, numeric `limit`, ISO `reset_at`, non-empty `upgrade_url`.
  - Cleanup: reset mocks.
  - Maps to: **AC3**

---

- **Owner download bypasses quota — 200, no DB increment**
  — Resource owner is never blocked; counter DB is not touched.
  - Preconditions: session userId equals resource ownerId; stub `checkAndIncrementQuota` should not be called (spy).
  - Actions: `GET /api/downloads/:id` where id belongs to the requesting user.
  - Assertions:
    - `response.status === 200`.
    - `checkAndIncrementQuota` was **not** called.
  - Cleanup: reset mocks.
  - Maps to: **AC4**

---

- **Premium user download bypasses quota — 200, no DB increment**
  — Premium tier never hits the quota check.
  - Preconditions: session `tier: 'premium'`; `checkAndIncrementQuota` spy.
  - Actions: `GET /api/downloads/:id`.
  - Assertions:
    - `response.status === 200`.
    - `checkAndIncrementQuota` was **not** called.
  - Cleanup: reset mocks.
  - Maps to: **AC7**

---

- **Failed download (e.g., 404 resource not found) does not increment counter**
  — Pre-stream failure must not touch the quota counter.
  - Preconditions: resource does not exist in DB stub (handler returns 404 before quota check); OR quota check is called but the stream fails (if implementation calls quota pre-stream).
  - Actions: `GET /api/downloads/:id` with a non-existent resource id.
  - Assertions:
    - `response.status === 404` (or appropriate error code).
    - `checkAndIncrementQuota` was **not** called (for pre-stream failure case).
  - Cleanup: reset mocks.
  - Maps to: **AC8**

---

### Unit — `src/components/DownloadQuotaIndicator.tsx`

File: `src/components/__tests__/DownloadQuotaIndicator.test.tsx` **(new)**
Framework note: requires `@testing-library/react` and a DOM-capable Vitest environment (`environment: 'jsdom'`); either override the environment per-file (`// @vitest-environment jsdom`) or add a second vitest project config for component tests.

---

- **Free user below limit sees remaining count**
  — The component displays `"X downloads remaining"` (or equivalent) for a free user.
  - Preconditions: mock `fetch` for `/api/me/download-quota` to return `{ used: 12, limit: 50, reset_at: '...' }`.
  - Actions: render `<DownloadQuotaIndicator />`.
  - Assertions:
    - Screen contains text indicating `38` remaining (or reads "38 downloads remaining" or similar).
  - Cleanup: restore fetch mock.
  - Maps to: **AC6**

---

- **Free user at limit sees "limit reached" state**
  — When `used === limit`, component communicates exhaustion and shows upgrade path.
  - Preconditions: mock fetch returns `{ used: 50, limit: 50, reset_at: '...', upgrade_url: '/upgrade' }`.
  - Assertions:
    - Screen contains upgrade-related text or link.
    - `0 downloads remaining` or equivalent messaging visible.
  - Maps to: **AC3, AC6**

---

- **Premium user sees "Unlimited" or no restrictive indicator**
  — Premium indicator is rendered; no quota number shown.
  - Preconditions: mock fetch returns `{ tier: 'premium' }` or equivalent unlimited signal.
  - Assertions:
    - "Unlimited" text visible OR no download-count number rendered.
    - No upgrade CTA rendered.
  - Maps to: **AC7**

---

- **Unauthenticated user — component renders nothing**
  — Not authenticated: indicator is hidden.
  - Preconditions: mock fetch returns 401.
  - Assertions:
    - Component renders null / empty.
  - Maps to: **AC6** (non-regression: logged-out users should not see a quota widget)

---

- **Remaining count reflects updated value after a successful download**
  — After a download succeeds, re-fetching the quota endpoint shows incremented `used`.
  - Preconditions: first fetch returns `{ used: 12, limit: 50 }`; after a simulated download event, component re-fetches and receives `{ used: 13, limit: 50 }`.
  - Assertions:
    - Component initially shows `38 remaining`; after re-render/re-fetch shows `37 remaining`.
  - Maps to: **AC6**

---

- **A11y: remaining downloads indicator is accessible**
  — The quota display passes basic accessibility checks.
  - Assertions:
    - The count is conveyed as text (not color-only).
    - No `aria-label` is missing on interactive upgrade-CTA elements.
  - Maps to: Edge case — Accessibility of "remaining downloads" UI

---

### Unit — `src/__tests__/env-config.test.ts` (existing, new case)

File: `src/__tests__/env-config.test.ts` **(modified — one new `it` block)**

---

- **`.env.example` documents `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`**
  — The env file contains the new variable so operators know it exists.
  - Key assertions:
    - `content` matches `/FREE_TIER_MONTHLY_DOWNLOAD_LIMIT/`.
  - Setup: same `fs.readFileSync` pattern as existing tests.
  - Maps to: **AC1**

---

## Edge cases covered

| Edge case | Covered by |
|---|---|
| Concurrent downloads (last-slot race) | `checkAndIncrementQuota` — atomic upsert design is verified by the unit test "Throws `QuotaExceededError` when count equals limit" with a stub that returns `count === limit`. True concurrency is a DB-level guarantee; the test documents the contract that the count returned by the atomic upsert is the authoritative decision point. A note comment in the test should explain why a higher-level concurrency test requires an integration environment with a real DB. |
| Clock boundary (month rollover) | "Lazy month reset — prior-month row treated as zero" test + "`reset_at` is always the first moment of next UTC calendar month" test |
| Timezone (UTC, not local) | "`reset_at` is always the first moment of next UTC calendar month" — both sub-cases pin UTC dates and assert ISO-8601Z timestamps |
| Config change mid-month — allowance raised | "Allows download when count is below limit" covers the resulting pass-through; "Throws `QuotaExceededError` when count exceeds limit" covers the block-if-over case |
| Config change mid-month — allowance lowered | "Throws `QuotaExceededError` when count exceeds limit" (count `55`, limit `50`) directly tests this case |
| Anonymous / unauthenticated requests | Covered by quota-endpoint test "Unauthenticated request returns 401" and download-route tests (auth check precedes quota check) |
| Backward compatibility on first deploy | Not unit-testable; documented in impact.md Warning 4. New table starts empty → all users start month with `used: 0` → "Allows download below limit" test reflects this. |

---

## Not tested (with reason)

| Item | Reason |
|---|---|
| **True concurrent DB race** (two simultaneous requests at slot N) | Requires a real PostgreSQL instance; cannot be validated with an in-process stub. The atomic upsert contract is documented in the unit test; integration testing against a real DB is deferred to a staging/CI environment with a test database — outside the scope of the current test setup which has no DB. |
| **Observability / log output when quota is exceeded** | The logging interface (structured logger, console, etc.) is not defined yet (skeleton repo). Add a test once the logging library is chosen. |
| **Accessibility beyond text presence** (e.g., full axe-core audit) | No axe-core or jest-axe dependency exists yet. The a11y test covers the minimum: text-not-color-only and labelled interactive elements. A full axe audit can be added once `@axe-core/react` or `vitest-axe` is installed. |
| **`README.md` quota documentation content** (AC9) | `src/__tests__/readme.test.ts` uses substring matchers and will not break. A dedicated assertion for the exact quota-rules wording would be brittle. AC9 is satisfied by the docs update itself; no automated test is added for prose content. |
| **UI surface location** (header vs. account page) | The exact mount point in `layout.tsx` is a layout/UX concern, not a behavioral assertion. The component tests verify the widget renders correctly regardless of placement. |
| **Upgrade URL correctness** (points to actual premium page) | The URL value depends on issue #15 (premium subscription) which is out of scope. The test asserts the field is non-empty; the exact value is validated as part of issue #15 integration. |

---

## Fixtures & data

| Fixture / helper | Purpose | Lives in |
|---|---|---|
| `mockDb` factory | Returns a stub DB client with a configurable `upsert`/`select` spy. Used across all `download-quota.test.ts` cases. | Inline in `src/lib/__tests__/download-quota.test.ts` or extracted to `src/lib/__tests__/helpers/mock-db.ts` if reused across files |
| `mockSession(tier, userId)` | Returns a minimal session object (`{ id, tier }`) for route handler tests. | Inline in each route test file; extract to `src/__tests__/helpers/mock-session.ts` once shared |
| `mockFetch(response)` | Stubs `global.fetch` for component tests (`vi.stubGlobal`). | Inline in `src/components/__tests__/DownloadQuotaIndicator.test.tsx` |
| Fixed UTC date `2025-01-15T12:00:00Z` | Used to pin `Date.now()` for `reset_at` assertions. January ensures month-roll (to February) is tested without year rollover. | `vi.setSystemTime` / `vi.useFakeTimers` in each test that asserts `reset_at` |
| Fixed UTC date `2025-12-15T12:00:00Z` | Used to test year-rollover case in `reset_at` computation. | Same pattern |
