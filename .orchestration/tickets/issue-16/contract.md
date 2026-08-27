# Contract for issue-16

Written by: contract-writer agent
Locked at: 2026-08-27T22:13:30Z
Consumed by: coder, tester, spec-reviewer, diagnoser

---

## Interfaces

### download-quota.checkAndIncrementQuota
- **Path:** `src/lib/download-quota.ts`
- **Signature:**
  ```typescript
  function checkAndIncrementQuota(
    userId: string,
    tier: 'free' | 'premium',
    resourceOwnerId: string,
    db: DbClient,
  ): Promise<QuotaCheckResult>
  ```
- **Semantics:**
  - Pre-conditions:
    - `userId` is a non-empty string (the authenticated user's ID).
    - `tier` is `'free'` or `'premium'`.
    - `resourceOwnerId` is the ID of the user who owns the resource being downloaded.
    - `db` is a valid `DbClient` instance.
  - Post-conditions:
    - If `userId === resourceOwnerId`, returns `{ ownerBypass: true }` without touching the DB.
    - If `tier === 'premium'`, returns `{ premiumBypass: true }` without touching the DB.
    - Otherwise performs an atomic upsert on `monthly_download_counts` for the current UTC `(userId, year, month)` bucket, incrementing `count` by 1 and returning the resulting count.
    - If the resulting `count <= FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`, returns `{ used: count, limit: FREE_TIER_MONTHLY_DOWNLOAD_LIMIT, reset_at }`.
    - If the resulting `count >= FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`, throws `QuotaExceededError` (after the increment — the count is still recorded).
  - Invariants:
    - The DB upsert is atomic: a single `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count` statement.
    - Owner-bypass and premium-bypass short-circuit before any DB call.
    - `reset_at` is always the first moment (00:00:00Z) of the next UTC calendar month.
- **Errors:**
  - Throws `QuotaExceededError` when `count >= FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` after increment.
- **Side effects:**
  - Writes to the `monthly_download_counts` table for non-bypass free-tier calls.
- **Not in contract:**
  - The exact SQL dialect / driver binding (handled by `DbClient`).
  - Whether `QuotaExceededError` is caught vs. re-thrown by callers — callers own that decision.

---

### download-quota.getQuotaUsage
- **Path:** `src/lib/download-quota.ts`
- **Signature:**
  ```typescript
  function getQuotaUsage(
    userId: string,
    db: DbClient,
  ): Promise<{ used: number; limit: number; reset_at: string }>
  ```
- **Semantics:**
  - Pre-conditions: `userId` is a non-empty string; `db` is a valid `DbClient`.
  - Post-conditions:
    - Queries `monthly_download_counts` for `(userId, currentYear, currentMonth)` via a SELECT.
    - Returns `{ used: row.count, limit: FREE_TIER_MONTHLY_DOWNLOAD_LIMIT, reset_at }`.
    - If no row exists for the current month, returns `{ used: 0, limit: FREE_TIER_MONTHLY_DOWNLOAD_LIMIT, reset_at }`.
    - `reset_at` is always the first moment (00:00:00Z) of the next UTC calendar month, formatted as ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`).
  - Invariants:
    - Read-only; does not insert or update any rows.
- **Errors:**
  - Propagates DB errors from `db.query` without wrapping.
- **Side effects:** None.
- **Not in contract:**
  - Does not apply tier logic; the caller decides how to present the result for premium users.

---

### GET /api/me/download-quota
- **Path:** `src/app/api/me/download-quota/route.ts`
- **Signature:**
  ```typescript
  export async function GET(request: Request): Promise<Response>
  ```
- **Semantics:**
  - Pre-conditions: `request` is a Next.js App Router `Request`.
  - Post-conditions:
    - If `getSession(request)` returns `null`, responds `401 Unauthorized` with empty body.
    - If session user `tier === 'premium'`, responds `200 OK` with `QuotaStatus` body where `tier: 'premium'` and `unlimited: true`.
    - If session user `tier === 'free'`, calls `getQuotaUsage(user.id, db)` and responds `200 OK` with `QuotaStatus` body (`tier: 'free'`, `used`, `limit`, `reset_at`).
  - Invariants:
    - `getQuotaUsage` is **not** called for unauthenticated requests.
    - `getQuotaUsage` is **not** called for premium users.
- **Errors:**
  - `401` when unauthenticated.
- **Side effects:** None (read-only).
- **Not in contract:**
  - Whether a `Cache-Control` header is set.

---

### GET /api/downloads/[id]  (modified, owned by issue #11)
- **Path:** `src/app/api/downloads/[id]/route.ts`
- **Signature:**
  ```typescript
  export async function GET(
    request: Request,
    { params }: { params: { id: string } },
  ): Promise<Response>
  ```
- **Semantics:**
  - Pre-conditions: `params.id` identifies a downloadable resource.
  - Post-conditions (quota-enforcement branch only — pre-existing auth/404/stream behaviour is unchanged):
    - If `getSession(request)` returns `null`, responds `401`.
    - If resource does not exist, responds `404` without calling `checkAndIncrementQuota`.
    - Resolves `resourceOwnerId` from the resource record before calling quota.
    - Calls `checkAndIncrementQuota(userId, tier, resourceOwnerId, db)` before any file stream begins.
    - If the call returns any `QuotaCheckResult`, proceeds to stream the file.
    - If the call throws `QuotaExceededError`, responds `402` with `QuotaExceededBody`.
  - Invariants:
    - `checkAndIncrementQuota` is called **after** auth and resource-existence checks, and **before** the file stream starts.
    - `checkAndIncrementQuota` is never called when the request fails for auth or 404 reasons.
- **Errors:**
  - `401` — not authenticated.
  - `402` — quota exceeded (`QuotaExceededBody`).
  - `404` — resource not found.
  - `200` (or `206`) — success, file stream follows.
- **Side effects:**
  - Writes to `monthly_download_counts` on each successful free non-owner call (via `checkAndIncrementQuota`).
- **Not in contract:**
  - Streaming implementation details (chunking, range headers).

---

### DownloadQuotaIndicator (React component)
- **Path:** `src/components/DownloadQuotaIndicator.tsx`
- **Signature:**
  ```typescript
  export default function DownloadQuotaIndicator(): JSX.Element | null
  ```
- **Semantics:**
  - Pre-conditions: Mounted inside a React tree with access to `fetch`.
  - Post-conditions:
    - Fetches `GET /api/me/download-quota` on mount.
    - If fetch returns `401` or any error, renders `null`.
    - If response body has `tier: 'premium'` / `unlimited: true`, renders an "Unlimited" / premium label. No upgrade CTA.
    - If response body has `tier: 'free'`, renders remaining downloads (`limit - used`) as a text count (not color-only). When `used === limit`, renders an upgrade CTA (non-empty `href`).
  - Invariants:
    - The remaining-count text contains the numeric value (e.g., `"38 downloads remaining"`).
    - All interactive upgrade-CTA elements have an accessible label.
- **Errors:** Renders `null` on 401 or fetch failure.
- **Side effects:** Issues one GET request on mount.
- **Not in contract:**
  - Visual styling, exact CSS class names, re-fetch strategy beyond initial mount.
  - The value of the upgrade URL (depends on issue #15).

---

## Data shapes

### QuotaStatus
```typescript
type QuotaStatus =
  | { tier: 'free'; used: number; limit: number; reset_at: string }
  | { tier: 'premium'; unlimited: true }
```
- `tier` — discriminant identifying the user's entitlement tier.
- `used` — number of downloads consumed in the current UTC calendar month (free variant only).
- `limit` — configured monthly ceiling; equals `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` (free variant only).
- `reset_at` — ISO 8601 UTC timestamp of the first moment of the next calendar month, e.g. `"2025-02-01T00:00:00Z"` (free variant only).
- `unlimited` — always `true` for the premium variant; signals no numeric cap applies.

---

### QuotaExceededBody
```typescript
type QuotaExceededBody = {
  code: 'QUOTA_EXCEEDED';
  limit: number;
  reset_at: string;
  upgrade_url: string;
}
```
- `code` — machine-readable discriminant, always the literal `'QUOTA_EXCEEDED'`.
- `limit` — the numeric cap that was reached; equals `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`.
- `reset_at` — ISO 8601 UTC timestamp of the first moment of next month.
- `upgrade_url` — non-empty URL string pointing to the premium upgrade page (exact value is TBD, supplied by issue #15 or a constant; must be non-empty at runtime).

---

### QuotaCheckResult
```typescript
type QuotaCheckResult =
  | { ownerBypass: true }
  | { premiumBypass: true }
  | { used: number; limit: number; reset_at: string }
```
- `ownerBypass: true` — returned when `userId === resourceOwnerId`; no quota fields present.
- `premiumBypass: true` — returned when `tier === 'premium'`; no quota fields present.
- `{ used, limit, reset_at }` — returned for free non-owner downloads below the limit.
- Note: when the limit is reached or exceeded, `checkAndIncrementQuota` throws `QuotaExceededError` instead of returning this shape.

---

### QuotaExceededError
```typescript
class QuotaExceededError extends Error {
  readonly code: 'QUOTA_EXCEEDED';
  readonly limit: number;
  readonly reset_at: string;
  readonly upgrade_url: string;

  constructor(limit: number, reset_at: string, upgrade_url: string);
}
```
- Thrown by `checkAndIncrementQuota` when `count >= FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`.
- `message` may be any human-readable string; callers should not parse it.
- Callers that catch this error should use `err.code === 'QUOTA_EXCEEDED'` as the discriminant.

---

### DbClient
```typescript
interface DbClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
```
- Imported from `@/lib/db` (provided by a prerequisite issue).
- `rows` is the result set; may be empty.

---

## Constants / config keys

- `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` = `50` — exported `number` constant from `src/lib/download-quota.ts`. Read from `process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` at module load time; falls back to `50` when the variable is absent or empty. Unit: downloads per calendar month per user.

---

## Resolved ambiguities

| Source | Ambiguity | Resolution |
|---|---|---|
| plan.md vs. test-plan.md | `checkAndIncrementQuota` signature in plan.md is `(userId, resourceOwnerId, db)` — no `tier` parameter. The test-plan requires premium-bypass logic inside the function ("pass a user object with `tier: 'premium'`"). | **Resolved:** Signature becomes `(userId, tier, resourceOwnerId, db)`. Adding `tier` as the second parameter satisfies the premium-bypass test while keeping the function self-contained. The plan's list was illustrative; the test-plan's fixture is the authoritative specification. |
| test-plan.md | Premium bypass test says "pass a user object with `tier: 'premium'`" — ambiguous whether the first param is a user object or separate fields. | **Resolved:** Two separate params (`userId: string, tier: 'free' \| 'premium'`) rather than a user object. This matches how `getSession` data is destructured in route handlers and avoids coupling the lib function to the session shape. |
| plan.md vs. test-plan.md | `getQuotaUsage` return type is called `QuotaStatus` in plan/impact but the premium route-handler test expects the HTTP response to include `tier: 'premium'`. | **Resolved:** `getQuotaUsage` returns a plain `{ used, limit, reset_at }` object (always numeric, tier-unaware). `QuotaStatus` is the HTTP response discriminated union (`tier: 'free' \| 'premium'`). The route handler assembles the correct `QuotaStatus` variant from the session tier + `getQuotaUsage` result. |
| impact.md / plan.md | `upgrade_url` source is explicitly marked TBD ("Assume the upgrade destination is available as a constant/config value by the time premium work lands"). | **Resolved for contract purposes:** `upgrade_url` is a `string` field in `QuotaExceededBody` and `QuotaExceededError`; its value is not locked here. The coder must supply it (env var, constant, or hard-coded placeholder). It must be non-empty at runtime; the tester asserts `upgrade_url.length > 0`. |
| test-plan.md | The "Failed download does not count" test says either `checkAndIncrementQuota` is never called (pre-stream failure) OR the stream fails after the call. | **Resolved:** The contract mandates that `checkAndIncrementQuota` is called **only after** auth and resource-existence checks succeed. Pre-stream failures (401, 404) therefore never reach the quota call. The test case for 404 must assert the spy was not called. |
