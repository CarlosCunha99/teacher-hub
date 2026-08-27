Closes #16

## Summary

Implements the monthly free-tier download quota for Teacher Hub. Free users are capped at a configurable monthly allowance (default: 50); attempts beyond the cap return HTTP 402 with an upgrade CTA. A `DownloadQuotaIndicator` component in the app header gives users real-time visibility into their remaining downloads. All enforcement is server-side; the counter uses a single atomic upsert to prevent race conditions.

## Changed files

**New — core logic**
- `src/lib/download-quota.ts` — quota library (`checkAndIncrementQuota`, owner/premium bypass, `reset_at` calculation)
- `src/lib/db/migrations/001_create_monthly_download_counts.sql` — migration for the `monthly_download_counts` table
- `src/lib/db/index.ts` — DB client stub (replaced when #3 lands)
- `src/lib/auth.ts` — auth stub (`getSession`) (replaced when #2 lands)

**New — API routes**
- `src/app/api/downloads/[id]/route.ts` — download route with quota enforcement and owner/premium bypass
- `src/app/api/me/download-quota/route.ts` — quota status endpoint for the UI indicator

**New — UI**
- `src/components/DownloadQuotaIndicator.tsx` — header component showing remaining downloads and upgrade link

**New — tests** (59 tests total)
- `src/lib/__tests__/download-quota.test.ts` (18 tests)
- `src/app/api/me/download-quota/__tests__/route.test.ts` (5 tests)
- `src/app/api/downloads/[id]/__tests__/route.test.ts` (6 tests)
- `src/components/__tests__/DownloadQuotaIndicator.test.tsx` (12 tests)

**Modified**
- `src/app/layout.tsx` — mounts `DownloadQuotaIndicator`
- `.env.example` — adds `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`
- `README.md` — documents env var, monthly reset behaviour, owner-exemption rule (AC9)
- `package.json` — adds `@testing-library/{dom,jest-dom,react}` and `jsdom` as devDeps

## Acceptance criteria covered

- **AC1** — Allowance read from `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` env var; default 50; no hard-coded call sites.
- **AC2** — Downloads below the limit succeed and the counter increments atomically.
- **AC3** — Requests at/above the limit are blocked with HTTP 402 (`code: "QUOTA_EXCEEDED"`, `upgrade_url`, `reset_at`).
- **AC4** — Owner bypass short-circuits before the quota check; owner downloads do not count against the allowance.
- **AC5** — `reset_at` is the first second of the next UTC calendar month; the table's `(user_id, year_month)` key provides automatic per-month isolation — no cron job required.
- **AC6** — `DownloadQuotaIndicator` polls `/api/me/download-quota` and renders remaining count; updates after each page navigation.
- **AC7** — Premium users (identified via `getSession`) short-circuit the quota check; indicator shows "Unlimited" for premium accounts.
- **AC8** — Counter is only incremented after the upstream file fetch succeeds (HTTP 200). A 502 from file storage returns an error to the client without counting against the user's quota.
- **AC9** — Owner-exemption rule and "calendar month UTC" definition documented in `README.md`.

## Prerequisites / stubs

This PR depends on three not-yet-merged issues. Stubs are in place so everything compiles and tests pass today; they will be replaced when the real implementations land:

| Stub file | Replaced by |
|---|---|
| `src/lib/auth.ts` (`getSession`) | Issue #2 — Auth |
| `src/lib/db/index.ts` (DB client) | Issue #3 — PostgreSQL schema |
| *(premium field on session)* | Issue #15 — Premium membership |

> ⚠️ `src/lib/auth.ts` currently returns `null` unconditionally — routes return 401 on all real requests until issue #2 lands. Tests mock `getSession` so the suite is green.

## Known issues (flagged by code review, subsequently fixed)

All high/medium findings from the agent code review (claude-opus-4.7) were addressed before opening this PR:

- **H1 (AC8):** Moved upstream fetch before quota increment — a 502 from file storage no longer consumes quota.
- **M1:** `getSession` stub now returns `null` instead of throwing, so routes degrade to 401 (not 500) before issue #2 lands.
- **M2:** Fixed off-by-one in quota boundary check (`>` instead of `>=`) so users get exactly `LIMIT` (default: 50) downloads per month, matching ticket AC2.
- **L1:** `upgrade_url` now served from the quota API response so the client component and server env var always agree.
- **L2:** `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` commented out in `.env.example` (consistent with other placeholder vars).

## Test results

**59/59 tests pass. Lint, format, and build are green.**
