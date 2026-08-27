# Implementation plan

## Goal
Free-tier download enforcement exists end-to-end: monthly quota checks happen before non-owner downloads stream, free users can query their current usage, and the app shows their remaining allowance.

## Approach
Implement the quota as a small shared backend module in `src/lib/` so both the download route and the new self-service quota endpoint use the same rules, limits, month calculation, and response shapes. Keep the reset lazy by always targeting the current UTC `(year, month)` bucket rather than mutating old rows.

Use PostgreSQL for the authoritative check with a single atomic insert-or-increment before streaming begins. The enforcement point stays in `src/app/api/downloads/[id]/route.ts`, but the route should delegate the decision to the shared quota helper so premium bypass, owner exemption, and `402` payload generation remain centralized.

Expose current usage through `GET /api/me/download-quota`, then consume that endpoint from a lightweight UI component mounted in the root shell. Finish by documenting the new env var plus the month/owner rules so operators and support have a stable reference.

## Steps
1. **Define quota contract and config** — Create `src/lib/download-quota.ts` with the env-backed limit reader (`FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`, default `50`), UTC month/reset helpers, shared response types, and a dedicated quota-exceeded error/return contract that route handlers can translate into HTTP responses. Depends on: none.
2. **Add quota persistence and atomic enforcement** — Create the PostgreSQL migration for `monthly_download_counts` and finish `src/lib/download-quota.ts` with DB-backed `checkAndIncrementQuota` and `getQuotaUsage` helpers using `@/lib/db`. The increment path must use one atomic upsert for the current month bucket; premium users and resource owners must short-circuit without touching the counter. Depends on: step 1.
3. **Wire enforcement into downloads** — Modify `src/app/api/downloads/[id]/route.ts` to call `getSession()`, resolve the resource owner, run the quota check before any file stream starts, and return `402` with `{ code, limit, reset_at, upgrade_url }` when the helper reports quota exhaustion. Keep existing auth/not-found/file-serving behavior intact. Depends on: step 2.
4. **Expose current quota to the frontend** — Create `src/app/api/me/download-quota/route.ts` to return `{ used, limit, reset_at }` for the current user, using the same session assumptions and shared helper logic. Premium users should still receive a non-blocking response that lets the UI render an unlimited state without special client-side inference. Depends on: step 2.
5. **Add the quota indicator UI** — Create `src/components/DownloadQuotaIndicator.tsx` and mount it from `src/app/layout.tsx`. The component should fetch `/api/me/download-quota`, show remaining downloads for free users, show an unlimited/premium label for premium users, hide or no-op for anonymous users, and use text that makes the UTC monthly reset understandable. Depends on: step 4.
6. **Document config and rules** — Modify `.env.example` to add `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`, and update `README.md` with the variable, the UTC calendar-month reset behavior, and the owner exemption rule. Depends on: step 5.

## Files
### Create
- `src/lib/download-quota.ts` — Shared quota config, month helpers, DB-backed quota operations, and reusable response/error types.
- `src/lib/db/migrations/<timestamp>_create_monthly_download_counts.sql` — Forward-looking migration file for the lazy-reset counter table and uniqueness constraint.
- `src/app/api/me/download-quota/route.ts` — Authenticated endpoint returning current-month usage metadata for the requester.
- `src/components/DownloadQuotaIndicator.tsx` — UI surface for remaining downloads / unlimited premium state.

### Modify
- `src/app/api/downloads/[id]/route.ts` — Insert pre-stream quota enforcement, owner exemption, premium bypass, and `402` response handling.
- `src/app/layout.tsx` — Mount the quota indicator in the global shell.
- `.env.example` — Document the configurable free-tier monthly limit and default.
- `README.md` — Document operator config plus user-facing quota rules.

### Delete
- None.

## Data / schema / migration
Add `monthly_download_counts(user_id, year, month, count)` in PostgreSQL with a unique key on `(user_id, year, month)`. No backfill is needed: rollout starts a fresh count at first post-deploy download in the current UTC month. Backward compatibility is preserved because users without a row are treated as `0` used.

## Rollout
- Feature flag? no.
- Backfill? no — counts begin at cutover.
- Ordering: ship after auth, premium tier, DB client, and the download route prerequisites exist; apply the migration before deploying enforcement; deploy the UI after or with the new quota endpoint.

## Assumptions and non-decisions
- Assume `getSession()` returns `{ user: { id, tier } }` or equivalent data accessible to these routes.
- Assume `src/app/api/downloads/[id]/route.ts` can determine the resource owner before streaming.
- Assume the upgrade destination is available as a constant/config value by the time premium work lands; this plan does not prescribe where that URL is stored.
- If issue #3 establishes a different migration directory, keep the same table design and place the migration there.
- Exact visual placement/styling of the indicator is left to the coder, as long as it is mounted from the app shell and remains visible in normal browsing.

## Not doing
- No per-user custom limits, rollover credits, or admin reset tooling.
- No retroactive counting of downloads made before enforcement ships.
- No changes to billing, checkout, or entitlement sourcing beyond consuming the future `tier` signal.
