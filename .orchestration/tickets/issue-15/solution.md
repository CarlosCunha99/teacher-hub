# Solution: Premium Membership with Stripe-Backed Billing

## Direction

Teachers who reach the free-tier monthly download cap can upgrade to premium via Stripe Checkout to continue downloading immediately. Premium status is stored locally in a subscriptions table and kept in sync with Stripe via webhooks, avoiding request-time queries to an external service. The entitlement check (used by the download endpoint in issue #11 and the limit enforcer in issue #16) is a server-side helper function that reads the local DB and maps subscription states to access decisions.

The system defines a subscription lifecycle: `active` (premium, unlimited downloads), `past_due` (premium with grace period), `trialing` (future), `canceled` (free tier from next cycle), and `none` (free tier). Stripe retries webhooks up to 3 days; we handle missed webhooks with idempotent handlers. Brief lags between user cancellation and webhook delivery are acceptable — the user remains premium until the webhook fires, and we expose the `period_end` date so the UI can show accurate renewal dates.

The API surface includes checkout session creation, Stripe Customer Portal access, webhook receiving, subscription status reads, and an entitlement helper. A skeleton settings page displays plan status and allows users to upgrade (free tier) or manage their subscription (premium).

## Key decisions

- **Local DB replication of subscription state** — Stripe is never queried synchronously at download time. Webhooks update a local subscriptions table; entitlement checks read the DB only. Trades off brief lags for latency and reliability.
- **Idempotent webhook handlers** — missing or duplicate webhooks do not corrupt state; we store the Stripe event ID to detect replays.
- **Grace period for past_due** — payment failures (declined renewal) do not immediately downgrade; a grace window (7 days suggested) allows recovery before access revocation.
- **Period-end-based cancel semantics** — canceling a subscription immediately sets status to `canceled` locally, but downloads remain permitted until the current period ends (enforced by the entitlement check reading `current_period_end`). Free tier is enforced from the next cycle.
- **Stripe Checkout and Customer Portal for PCI compliance** — we never touch payment card data; Stripe hosts all payment and subscription management UIs.
- **Thin Stripe adapter** — integration is behind a facade for potential future provider swap.
- **Subscription status endpoint for account settings** — returns plan, next billing date, and related metadata for UI consumption.

## Explicitly rejected

- **Synchronous Stripe queries on download** — causes request-time latency and hard dependency on external service availability.
- **Immediate downgrade on cancel** — would orphan in-flight downloads and violate user expectations; period-end reversion is cleaner.
- **In-house card processing** — PCI scope is unacceptable at this stage; Stripe-hosted flows solve it cleanly.
- **Complex tiered premium plans** — start with unlimited for premium; tiered limits can be added later if needed.
- **Extended storage and exclusive features** — out of scope; filed separately.

## Open questions

None — brainstorm concluded with full agreement on direction, architecture, and API shape.
