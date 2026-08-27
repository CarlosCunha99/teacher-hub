# Implementation plan

## Goal
Ship a Stripe-backed premium membership feature with checkout, customer portal, webhook-driven local subscription state, an entitlement helper, and a skeleton settings page — all wired for Next.js 15 App Router with TypeScript.

## Approach
The codebase is a skeleton (only a health endpoint exists), so we build the vertical slice from types outward: schema types → data-access layer (in-memory now, PostgreSQL later in issue #3) → Stripe adapter → API routes → UI. No existing production code needs to change; only `package.json`, `.env.example`, and `README.md` get additive edits.

Billing runs through Stripe Checkout and Customer Portal (no PCI scope). Local truth for entitlement lives in a `subscriptions` row per user, kept in sync by idempotent Stripe webhook handlers keyed on `stripe_event_id`. The entitlement helper `isUserPremium(userId)` reads only the local store and maps `active | past_due(within 7d grace) | canceled(within period_end)` to `true`, everything else to `false`.

Because auth (issue #2) and the users table (issue #3) do not exist yet, we introduce a thin `getSessionUserId()` seam that returns `null` today (routes respond `401`) and can be swapped later without touching billing code. The DB layer is a `SubscriptionsRepository` interface with an in-memory implementation used by tests and dev; a Postgres implementation will slot in behind the same interface in issue #3.

Steps are ordered bottom-up (types → repo → stripe adapter → helper → routes → UI → docs) so each commit compiles and its tests pass in isolation.

## Steps
1. **Add Stripe dependency and env scaffolding** — add `stripe` to `dependencies` in `package.json`; add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_APP_URL` to `.env.example` with placeholder values and comments; run `npm install`. Depends on: none.
2. **Define subscription types and status model** — create `src/lib/db/subscriptions.types.ts` exporting `SubscriptionStatus` union (`'active' | 'past_due' | 'trialing' | 'canceled' | 'none'`), `Subscription` interface (mirrors the SQL schema in impact.md), and `PAST_DUE_GRACE_DAYS = 7` constant. Depends on: none. (Parallel with step 1.)
3. **Implement subscriptions repository (in-memory)** — create `src/lib/db/subscriptions.ts` exporting a `SubscriptionsRepository` interface (`upsertSubscription`, `getSubscriptionByUserId`, `getSubscriptionByStripeId`, `markEventProcessed`, `isEventProcessed`) plus an in-memory implementation and a module-level singleton `subscriptionsRepo`. Include a `__resetForTests()` helper. Depends on: step 2.
4. **Write SQL migration for future Postgres backend** — create `migrations/20260827_add_subscriptions.sql` with the CREATE TABLE + index from impact.md, documenting it as forward-looking (issue #3 will run it). Depends on: none. (Parallel with step 3.)
5. **Add auth seam** — create `src/lib/auth/session.ts` exporting `getSessionUserId(request: Request): Promise<string | null>` that currently returns `null` and is TODO-tagged for issue #2. Every protected route imports from here. Depends on: none.
6. **Build Stripe adapter facade** — create `src/lib/stripe.ts` that lazily instantiates a Stripe client from `STRIPE_SECRET_KEY` and exports `createCheckoutSession({ userId, customerId, priceId, successUrl, cancelUrl })`, `createPortalSession({ customerId, returnUrl })`, `constructWebhookEvent(rawBody, signature, secret)`. Throw a typed error if env vars missing. Depends on: step 1.
7. **Implement entitlement helper** — create `src/lib/entitlements.ts` exporting `isUserPremium(userId: string): Promise<boolean>`. Reads via `subscriptionsRepo.getSubscriptionByUserId`, then: `active` → true; `past_due` → true if `updated_at + 7d > now`; `canceled` → true if `current_period_end > now`; else false. Depends on: steps 2, 3.
8. **Implement `POST /api/billing/checkout`** — create `src/app/api/billing/checkout/route.ts`: resolve userId via auth seam (401 if null), look up or create subscription row, call `createCheckoutSession` with `STRIPE_PRICE_ID` and `${NEXT_PUBLIC_APP_URL}/settings?checkout=success|cancel`, return `{ url }`. Depends on: steps 3, 5, 6.
9. **Implement `POST /api/billing/portal`** — create `src/app/api/billing/portal/route.ts`: resolve userId, load subscription, 400 if no `stripe_customer_id`, call `createPortalSession`, return `{ url }`. Depends on: steps 3, 5, 6.
10. **Implement `POST /api/billing/webhook`** — create `src/app/api/billing/webhook/route.ts`. Read raw body (`await request.text()`), verify signature via `constructWebhookEvent` with `STRIPE_WEBHOOK_SECRET`, short-circuit if `isEventProcessed(event.id)`, then handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` by upserting subscription (map Stripe status → local `SubscriptionStatus`, copy `current_period_end`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`), then `markEventProcessed(event.id)`. Return `200 { received: true }` on success, `400` on signature failure. Export `runtime = 'nodejs'`. Depends on: steps 3, 6.
11. **Implement `GET /api/billing/subscription`** — create `src/app/api/billing/subscription/route.ts`: resolve userId (401 if null), load subscription (default to `{ status: 'none' }` if absent), return `{ status, currentPeriodEnd, priceId, isPremium }` where `isPremium` comes from `isUserPremium`. Depends on: steps 3, 5, 7.

**Checkpoint after step 11:** verify `npm run build` and `npm run lint` succeed with the new routes registered before adding UI.

12. **Build skeleton settings page** — create `src/app/settings/page.tsx` as a client component (`'use client'`) that `fetch`es `/api/billing/subscription` on mount, shows plan status + `current_period_end`, renders an "Upgrade to premium" button (posts to `/api/billing/checkout`, redirects to returned `url`) when not premium, or a "Manage subscription" button (posts to `/api/billing/portal`) when premium. Keep styling minimal (inline or existing globals). Depends on: steps 8, 9, 11.
13. **Update README env docs** — extend the Environment configuration section of `README.md` with a row per new env var and a short "Billing (Stripe)" subsection noting that Stripe CLI is needed for local webhook testing. Depends on: step 1.
14. **Adjust `.env.example`-related tests if they hard-assert keys** — inspect `src/__tests__/env-config.test.ts` and `src/__tests__/readme.test.ts`; if they enumerate an exact key set or README section list, update expectations to include the new Stripe entries. Do not rewrite unrelated logic. Depends on: steps 1, 13.

## Files
### Create
- `src/lib/db/subscriptions.types.ts` — status union, Subscription interface, constants
- `src/lib/db/subscriptions.ts` — repository interface + in-memory impl + singleton
- `src/lib/auth/session.ts` — `getSessionUserId` seam for issue #2
- `src/lib/stripe.ts` — Stripe SDK facade
- `src/lib/entitlements.ts` — `isUserPremium`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/portal/route.ts`
- `src/app/api/billing/webhook/route.ts`
- `src/app/api/billing/subscription/route.ts`
- `src/app/settings/page.tsx`
- `migrations/20260827_add_subscriptions.sql`

### Modify
- `package.json` — add `stripe` dependency
- `.env.example` — add four Stripe env vars with placeholders
- `README.md` — document new env vars and local webhook workflow
- `src/__tests__/env-config.test.ts` and/or `src/__tests__/readme.test.ts` — only if they enumerate keys/sections exactly

### Delete
- None.

## Data / schema / migration
- New logical table `subscriptions` (see impact.md for exact DDL). This ticket ships the SQL file only; issue #3 owns the runner. Runtime uses the in-memory repository behind the same interface. Backward compat: additive only; no existing table touched.

## Rollout
- Feature flag: **no** — the routes are new and the settings page is a new URL; no traffic is on them yet. Routes will effectively return 401 until the auth seam is wired in issue #2, which is acceptable.
- Backfill: **no** — no prior subscription data exists.
- Ordering: deploy alongside or before issues #11 and #16 so `isUserPremium` is importable when they land.

## Assumptions and non-decisions
- Auth seam returns `null` for now; coder decides exact error shape (suggest `NextResponse.json({ error: 'unauthenticated' }, { status: 401 })`).
- In-memory repository is intentional for this ticket; issue #3 will replace it behind the same interface.
- Stripe SDK version: use the latest stable `stripe@^17` line; pin exact version at coder's discretion.
- Route handlers return `NextResponse` JSON; webhook uses `runtime = 'nodejs'` to access raw body.
- `PAST_DUE_GRACE_DAYS = 7` measured from `updated_at`; coder may store a dedicated `past_due_since` field instead if cleaner.

## Not doing
- No PostgreSQL client, connection pool, or migration runner (issue #3).
- No real auth/session middleware (issue #2).
- No download endpoint or free-tier counter (issues #11, #16).
- No tiered pricing, no trials UI, no annual plans.
- No email notifications on payment failure.
- No admin tooling for manual subscription overrides.
- No tests — owned by the parallel test planner.
