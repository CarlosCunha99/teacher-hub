# Impact analysis

> **Repo state note:** The repository is a Next.js skeleton only. The files listed
> under "Direct changes" are **all new** unless explicitly marked *(modify)*. No
> existing production code outside `.env.example` and `README.md` is touched by
> this ticket.

---

## Direct changes

### New files (to be created)

| File | Role |
|------|------|
| `src/lib/download-quota.ts` | Core quota logic: `checkAndIncrementQuota`, `getQuotaUsage`, `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` constant, `QuotaExceededError`, shared types (`QuotaStatus`, `QuotaExceededBody`) |
| `src/lib/db/migrations/<timestamp>_create_monthly_download_counts.sql` | DDL for the `monthly_download_counts (user_id, year, month, count)` table; unique index on `(user_id, year, month)`; the atomic upsert statement lives here or in a migration helper |
| `src/app/api/me/download-quota/route.ts` | `GET /api/me/download-quota` — reads current usage, limit, next-reset timestamp; returns `QuotaStatus` JSON |
| `src/app/api/me/download-quota/__tests__/route.test.ts` | Unit/integration tests for quota endpoint (authenticated vs. unauthenticated, free vs. premium, normal vs. limit-reached) |
| `src/components/DownloadQuotaIndicator.tsx` | Client component: fetches `/api/me/download-quota`, renders remaining count or "Unlimited" for premium; hides for unauthenticated users |
| `src/components/__tests__/DownloadQuotaIndicator.test.tsx` | Component tests: free user, premium user, limit-reached state, a11y |
| `src/lib/__tests__/download-quota.test.ts` | Unit tests for `checkAndIncrementQuota` and `getQuotaUsage`: below-limit, at-limit, concurrent increment, owner bypass, premium bypass, calendar-month boundary |

### Modified files

