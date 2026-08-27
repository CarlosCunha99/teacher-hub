# Code Review

## Verdict
**block**

## Summary
The entitlement calculation, auth guards, raw-body signature verification order, and nominal webhook idempotency sequence match the contract. However, the implementation is not production-persistent, can permanently lose or incorrectly reorder Stripe state transitions, violates the repository upsert contract, and lets several promised error paths escape the handlers. These are correctness and contract failures that can leave paid users free or grant premium after cancellation.

## Blocking findings
(Must be addressed before merge.)

### Subscription and idempotency state disappear between instances
- **File:** `src/lib/db/subscriptions.ts:31`
- **Category:** contract-violation
- **Issue:** All runtime subscription rows and processed-event IDs live only in process memory. A restart, serverless cold start, or a webhook handled by a different instance loses the user's paid status and replay protection. The migration explicitly says it is not run, and its single `stripe_event_id` column could not represent the repository's per-event marker set anyway. This does not satisfy the ticket's database-backed, queryable subscription entity or recoverable webhook behavior.
- **Evidence:** `private subscriptions: Subscription[] = [];`, `private processedEvents = new Set<string>();`, and `export const subscriptionsRepo ... = inMemoryRepo`.
- **Suggested fix direction:** Wire the runtime repository to durable storage and persist processed event IDs in a uniquely constrained event table (or equivalent transactional design).

### Stripe transitions can be discarded before checkout completion
- **File:** `src/app/api/billing/webhook/route.ts:49`
- **Category:** bug
- **Issue:** Subscription events arriving before `checkout.session.completed` cannot be associated with a user and are silently skipped, yet the event is marked processed. Stripe does not guarantee webhook delivery order. `createCheckoutSession` puts `userId` on Checkout Session metadata only, not `subscription_data.metadata`, so the fallback used here will normally be absent. A pre-checkout `past_due` or cancellation update can therefore be lost, after which checkout completion records the account as active.
- **Evidence:** `existing?.userId ?? subscription.metadata?.userId ?? null` returns early when absent, while `POST` unconditionally calls `markEventProcessed(event.id)` after `handleEvent`.
- **Suggested fix direction:** Copy `userId` into Stripe subscription metadata and do not acknowledge unresolved handled events as processed; alternatively retrieve authoritative Stripe state during checkout handling.

### Out-of-order webhooks can re-grant premium
- **File:** `src/app/api/billing/webhook/route.ts:86`
- **Category:** logic
- **Issue:** Distinct Stripe events are applied in delivery order without comparing `event.created` or fetching current Stripe state. A delayed older `customer.subscription.updated` event with `active` status arriving after a deletion will overwrite `canceled`; `isUserPremium` then grants access indefinitely because active status is unconditional.
- **Evidence:** Each event directly calls `upsertSubscription` with its payload status, and storage records no event timestamp/version for stale-event rejection.
- **Suggested fix direction:** Reject stale transitions using persisted Stripe event/object timestamps or reconcile every transition against the current Stripe subscription.

### Upsert behavior contradicts the locked contract
- **File:** `src/lib/db/subscriptions.ts:44`
- **Category:** contract-violation
- **Issue:** The contract requires updating only when the Stripe subscription ID already exists and otherwise creating a new row. The implementation instead falls back to any row for the user and overwrites its Stripe ID. This destroys subscription history and means later events for the old subscription can no longer resolve their owner.
- **Evidence:** `if (!existing) { existing = this.subscriptions.find((s) => s.userId === data.userId); }`.
- **Suggested fix direction:** Remove the user-ID fallback from upsert and let `getSubscriptionByUserId` select the newest separately persisted row.

### Repository failures escape protected route handlers
- **File:** `src/app/api/billing/portal/route.ts:18`
- **Category:** contract-violation
- **Issue:** The repository contract permits methods to throw and requires callers to handle that. Portal performs its repository read before the `try`, and the subscription route has no error boundary at all (`src/app/api/billing/subscription/route.ts:21`). A database outage therefore rejects the handler instead of returning a defined response, contrary to the no-unhandled-error and graceful billing-failure requirements.
- **Evidence:** `await subscriptionsRepo.getSubscriptionByUserId(userId)` executes outside the portal `try`; the subscription route directly awaits both repository and entitlement operations.
- **Suggested fix direction:** Enclose each authenticated handler's repository and billing work in a top-level `try/catch` that returns a stable actionable 500 response.

### Raw-body read can bypass webhook error handling
- **File:** `src/app/api/billing/webhook/route.ts:127`
- **Category:** contract-violation
- **Issue:** `request.text()` is correctly performed before parsing, but it is outside every `try`. An aborted or failed request stream rejects the route promise, violating the webhook contract that handler-body exceptions must be caught and returned as 500 responses.
- **Evidence:** `const rawBody = await request.text();` precedes both catch blocks.
- **Suggested fix direction:** Put raw-body acquisition and the rest of the handler under an outer error boundary while preserving signature failures as 400 responses.

## Important findings
(Should be addressed but not merge-blockers.)

### Idempotency check and update are not atomic
- **File:** `src/app/api/billing/webhook/route.ts:143`
- **Category:** logic
- **Issue:** Concurrent deliveries can both observe an event as unprocessed and both mutate state before either marks it. The ordered calls satisfy the literal sequence in the contract but not robust webhook idempotency.
- **Evidence:** `isEventProcessed`, `handleEvent`, and `markEventProcessed` are three independent awaits with no transaction or unique insert claim.
- **Suggested fix direction:** Atomically claim the event ID and apply the subscription mutation in one transaction.

### Database status invariant is unenforced
- **File:** `migrations/20260827_add_subscriptions.sql:14`
- **Category:** contract-violation
- **Issue:** The contract says status is always one of five literals, but the schema accepts arbitrary text.
- **Evidence:** `status TEXT NOT NULL DEFAULT 'none'` has no check constraint or enum type.
- **Suggested fix direction:** Add a constraint limiting status to `active`, `past_due`, `trialing`, `canceled`, and `none`.

## Suggestions
(Nice-to-haves.)

- Add adversarial tests for reversed Stripe event order, unresolved subscription metadata, repository rejection in every route, body-stream rejection, and concurrent duplicate delivery; current tests cover only serial happy paths and Stripe failures.

## Contract adherence
Signatures and core `isUserPremium` semantics match: `past_due` uses `updatedAt`, `canceled` uses `currentPeriodEnd`, and repository errors fail closed. All three protected routes check null authentication and return 401. Webhook signature verification uses the raw `request.text()` body, checks `isEventProcessed` before upsert, and marks afterward. Adherence is nevertheless incomplete because upsert semantics differ, storage cannot durably implement per-event markers, stale/unresolved events violate state guarantees, and handler exceptions can escape.

## Requirements coverage
- Premium subscription entity exists and is queryable via API: **partial** — API and shape exist, but runtime state is only in memory and auth currently always returns null.
- Active premium users bypass free-tier limits: **partial** — a server-side entitlement helper exists, but no download enforcement integration exists in this ticket.
- Downgrade/cancel reverts at the defined time: **partial** — canceled entitlement timing is correct in isolation, but webhook ordering can restore active status or lose cancellation.
- Subscription status appears in account settings: **covered** — the page renders status and premium/free actions once authentication is implemented.
- Billing and entitlement failures are graceful and recoverable: **missing** — state is volatile, webhook transitions can be lost, and multiple promise rejection paths are unhandled.

## Notes
The auth seam intentionally returns `null` pending issue #2, so the 401 guards themselves are correct but the end-to-end settings and billing flows are not currently reachable. Extended storage and exclusive features remain out of scope as resolved in the ticket.
