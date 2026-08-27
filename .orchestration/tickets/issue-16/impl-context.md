# Implementation context (shared A/B brief)

## Files this touches

| Path | Purpose |
|------|---------|
| `src/lib/download-quota.ts` | **New.** Core quota logic: constant, month helpers, `checkAndIncrementQuota`, `getQuotaUsage`, `QuotaExceededError`, exported types. |
| `src/app/api/me/download-quota/route.ts` | **New.** Thin App Router handler for `GET /api/me/download-quota`. |
| `src/app/api/me/download-quota/__tests__/route.test.ts` | **New.** Unit tests for the quota endpoint. |
| `src/app/api/downloads/[id]/route.ts` | **Modify** (owned by issue #11; may not exist yet). Insert quota enforcement before the file stream. |
| `src/components/DownloadQuotaIndicator.tsx` | **New.** Client component displaying remaining downloads or premium status. |
| `src/components/__tests__/DownloadQuotaIndicator.test.tsx` | **New.** Component tests (jsdom environment). |
| `src/lib/__tests__/download-quota.test.ts` | **New.** Unit tests for quota lib. |
| `src/lib/db/migrations/<timestamp>_create_monthly_download_counts.sql` | **New.** DDL for `monthly_download_counts`; atomic upsert statement. |
| `.env.example` | **Modify.** Add `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT=50` with explanatory comment. |
| `README.md` | **Modify.** Document new env var and UTC calendar-month reset / owner-exemption rules. |
| `src/app/layout.tsx` | **Modify.** Mount `<DownloadQuotaIndicator />` in the root shell. |

---

## Patterns to follow

- **Naming:** PascalCase for types and React components; camelCase for functions and variables; SCREAMING_SNAKE_CASE for module-level constants (see `HEALTH_STATUS` in `src/lib/health.ts`).
- **Export style:** Named exports only (no default exports for lib modules; default export for the React component per Next.js / React convention — see `src/app/layout.tsx`).
- **File layout for lib modules:** exports at the top, helpers and classes below, no barrel `index.ts` needed yet.
- **Error handling:** Throw a typed subclass of `Error` for domain errors (cf. `QuotaExceededError`); propagate unexpected DB errors without wrapping. Route handlers `catch` typed errors and translate to HTTP status codes.
- **Async style:** `async`/`await` throughout; no raw Promise chains (see `src/app/api/health/route.ts`).
- **Response style:** Use `NextResponse.json(payload, { status })` for JSON responses (see `src/app/api/health/route.ts`).
- **TypeScript:** `strict` mode is on — no `any`, no non-null assertions without explicit justification, use discriminated unions for multi-shape results.
- **Testing style:** `describe` / `it` blocks; `vi.fn()` / `vi.spyOn()` for mocks; `vi.stubGlobal` for `fetch` in component tests; `vi.useFakeTimers()` + `vi.setSystemTime()` for date pinning; reset mocks in `afterEach`. See `src/app/api/health/__tests__/route.test.ts` for the existing test structure. Component tests must add `// @vitest-environment jsdom` at the top of the file.

---

## Utilities to reuse

- `next/server::NextResponse` — `NextResponse.json(body, { status })` for all route JSON responses (already used in `src/app/api/health/route.ts`).
- `@/lib/db` (prerequisite) — import the `DbClient`-compatible default export; pass it into `checkAndIncrementQuota` and `getQuotaUsage` rather than importing inside the lib function.
- `getSession` (prerequisite, issue #2) — import from wherever issue #2 exports it; call as `getSession(request)` returning `{ user: { id: string; tier: 'free' | 'premium' } } | null`.

---

## Anti-patterns in this codebase

- **Do not** use `export default` for lib modules — existing lib files (`src/lib/health.ts`) use named exports only; reserve `export default` for React components and Next.js route files.
- **Do not** import `DbClient` or session helpers inside `src/lib/download-quota.ts` at the top level. Pass them as parameters so the lib remains easily unit-testable without module mocking.
- **Do not** evaluate `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` lazily inside function bodies — read it once at module load and export the constant so tests can verify its default without re-importing the module.
- **Do not** use local timezone arithmetic — always use UTC methods (`Date.prototype.getUTCFullYear`, `getUTCMonth`) for year/month calculations; `reset_at` must always be a `Z`-suffixed ISO 8601 string.
- **Do not** perform the DB increment and then separately decide whether to allow — use the value returned by the single atomic upsert as the authoritative count.
- **Do not** call `checkAndIncrementQuota` before confirming the resource exists and the request is authenticated — the quota counter must never be touched for requests that will ultimately fail with 401 or 404.

---

## Repo commands (verified)

- **Test:** `npx vitest run`
- **Test (new files only):** `npx vitest run src/lib/__tests__/download-quota.test.ts src/app/api/me/download-quota/__tests__/route.test.ts src/components/__tests__/DownloadQuotaIndicator.test.tsx`
- **Lint:** `npm run lint` (runs `next lint`)
- **Format check:** `npm run format:check` (runs `prettier --check .`)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build` (runs `next build`)