| File | What changes |
|------|--------------|
| `src/app/api/downloads/[id]/route.ts` *(owned by issue #11 — not yet created; modified here)* | Add owner-exemption check; add `checkAndIncrementQuota` call before stream begins; return 402 with `QuotaExceededBody` when limit exceeded |
| `.env.example` *(modify)* | Add `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT=50` with a comment explaining the default |
| `README.md` *(modify)* | Add `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` to the environment-variables table; document the calendar-month UTC reset behaviour and owner-exemption rule (satisfies AC9) |
| `src/app/layout.tsx` *(modify)* | Mount `<DownloadQuotaIndicator />` in the root shell so it appears in the header/account area on every page |

---

## Indirect: callers & consumers

| Caller / consumer | Calls / consumes | Impact |
|---|---|---|
| `src/app/api/downloads/[id]/route.ts` (issue #11) | `checkAndIncrementQuota` from `@/lib/download-quota` | **behavior-change** — download handler now rejects with 402 for quota-exceeded free users; any existing tests for the download route will need a quota mock |
| Auth session middleware / `getSession()` (issue #2) | Called by quota endpoint and download handler to resolve `user_id` and `tier` | **compile-break if session shape changes** — quota code depends on `user.id` and `user.tier` (or equivalent premium flag from issue #15) |
| Premium entitlement helper (issue #15) | `isPremium(user)` or equivalent read by `checkAndIncrementQuota` to short-circuit the check | **behavior-change** — premium users must not hit the DB counter at all |
| `src/app/layout.tsx` | Renders `<DownloadQuotaIndicator />` | **behavior-change** — adds a network fetch (`/api/me/download-quota`) on every page load for authenticated users |
| `src/__tests__/env-config.test.ts` | Validates `.env.example` has ≥ 1 variable | **none** — the test already passes; adding `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` keeps it passing |

---

## Public API surface

| Exported symbol | Module | Change type |
|---|---|---|
| `checkAndIncrementQuota(userId, resourceOwnerId, db)` | `@/lib/download-quota` | **new export** |
| `getQuotaUsage(userId, db)` | `@/lib/download-quota` | **new export** |
| `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` | `@/lib/download-quota` | **new export** (env-read constant, default 50) |
| `QuotaStatus` | `@/lib/download-quota` | **new exported type** |
| `QuotaExceededBody` | `@/lib/download-quota` | **new exported type** |
| `QuotaExceededError` | `@/lib/download-quota` | **new exported error class** |
| `GET /api/me/download-quota` | HTTP | **new route** |
| `POST/GET /api/downloads/[id]` (issue #11) | HTTP | **shape change** — can now return `HTTP 402` with `{ code: "QUOTA_EXCEEDED", limit, reset_at, upgrade_url }` |

### Breaking

- `GET /api/downloads/[id]` (issue #11): previously could only return 200/401/403/404; it now also returns **402** with a new JSON body shape. Any API client or test that asserts `status !== 402` will break.

---

## Tests affected

| Test file | Why affected |
|---|---|
| `src/app/api/health/__tests__/route.test.ts` | **none** — unrelated to quota; no change expected |
| `src/__tests__/env-config.test.ts` | **none** — `.env.example` gains a new variable, all existing assertions still pass |
| `src/__tests__/readme.test.ts` | **possible** — if the test asserts specific README sections, the new env-var table row and quota documentation may trigger a diff; needs review |
| `src/app/api/downloads/[id]/__tests__/route.test.ts` *(issue #11, not yet created)* | **behavior-change** — must add test cases for: quota-exceeded 402, owner bypass, premium bypass, concurrent increment; requires a `checkAndIncrementQuota` mock |
| `src/lib/__tests__/download-quota.test.ts` *(new)* | New file; covers all quota-lib unit cases |
| `src/app/api/me/download-quota/__tests__/route.test.ts` *(new)* | New file; covers quota endpoint |
| `src/components/__tests__/DownloadQuotaIndicator.test.tsx` *(new)* | New file; component tests |

---

## Docs to update

| Path | Section / reason |
|---|---|
| `README.md` | **Environment configuration** table — add `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`; **Features** section (once created) — describe quota enforcement, owner exemption, calendar-month UTC reset (satisfies AC9) |
| `.env.example` | Add `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT=50` with an inline comment |
| (future) `docs/rules/download-quota.md` or equivalent | AC9 requires the owner-exemption rule and "month" definition to be documented somewhere the support team can link to; if a `docs/` folder does not exist it must be created |

---

## Migrations / config / infra

| Asset | What changes |
|---|---|
| `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` env var | **New.** Must be added to `.env.example` (default `50`), `.env.local` for local dev, and all deployment environment configs (staging, production). Changing the value and restarting applies it immediately. |
| DB migration — `monthly_download_counts` table | **New table.** Schema: `user_id` (FK → users), `year SMALLINT`, `month SMALLINT`, `count INTEGER NOT NULL DEFAULT 0`, unique constraint on `(user_id, year, month)`. Requires an atomic upsert (`INSERT … ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`). |
| `DATABASE_URL` env var | Already documented in `.env.example` (arrives with issue #3). The quota feature consumes the same DB connection; no new connection string needed — but the variable must be present at runtime. |

---

## External systems

| System | What changes |
|---|---|
| **PostgreSQL** | New table `monthly_download_counts` (see migration above). No existing tables are altered. Query pattern: one upsert per download attempt for free users; one SELECT per page load (quota endpoint). |
| **HTTP clients / frontend** | Download endpoint gains a new `402` response code with a structured JSON body (`code`, `limit`, `reset_at`, `upgrade_url`). Clients that do not handle 402 will see an unhandled error state. |
| **Deployment platform (env)** | `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` must be injected into the runtime environment. |

---

## Blast-radius comparison: rejected alternatives

The brainstorm explicitly considered and rejected these alternatives. Had they been chosen, the impact surface would differ as described:

| Design axis | Chosen approach | Rejected alternative | Blast-radius delta if rejected had been chosen |
|---|---|---|---|
| **Reset mechanism** | Lazy-reset keyed by `(user_id, year, month)` | Scheduled reset job (cron) that zeroes counts at month rollover | +1 infra component (cron job / scheduled Lambda / pg_cron); +1 deployment config; +1 operational runbook; failure of the cron silently leaves users blocked past month end |
| **Window type** | Calendar month UTC | Per-user 30-day rolling window keyed to signup/subscription date | Counter table needs a `window_start TIMESTAMPTZ` column instead of `year/month`; query becomes a range scan instead of a point lookup; reset logic tied to user-creation event from issue #2; far more complex fixture set in tests |
| **Limit-exceeded response** | 402 with structured JSON (`code`, `limit`, `reset_at`, `upgrade_url`) | Hard block with generic 403 / error page | No new response type to document; but the frontend loses the upgrade CTA data and issue #15 integration is broken; fewer fields in the response body means fewer tests but worse product outcome |

---

## Estimated diff size

| Metric | Estimate |
|---|---|
| Files touched (new + modified) | **~12** |
| Rough lines changed | **~450–600** |
| Confidence | **medium** |

**Breakdown:**

| Asset | Est. lines | Notes |
|---|---|---|
| `src/lib/download-quota.ts` | ~80 | Core logic + types |
| `src/app/api/me/download-quota/route.ts` | ~40 | Thin route handler |
| `src/components/DownloadQuotaIndicator.tsx` | ~60 | Client component + fetch |
| `src/app/api/downloads/[id]/route.ts` (issue #11 modifications) | ~30 | Check + increment hook |
| DB migration SQL | ~15 | DDL + upsert statement |
| `.env.example` (modify) | ~3 | One variable + comment |
| `README.md` (modify) | ~15 | Env-var row + quota rules doc |
| `src/lib/__tests__/download-quota.test.ts` *(new)* | ~120 | 8–10 test cases |
| `src/app/api/me/download-quota/__tests__/route.test.ts` *(new)* | ~80 | Auth, tier, limit edge cases |
| `src/components/__tests__/DownloadQuotaIndicator.test.tsx` *(new)* | ~70 | Component + a11y |
| `src/app/api/downloads/[id]/__tests__/route.test.ts` modifications | ~40 | New quota-mock cases |
| `src/app/layout.tsx` (modify) | ~5 | Mount indicator |

**Downstream churn:** ~310 lines (~55 % of total) are test/fixture files. This is expected because every branch of the quota state machine (below-limit, at-limit, owner-bypass, premium-bypass, concurrent request, calendar-month boundary) requires an explicit test case, and the download-route test suite must be extended with quota mocks. No external fixture files or feature files exist today; all test churn is in the new `*.test.ts/tsx` files enumerated above.

---

## Warnings

1. **All prerequisites are absent from the repo.** Auth (`user_id`, `tier`), PostgreSQL client, the download endpoint (issue #11), and the premium-tier flag (issue #15) do not exist yet. This ticket cannot be implemented until all four land. Any attempt to merge quota code before those foundations will produce compile errors.

2. **`src/app/api/downloads/[id]/route.ts` is owned by issue #11, not this ticket.** The quota check must be inserted into that handler. The two issues must coordinate on the exact function signature of `checkAndIncrementQuota` to avoid merge conflicts or divergent assumptions about session shape.

3. **The 402 response is a new HTTP status code in this API.** Any API gateway, load balancer, or CDN rule that treats 4xx generically (e.g., caching or blocking) must be audited before rollout.

4. **Rollout / data cutover.** Existing users have had unlimited downloads. On first deploy, `monthly_download_counts` will be empty, so all users start with a full allowance in the cutover month — which is intentional per the ticket — but operators should be aware that there is no backfill of prior usage.

5. **`FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` mid-month change.** Lowering the limit mid-month blocks users already above the new threshold for the rest of the month (no retroactive row update). This edge case should be documented for operators and surfaced in a log warning if the env value is changed with users' counts already near it.

6. **`src/__tests__/readme.test.ts`** — this test file exists and may assert README content. Adding the quota env var and documentation to `README.md` could break assertions in that test if they are brittle (e.g., snapshot-based). Needs inspection when the README is updated.

7. **No `src/components/` directory exists yet.** `DownloadQuotaIndicator.tsx` will be the first file in that directory; ensure the tsconfig path alias and any barrel exports are set up consistently with the existing `@/lib/*` pattern.
