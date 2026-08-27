# Implementation context (shared A/B brief)

## Files this touches

- `src/lib/db/subscriptions.types.ts` — `SubscriptionStatus` union, `Subscription` interface, `PAST_DUE_GRACE_DAYS` constant (new)
- `src/lib/db/subscriptions.ts` — `SubscriptionsRepository` interface + in-memory impl + `subscriptionsRepo` singleton + `__resetForTests()` (new)
- `src/lib/auth/session.ts` — `getSessionUserId` auth seam, currently returns `null` (new; TODO for issue #2)
- `src/lib/stripe.ts` — Stripe SDK facade: `createCheckoutSession`, `createPortalSession`, `constructWebhookEvent` (new)
- `src/lib/entitlements.ts` — `isUserPremium` entitlement helper (new)
- `src/app/api/billing/checkout/route.ts` — `POST /api/billing/checkout` route handler (new)
- `src/app/api/billing/portal/route.ts` — `POST /api/billing/portal` route handler (new)
- `src/app/api/billing/webhook/route.ts` — `POST /api/billing/webhook` route handler (new)
- `src/app/api/billing/subscription/route.ts` — `GET /api/billing/subscription` route handler (new)
- `src/app/settings/page.tsx` — client component settings page (new)
- `migrations/20260827_add_subscriptions.sql` — forward-looking DDL for issue #3 (new)
- `package.json` — add `stripe` to `dependencies` (modify)
- `.env.example` — add four Stripe env var placeholders (modify)
- `README.md` — document new env vars and Stripe CLI webhook instructions (modify)
- `src/__tests__/env-config.test.ts` — extend expected-keys fixture if it hard-asserts the key set (modify, conditional)
- `src/__tests__/readme.test.ts` — extend expected-sections fixture if it hard-asserts section list (modify, conditional)

---

## Patterns to follow

### Naming
- Route handler files: `src/app/api/<domain>/<action>/route.ts` — one file per logical endpoint.
- Exported route functions use HTTP verb as function name: `export async function GET(...)`, `export async function POST(...)`.
- Types in `src/lib/`: PascalCase interfaces/types; `camelCase` for property names (match the existing `HealthPayload` pattern).
- Test files: `<dir>/__tests__/<filename>.test.ts` (existing: `src/app/api/health/__tests__/route.test.ts`).
- Vitest globals are enabled — use `describe`, `it`/`test`, `expect`, `vi` without imports.
- Path alias `@/` resolves to `src/` (configured via `vite-tsconfig-paths`; existing import: `import { HEALTH_STATUS } from "@/lib/health"`).

### Error handling
- Route handlers: return `NextResponse.json({ error: '...' }, { status: N })` — never throw from a handler.
- Use `401` for unauthenticated; `400` for bad input (e.g. missing `stripeCustomerId`); `500` for unexpected server errors.
- Webhook signature failure: return `400`; all valid webhook outcomes (including already-processed) return `200`.
- Entitlement helper: fail-closed — catch all DB errors, resolve `false`.

### Async style
- All route handlers and lib functions: `async/await`, typed return values.
- No explicit `Promise` constructor.
- Raw body in webhook: `await request.text()` — do NOT call `request.json()` first (destroys the body stream).

### Testing style
- Framework: Vitest with `globals: true` (no import needed for `describe`/`it`/`expect`/`vi`).
- Route tests: construct `Request` objects directly — `new Request('http://localhost/api/billing/...', { method: 'POST', headers: {...}, body: ... })` — then call the exported handler function (no live server).
- Stripe mocking: `vi.mock('@/lib/stripe')` at the top of route test files; return fixture objects from mocked functions.
- Auth mocking: `vi.mock('@/lib/auth/session')` to control `getSessionUserId` return value per test.
- DB mocking: `vi.mock('@/lib/db/subscriptions')` for route tests; use the real in-memory impl with `__resetForTests()` in `beforeEach` for `subscriptions.test.ts`.
- Cleanup: call `vi.restoreAllMocks()` in `afterEach`.
- Fake timers: use `vi.useFakeTimers().setSystemTime(new Date(...))` for tests that compare dates to "now"; restore with `vi.useRealTimers()` in `afterEach`.
- Consistent assertion style: `expect(response.status).toBe(200)` and `expect(await response.json()).toEqual({...})`.

---

## Utilities to reuse

- `NextResponse.json(body, { status })` — already used in `src/app/api/health/route.ts`; import from `"next/server"`.
- `@/lib/db/subscriptions` — `subscriptionsRepo` singleton and `__resetForTests()` for test isolation.
- `@/lib/auth/session` — `getSessionUserId` consumed by all four billing routes.
- `@/lib/entitlements` — `isUserPremium` consumed by `GET /api/billing/subscription`.
- `@/lib/stripe` — facade consumed by checkout, portal, and webhook routes.

---

## Anti-patterns in this codebase

- **Do not call `request.json()` before `request.text()` in the webhook handler** — Next.js request body can only be consumed once; raw body string is required for Stripe signature verification.
- **Do not import the Stripe SDK directly in route files** — always go through `@/lib/stripe` facade so the provider is swappable and mocking is uniform across tests.
- **Do not hard-code `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`** — read from `process.env` in the stripe facade only; never pass raw secrets through function parameters.
- **Do not skip `isEventProcessed` check** before DB writes in the webhook handler — idempotency is a stated acceptance criterion.
- **Do not use `export default` for route handlers** — Next.js App Router requires named exports (`GET`, `POST`, etc.).
- **Do not create a `plan: "free"/"premium"` field in `SubscriptionResponse`** — use `isPremium: boolean` only (resolved ambiguity #2 in contract.md).
- **Do not call `process.exit` or throw from `__resetForTests`** — it is only for test setup; keep it synchronous and side-effect-free outside the in-memory store.

---

## Repo commands (verified)

- **Test:** `npm test` (runs `vitest run`)
- **Fast billing subset:** `npx vitest run src/lib/__tests__/entitlements.test.ts src/lib/db/__tests__/subscriptions.test.ts src/app/api/billing`
- **Lint:** `npm run lint` (runs `next lint`)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build`
- **Format:** `npm run format` (runs `prettier --write .`)
