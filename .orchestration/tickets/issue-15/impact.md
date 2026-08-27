# Impact analysis

## Direct changes

All changes below are **new files** (the codebase is a skeleton with only the health endpoint). No existing source file is modified except `package.json`, `.env.example`, and `README.md`.

### New library modules
- `src/lib/stripe.ts` — thin Stripe SDK adapter/facade; exports `createCheckoutSession`, `createPortalSession`, `constructWebhookEvent`; wraps `stripe` npm package so the provider is swappable
- `src/lib/db/subscriptions.ts` — data-access layer for the `subscriptions` table; exports `upsertSubscription`, `getSubscriptionByUserId`, `getSubscriptionByStripeId`, `markEventProcessed`, `isEventProcessed`
- `src/lib/entitlements.ts` — server-side entitlement helper; exports `isUserPremium(userId: string): Promise<boolean>`; reads local DB, maps subscription states (`active`, `past_due`, `canceled`, `none`) to boolean access; the single authoritative gate consumed by issue #11 (download endpoint) and issue #16 (limit enforcer)

### New API routes
- `src/app/api/billing/checkout/route.ts` — `POST /api/billing/checkout`; creates a Stripe Checkout session for the premium price; returns `{ url }` for client redirect; requires authenticated session (issue #2 dep)
- `src/app/api/billing/portal/route.ts` — `POST /api/billing/portal`; creates a Stripe Customer Portal session for subscription management (cancel, update payment); returns `{ url }`; requires `stripe_customer_id` on the subscription row
- `src/app/api/billing/webhook/route.ts` — `POST /api/billing/webhook`; receives Stripe webhook events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`); verifies signature, deduplicates via stored `stripe_event_id`, upserts subscription state; **no auth required** (Stripe-signed)
- `src/app/api/billing/subscription/route.ts` — `GET /api/billing/subscription`; returns current plan, status, and `current_period_end` for the authenticated user; consumed by the settings UI

### New UI
- `src/app/settings/page.tsx` — account settings page; shows current plan (free / premium), next billing date, and an "Upgrade" button (free tier) or "Manage subscription" button (premium); fetches from `GET /api/billing/subscription`

### New tests
- `src/app/api/billing/checkout/__tests__/route.test.ts`
- `src/app/api/billing/portal/__tests__/route.test.ts`
- `src/app/api/billing/webhook/__tests__/route.test.ts` — largest suite; covers idempotency, signature verification failure, each event type, grace-period logic
- `src/app/api/billing/subscription/__tests__/route.test.ts`
- `src/lib/__tests__/entitlements.test.ts` — covers all status variants including `canceled` within period

### New DB migration
- `migrations/YYYYMMDD_add_subscriptions.sql` — creates `subscriptions` table (see Migrations section)

### Modified existing files
- `package.json` — adds `stripe` npm package to `dependencies`; adds `@types/stripe` if not bundled (stripe v12+ includes its own types, so likely no extra type package needed)
- `.env.example` — adds `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_APP_URL`
- `README.md` — updates Environment configuration section to document the four new Stripe env vars

---

## Indirect: callers & consumers

- `src/app/api/download/route.ts` (issue #11, not yet created) calls `isUserPremium` from `src/lib/entitlements.ts` — impact: **compile-break** if that file imports the helper before it exists; once created, **behavior-change** (download gate now enforced)
- Issue #16 free-tier limit enforcer (not yet created) calls `isUserPremium` — impact: **behavior-change** (premium users bypass the monthly cap)
- Auth middleware / session handler (issue #2, not yet created) is called by all four billing routes to resolve `userId` — impact: **compile-break** until auth is wired; billing routes must guard against missing session
- `src/app/api/health/route.ts` — **none**; no change, no new dependency
- `src/lib/health.ts` — **none**

---

## Public API surface

| Symbol / Endpoint | Module | Change type |
|---|---|---|
| `POST /api/billing/checkout` | `src/app/api/billing/checkout/route.ts` | New |
| `POST /api/billing/portal` | `src/app/api/billing/portal/route.ts` | New |
| `POST /api/billing/webhook` | `src/app/api/billing/webhook/route.ts` | New |
| `GET /api/billing/subscription` | `src/app/api/billing/subscription/route.ts` | New |
| `isUserPremium` | `src/lib/entitlements.ts` | New export |
| `upsertSubscription` | `src/lib/db/subscriptions.ts` | New export |
| `getSubscriptionByUserId` | `src/lib/db/subscriptions.ts` | New export |

### Breaking
None — all new symbols and endpoints. No existing exported API changes.

---

## Tests affected

- `src/app/api/health/__tests__/route.test.ts` — **not affected**; health route has no new deps
- `src/__tests__/env-config.test.ts` — **potentially affected** if it asserts the exact set of keys in `.env.example`; adding four Stripe keys would cause an assertion mismatch if the test hard-codes expected keys
- `src/__tests__/readme.test.ts` — **potentially affected** if it asserts README sections; env-variable docs section changes
- `src/__tests__/scripts.test.ts` — not affected
- `src/__tests__/typescript.test.ts` — not affected (new files must satisfy `strict` mode; new `stripe` package must be importable)

New test files (counted in Direct changes above): 5 new test files.

---

## Docs to update

- `README.md` — "Environment configuration" section: add table rows for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_APP_URL`; note that billing variables arrive in issue #15
- `.env.example` — add the four Stripe env var placeholders with comments
- Any future API reference doc — document the four new billing endpoints and their request/response shapes

---

## Migrations / config / infra

- **`migrations/YYYYMMDD_add_subscriptions.sql`** — creates table:
  ```sql
  CREATE TABLE subscriptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT UNIQUE,
    stripe_price_id         TEXT,
    status           TEXT NOT NULL DEFAULT 'none',  -- active | past_due | trialing | canceled | none
    current_period_end      TIMESTAMPTZ,
    stripe_event_id  TEXT,                          -- last processed event id for idempotency
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
  ```
  Depends on `users` table from issue #3 not yet created.

- **`STRIPE_SECRET_KEY`** (env var) — Stripe secret API key; required at runtime for checkout/portal/webhook routes
- **`STRIPE_WEBHOOK_SECRET`** (env var) — Stripe webhook signing secret; required by webhook handler signature verification
- **`STRIPE_PRICE_ID`** (env var) — Stripe Price ID for the premium monthly plan; used by checkout session creation
- **`NEXT_PUBLIC_APP_URL`** (env var) — base URL for Stripe success/cancel redirect URLs in checkout sessions
- **Stripe webhook endpoint registration** — a webhook endpoint must be registered in the Stripe dashboard (or via Stripe CLI for local dev) pointing to `POST /api/billing/webhook`; this is an infra/ops step outside the codebase

---

## External systems

- **Stripe** — new integration; the app will call Stripe REST API to create Checkout sessions and Customer Portal sessions; Stripe will call `POST /api/billing/webhook` to push subscription lifecycle events
- **PostgreSQL** (issue #3 dep) — new `subscriptions` table; all billing reads/writes target this table; the DB must exist and the migration must have run before any billing route is usable
- **Auth/session provider** (issue #2 dep) — billing routes resolve the current user from the session; no billing route can function without auth

---

## Estimated diff size

- **Files touched:** 17 (14 new, 3 modified)
  - 3 new lib modules
  - 4 new API route files
  - 1 new settings page
  - 5 new test files
  - 1 new SQL migration
  - 3 modified (package.json, .env.example, README.md)
- **Rough lines changed:** ~720
  - `src/lib/stripe.ts`: ~35
  - `src/lib/db/subscriptions.ts`: ~70
  - `src/lib/entitlements.ts`: ~45
  - `src/app/api/billing/checkout/route.ts`: ~45
  - `src/app/api/billing/portal/route.ts`: ~40
  - `src/app/api/billing/webhook/route.ts`: ~110
  - `src/app/api/billing/subscription/route.ts`: ~35
  - `src/app/settings/page.tsx`: ~65
  - 5 test files @ ~50 lines each: ~250
  - migration SQL: ~25
  - package.json delta: ~5
  - .env.example delta: ~12
  - README.md delta: ~18
- **Confidence:** medium (skeleton codebase; exact line counts depend on auth/DB integration patterns chosen in issues #2 and #3 which are not yet implemented)
- **Downstream churn:** The new `subscriptions` table schema and the `GET /api/billing/subscription` response shape are wire-format contracts. If either changes post-merge, the following assets will need rewrites:
  - All 5 new billing test files (~250 lines) — they will mock/assert the DB schema and API response shape
  - `src/lib/__tests__/entitlements.test.ts` (~50 lines) — stubs the `getSubscriptionByUserId` return shape
  - Issue #11 download route tests (not yet created) — mock `isUserPremium`; a signature change breaks them
  - Issue #16 limit enforcer tests (not yet created) — same reason
  - Total at-risk fixture/test lines if schema changes: ~300 lines across ~7 files

---

## Warnings

- **Blocked by unimplemented deps:** The subscriptions table references `users.id` (issue #3); checkout/portal/subscription routes require an authenticated session (issue #2). None of these exist. Billing routes must either be feature-flagged or protected by guards that return 501 until deps land.
- **Webhook secret must not be committed:** `STRIPE_WEBHOOK_SECRET` is a signing secret. `.env.example` must contain only a placeholder (e.g. `STRIPE_WEBHOOK_SECRET=whsec_...`), never the real value. The existing gitignore pattern for `.env.local` protects it at runtime.
- **`src/__tests__/env-config.test.ts` may assert `.env.example` keys exactly** — if so, adding four new keys will break it. Inspect before merging.
- **`stripe` package adds ~2 MB to node_modules** — negligible for a Next.js app but worth noting as the first third-party runtime dep.
- **Stripe Checkout redirect URLs require `NEXT_PUBLIC_APP_URL`** to be set correctly per environment; missing or wrong value causes Stripe to redirect to an unreachable URL after payment.
- **Grace period for `past_due` (7 days) is a product decision** baked into the webhook handler logic — if the timeline changes later, the handler and its tests both need updating.

---

## Approach comparison

| Approach | Files touched | Est. +/- lines | Correct? | Why not this |
|---|---|---|---|---|
| **Chosen: local DB replication via webhooks** | 17 | +720 | yes | — |
| Synchronous Stripe queries on every download | ~12 | +480 | yes | Creates hard runtime dependency on Stripe availability at download time; adds latency to the hot download path; violates graceful-degradation requirement |
| Immediate downgrade on cancel | ~17 | +720 | yes | Violates user expectation that paid period is honored; can interrupt in-flight downloads; period-end semantics are standard in SaaS billing |
| In-house card processing (no Stripe) | ~35 | +2000+ | yes | Brings PCI DSS scope onto the platform; unacceptable security/compliance burden at this stage |
| Complex tiered premium plans (multiple price tiers) | ~22 | +900 | yes | Over-engineered for initial launch; a single unlimited premium tier is simpler to enforce and easier to test; tiers can be layered on top of the same subscriptions table later |
