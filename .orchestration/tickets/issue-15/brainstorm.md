# Brainstorm: issue-15 — Premium Membership

*(Autopilot mode: user not available; orchestrator leading the brainstorm based on ticket context and codebase state)*

### 2026-08-27 22:00 — dev
The codebase is at skeleton stage — Next.js app, only a health endpoint, no database/auth/schema. Phase 2 has several issues landing roughly together: #2 (auth), #3 (schema), #11 (download endpoint), #16 (free-tier limits), #15 (premium membership = this one). Since none of those are merged yet, premium membership needs to lay foundations that are compatible with their likely shapes, without tight coupling.

The core of this ticket is an entitlement check: when a teacher requests a download, we need to know if they're premium (bypass limit) or free (enforce limit). That check has to be server-side. The question is what data model to use for "premium" and how billing state flows into that model.

### 2026-08-27 22:01 — agent
What's the trust boundary for billing state? The entitlement check must live server-side, but where does the billing source of truth live — is it replicated into our own DB, or are we querying Stripe on every download request?

### 2026-08-27 22:02 — dev
Replicated into our DB is the right approach. Querying Stripe synchronously on every download adds latency and creates a hard dependency on an external service. We'll keep a `subscriptions` table (or a `subscription_status` field on the users table) that is updated via Stripe webhooks. The entitlement check reads our DB, never Stripe directly at request time.

### 2026-08-27 22:03 — agent
That creates a webhook reliability concern — if a webhook is missed or delayed, the local state lags. How is that handled? Grace period, retry, or manual reconciliation?

### 2026-08-27 22:04 — dev
Stripe retries webhooks for up to 3 days, and we'll make webhook handlers idempotent. For the grace period edge case (brief lag between cancel and webhook delivery), the user stays premium for a short window — acceptable given the nice-to-have nature of this feature. We'll expose the actual `period_end` date from Stripe so the UI can show "premium until <date>" even before the webhook fires.

For billing failures (payment decline), Stripe sends `customer.subscription.updated` with status `past_due`. We'll map that to a grace period in our entitlement logic — not immediate downgrade.

### 2026-08-27 22:05 — agent
How do the subscription lifecycle states map to the entitlement decision? Active = download freely, past_due = still downloads (grace), canceled = free tier enforced from next period?

### 2026-08-27 22:06 — dev
Exactly. The mapping is:
- `active` → premium, unlimited downloads
- `past_due` → premium with grace (grace period TBD, 7 days makes sense)
- `trialing` → premium (future, out of scope for now)
- `canceled` → free tier from next billing cycle (access until `current_period_end`)
- `none` / no subscription record → free tier

The subscription entity needs: `userId`, `stripeSubscriptionId`, `stripeCustomerId`, `status` (enum), `currentPeriodEnd`, `canceledAt`, `createdAt`, `updatedAt`.

### 2026-08-27 22:07 — agent
What's the API surface? Do we need a subscription CRUD API, or just a webhook receiver and a read endpoint for the account settings UI?

### 2026-08-27 22:08 — dev
We need:
1. `POST /api/billing/create-checkout-session` — creates a Stripe Checkout session for upgrade
2. `POST /api/billing/portal` — creates a Stripe Customer Portal session for self-service manage/cancel
3. `POST /api/webhooks/stripe` — receives Stripe events and updates our DB
4. `GET /api/subscriptions/me` — returns current subscription status for account settings UI
5. A helper: `checkEntitlement(userId)` — returns `{ isPremium: boolean, reason: 'active' | 'past_due_grace' | 'free' }` for use in the download endpoint (issue #11) and download limit check (issue #16)

The checkout and portal flows use Stripe-hosted UIs so we don't touch payment card data.

### 2026-08-27 22:09 — agent
Account settings subscription visibility — is that a new settings page, or a section in an existing settings page?

### 2026-08-27 22:10 — dev
The codebase has no settings page yet. We'll create a skeleton settings page at `/settings/subscription` that shows: current plan (Free/Premium), next billing date if premium, a "Upgrade to Premium" button if free, and a "Manage subscription" link (Stripe portal) if premium. This satisfies the acceptance criterion without building the full settings page architecture.

### 2026-08-27 22:11 — agent
Makes sense. Any concern about introducing Stripe as a dependency in the skeleton phase?

### 2026-08-27 22:12 — dev
It's fine — the ticket is explicitly tagged `billing` and it's phase 2. We'll keep the Stripe integration behind a thin adapter so it could be swapped later. The `stripe` npm package is the standard approach. Stripe keys go in env vars (documented in `.env.example`).

Let's go with this direction.
