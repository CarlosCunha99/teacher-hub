# Changed files manifest for issue-15

## Implementation files (11 new)
- `src/lib/db/subscriptions.types.ts` — SubscriptionStatus union, Subscription interface, PAST_DUE_GRACE_DAYS
- `src/lib/db/subscriptions.ts` — SubscriptionsRepository interface + in-memory impl
- `src/lib/auth/session.ts` — getSessionUserId auth seam (stub, wired in issue #2)
- `src/lib/stripe.ts` — Stripe SDK facade (checkout, portal, webhook construction)
- `src/lib/entitlements.ts` — isUserPremium entitlement helper
- `src/app/api/billing/checkout/route.ts` — POST /api/billing/checkout
- `src/app/api/billing/portal/route.ts` — POST /api/billing/portal
- `src/app/api/billing/webhook/route.ts` — POST /api/billing/webhook (idempotent Stripe webhooks)
- `src/app/api/billing/subscription/route.ts` — GET /api/billing/subscription
- `src/app/settings/page.tsx` — Subscription settings page (client component)
- `migrations/20260827_add_subscriptions.sql` — Forward-looking DDL (run in issue #3)

## Test files (7 new)
- `src/lib/db/__tests__/subscriptions.test.ts`
- `src/lib/__tests__/entitlements.test.ts`
- `src/app/api/billing/__tests__/checkout.test.ts`
- `src/app/api/billing/__tests__/portal.test.ts`
- `src/app/api/billing/__tests__/webhook.test.ts`
- `src/app/api/billing/__tests__/subscription.test.ts`
- `src/app/settings/__tests__/page.test.tsx`

## Modified files (4)
- `package.json` — added stripe dependency
- `.env.example` — added STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, NEXT_PUBLIC_APP_URL
- `README.md` — documented Stripe env vars and local webhook workflow

## Known limitations (documented in code comments)
1. `src/lib/db/subscriptions.ts` — in-memory storage only; Postgres wired in issue #3
2. `src/app/api/billing/webhook/route.ts` — webhook event ordering not enforced (deferred)
3. `src/lib/auth/session.ts` — auth seam returns null until issue #2 lands (all billing routes 401 until then)

## Test coverage: 55 tests, 13 suites — all passing
