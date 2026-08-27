# Test plan

## Coverage summary
- Unit tests: 6 new files, 0 updated
- Functional/integration tests: 0 new dedicated integration files (route tests below double as functional tests against in-memory/mocked DB and Stripe SDK — no live external calls)
- Existing regression tests preserved: yes — no existing test file (`src/__tests__/*`, `src/app/api/health/__tests__/route.test.ts`) is modified by this feature; `env-config.test.ts` and `readme.test.ts` may need their fixtures extended (see Fixtures & data) but their existing assertions are not removed or weakened.

## Test runner
- Framework: Vitest (`vitest.config.ts`, `environment: "node"`, `globals: true`)
- Command: `npm test` (runs `vitest run`)
- Fast subset: `npx vitest run src/lib/__tests__/entitlements.test.ts src/lib/db/__tests__/subscriptions.test.ts src/app/api/billing`

## Behaviors to test

### Unit

- **Entitlement: active subscription grants premium** — a user with subscription status `active` is premium regardless of `current_period_end`.
  - File: `src/lib/__tests__/entitlements.test.ts` (new)
  - Key assertions:
    - `isUserPremium(userId)` resolves `true` when the stored subscription row has `status: "active"`.
  - Setup: mock `getSubscriptionByUserId` (from `src/lib/db/subscriptions.ts`) to return a fixed row `{ status: "active", current_period_end: <any future or past date> }`.
  - Maps to acceptance criterion: "A teacher with an active premium subscription is not blocked by the free-tier download limit and can download beyond it."

- **Entitlement: past_due subscription grants premium (grace period)** — a user with status `past_due` is still treated as premium (grace window, per solution.md's 7-day grace decision).
  - File: `src/lib/__tests__/entitlements.test.ts`
  - Key assertions:
    - `isUserPremium(userId)` resolves `true` when row status is `past_due`.
  - Setup: mock `getSubscriptionByUserId` to return `{ status: "past_due", current_period_end: <future> }`.
  - Maps to acceptance criterion: "Billing and entitlement failures are handled gracefully" / edge case "Billing failure mid-subscription (declined renewal): define grace period vs. immediate downgrade."

- **Entitlement: canceled subscription with future period_end still grants premium** — cancellation is period-end based; access persists until `current_period_end` passes.
  - File: `src/lib/__tests__/entitlements.test.ts`
  - Key assertions:
    - `isUserPremium(userId)` resolves `true` when `status: "canceled"` and `current_period_end` is in the future relative to "now".
  - Setup: mock `getSubscriptionByUserId` to return `{ status: "canceled", current_period_end: <now + 5 days> }`; freeze/inject "now" via a fake clock or by asserting relative dates (e.g., `Date.now() + 5 * 86400000`) to avoid flakiness.
  - Maps to acceptance criterion: "Downgrade/cancel flows revert user to free-tier behavior correctly" (period-end timing decision in solution.md).

- **Entitlement: canceled subscription with past period_end reverts to free** — once `current_period_end` has passed, a canceled subscription no longer grants premium.
  - File: `src/lib/__tests__/entitlements.test.ts`
  - Key assertions:
    - `isUserPremium(userId)` resolves `false` when `status: "canceled"` and `current_period_end` is in the past.
  - Setup: mock `getSubscriptionByUserId` to return `{ status: "canceled", current_period_end: <now - 1 day> }`.
  - Maps to acceptance criterion: "Downgrade/cancel flows revert user to free-tier behavior correctly."

- **Entitlement: no subscription record grants free tier** — a user with no row (or status `none`) is not premium.
  - File: `src/lib/__tests__/entitlements.test.ts`
  - Key assertions:
    - `isUserPremium(userId)` resolves `false` when `getSubscriptionByUserId` returns `null`/`undefined`.
    - `isUserPremium(userId)` resolves `false` when the row exists with `status: "none"`.
  - Setup: two sub-cases — mock returns `null`, and mock returns `{ status: "none" }`.
  - Maps to acceptance criterion: "Premium subscription model exists in database and API" (baseline free-tier default).

- **Entitlement: DB/read failure degrades to a defined, non-crashing outcome** — if the underlying DB read throws or times out, the helper does not propagate an unhandled exception that would hard-fail unrelated request paths.
  - File: `src/lib/__tests__/entitlements.test.ts`
  - Key assertions:
    - `isUserPremium(userId)` either resolves `false` (fail-closed) or rejects with a typed/catchable error — pick one behavior and assert it explicitly (do not assert both); recommend fail-closed (`false`) per "entitlement is neither wrongly granted nor wrongly revoked" and graceful-degradation edge case.
  - Setup: mock `getSubscriptionByUserId` to reject with a generic `Error("db unavailable")`.
  - Maps to acceptance criterion: "Billing and entitlement failures are handled gracefully" / edge case "Graceful degradation when the billing/payment provider is unavailable."
  - Note: this test's exact expectation depends on an implementation decision not yet made in solution.md; flagged in "Not tested" section below as needing plan.md confirmation, but scaffolded here since it is a stated success criterion.

- **isUserPremium invalid/unknown input** — malformed or empty `userId` does not throw an unhandled error.
  - File: `src/lib/__tests__/entitlements.test.ts`
  - Key assertions:
    - `isUserPremium("")` and `isUserPremium(undefined as unknown as string)` resolve `false` or throw a clear validation error (pick one, assert consistently).
  - Setup: no DB mock needed if validation happens before the DB call; otherwise mock `getSubscriptionByUserId` to return `null`.
  - Maps to acceptance criterion: security requirement "entitlement checks must be server-side; a client must not be able to self-report premium status" (defensive input handling).

- **subscriptions DB layer: upsertSubscription creates and updates by stripe_subscription_id** — a first call inserts, a second call with the same `stripe_subscription_id` updates the same row rather than creating a duplicate.
  - File: `src/lib/db/__tests__/subscriptions.test.ts` (new)
  - Key assertions:
    - After two `upsertSubscription` calls with the same `stripe_subscription_id` but different `status`, `getSubscriptionByStripeId` returns exactly one row reflecting the latest status.
  - Setup: use the project's test DB strategy (in-memory/sqlite shim or a mocked query layer — see Fixtures & data; exact mechanism depends on plan.md's DB access choice, not yet read by this planner).
  - Maps to acceptance criterion: "Premium subscription entity exists and is queryable via the API."

- **subscriptions DB layer: idempotency markers** — `isEventProcessed` returns `true` only after `markEventProcessed` has been called for that `stripe_event_id`, and only for that specific ID.
  - File: `src/lib/db/__tests__/subscriptions.test.ts`
  - Key assertions:
    - `isEventProcessed("evt_1")` is `false` before marking, `true` after `markEventProcessed("evt_1")`.
    - `isEventProcessed("evt_2")` remains `false` after marking only `evt_1` (no cross-contamination between event IDs).
  - Setup: clean/empty test DB fixture per test (see Fixtures & data).
  - Maps to acceptance criterion: edge case "Idempotency of billing provider webhooks (avoid double-applying subscription events)."

### Functional / integration

- **POST /api/billing/checkout — creates a session for an authenticated user** — a valid authenticated request returns a redirect URL from Stripe Checkout.
  - File: `src/app/api/billing/checkout/__tests__/route.test.ts` (new)
  - Preconditions: request carries a valid session/user context (mechanism depends on issue #2 auth stub — see Fixtures & data); `src/lib/stripe.ts`'s `createCheckoutSession` is mocked to avoid real network calls.
  - Actions: call the route's `POST` handler with a `Request` built like the health test (`new Request("http://localhost/api/billing/checkout", { method: "POST", ... })`), with the Stripe adapter mocked to return `{ url: "https://checkout.stripe.com/session/xyz" }`.
  - Assertions: response status 200; body equals `{ url: "https://checkout.stripe.com/session/xyz" }`; the mocked `createCheckoutSession` was called with the correct `userId`/`priceId` (from `STRIPE_PRICE_ID`).
  - Cleanup: restore mocks (`vi.restoreAllMocks()`); reset env var overrides if any were set.
  - Maps to acceptance criterion: "Upgraded users bypass free-tier download limits" (checkout is the entry point to premium).

- **POST /api/billing/checkout — unauthenticated request is rejected** — no session present returns 401/redirect, not a Stripe session.
  - File: `src/app/api/billing/checkout/__tests__/route.test.ts`
  - Preconditions: request built without auth context/cookie/header.
  - Actions: call `POST` handler with a bare `Request`.
  - Assertions: response status 401 (or the project's defined unauthenticated status); `createCheckoutSession` mock is never called.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: security note "entitlement checks must be server-side" (billing initiation must not be spoofable).

- **POST /api/billing/checkout — Stripe adapter failure surfaces an actionable error** — Stripe API error (e.g., network timeout, invalid price ID) does not crash the route and returns a clear error response.
  - File: `src/app/api/billing/checkout/__tests__/route.test.ts`
  - Preconditions: authenticated request; `createCheckoutSession` mock rejects with an error.
  - Actions: call `POST` handler.
  - Assertions: response status 5xx (or defined error status); body contains a non-empty, user-actionable `error`/`message` field (not a raw stack trace); no unhandled promise rejection.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Billing and entitlement failures are handled gracefully."

- **POST /api/billing/portal — creates a portal session for a premium user with a stripe_customer_id** — authenticated premium user gets a portal URL.
  - File: `src/app/api/billing/portal/__tests__/route.test.ts` (new)
  - Preconditions: authenticated user whose subscription row has a `stripe_customer_id`; `createPortalSession` mocked.
  - Actions: call `POST` handler.
  - Assertions: response 200; body `{ url: ... }` matches mocked return; mock called with the correct `stripe_customer_id`.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Subscription status is visible in account settings" (portal supports the "Manage subscription" action).

- **POST /api/billing/portal — user with no stripe_customer_id (never subscribed) is rejected** — a free-tier user who never started checkout has no customer ID to manage.
  - File: `src/app/api/billing/portal/__tests__/route.test.ts`
  - Preconditions: authenticated user whose subscription lookup returns `null` or a row with no `stripe_customer_id`.
  - Actions: call `POST` handler.
  - Assertions: response is a defined 4xx (e.g. 400/404) with an actionable message; `createPortalSession` is never called.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Billing and entitlement failures are handled gracefully."

- **POST /api/billing/webhook — checkout.session.completed activates a subscription** — a first-time checkout webhook creates/updates the local subscription row to `active`.
  - File: `src/app/api/billing/webhook/__tests__/route.test.ts` (new)
  - Preconditions: `constructWebhookEvent` mocked to return a `checkout.session.completed` event payload with a distinct `id` (event ID) and subscription/customer identifiers; DB layer mocked/spied (`upsertSubscription`, `markEventProcessed`, `isEventProcessed` returning `false` initially).
  - Actions: POST the raw request body + a `stripe-signature` header to the webhook route handler.
  - Assertions: response 200; `upsertSubscription` called once with `status: "active"` and the correct `stripe_customer_id`/`stripe_subscription_id`; `markEventProcessed` called with the event's `id`.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Premium subscription entity exists and is queryable via the API" / "Upgraded users bypass free-tier download limits."

- **POST /api/billing/webhook — customer.subscription.updated: active → past_due** — a payment failure transitions status without deleting the row.
  - File: `src/app/api/billing/webhook/__tests__/route.test.ts`
  - Preconditions: existing subscription row mocked as `active`; webhook event mocked as `customer.subscription.updated` with Stripe subscription status `past_due`.
  - Actions: POST the webhook request.
  - Assertions: response 200; `upsertSubscription` called with `status: "past_due"`; `current_period_end` preserved/updated from the event payload.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: edge case "Billing failure mid-subscription (declined renewal): define grace period vs. immediate downgrade."

- **POST /api/billing/webhook — customer.subscription.updated: past_due → canceled** — continued failure after the grace period moves the subscription to canceled.
  - File: `src/app/api/billing/webhook/__tests__/route.test.ts`
  - Preconditions: existing row mocked as `past_due`; webhook event mocked as `customer.subscription.updated` with status `canceled` (or `customer.subscription.deleted`, per whichever event Stripe actually emits for this transition — confirm against `src/lib/stripe.ts` event mapping once implemented).
  - Actions: POST the webhook request.
  - Assertions: response 200; `upsertSubscription` called with `status: "canceled"` and a `current_period_end` reflecting the period boundary (not immediately revoking access — access continues per period-end semantics, verified separately by the entitlements tests).
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Downgrade/cancel flows revert user to free-tier behavior correctly."

- **POST /api/billing/webhook — customer.subscription.deleted removes premium access at period boundary** — explicit deletion event sets local status to `canceled`/`none` consistently.
  - File: `src/app/api/billing/webhook/__tests__/route.test.ts`
  - Preconditions: existing row mocked as `active`; webhook event mocked as `customer.subscription.deleted`.
  - Actions: POST the webhook request.
  - Assertions: response 200; `upsertSubscription` called with the terminal status the implementation defines (`canceled` or `none`) and correct `current_period_end`.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Downgrade/cancel flows revert user to free-tier behavior correctly."

- **POST /api/billing/webhook — idempotency: same event ID processed twice is a no-op the second time** — replayed/duplicate webhook delivery does not double-apply the state change or side effects.
  - File: `src/app/api/billing/webhook/__tests__/route.test.ts`
  - Preconditions: webhook event mocked with a fixed `id` (e.g. `evt_123`); `isEventProcessed` mocked to return `false` on first call and `true` on second call for that same ID.
  - Actions: POST the same webhook payload twice in sequence within the test.
  - Assertions: first call: response 200, `upsertSubscription` called once. Second call: response 200 (Stripe expects 2xx even for already-processed events, to stop retries), `upsertSubscription` NOT called again (call count stays at 1).
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: edge case "Idempotency of billing provider webhooks (avoid double-applying subscription events)."

- **POST /api/billing/webhook — invalid signature is rejected** — a request with a missing/invalid `stripe-signature` header is not processed.
  - File: `src/app/api/billing/webhook/__tests__/route.test.ts`
  - Preconditions: `constructWebhookEvent` mocked to throw (simulating Stripe SDK signature verification failure).
  - Actions: POST a request with a bogus signature header.
  - Assertions: response 400; no DB writes attempted (`upsertSubscription` and `markEventProcessed` not called).
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: security note "entitlement checks must be server-side; a client must not be able to self-report premium status" (webhook forgery protection).

- **GET /api/billing/subscription — returns free-tier shape for a user with no subscription** — baseline read for a brand-new user.
  - File: `src/app/api/billing/subscription/__tests__/route.test.ts` (new)
  - Preconditions: authenticated user; `getSubscriptionByUserId` mocked to return `null`.
  - Actions: call `GET` handler.
  - Assertions: response 200; body reflects `{ plan: "free", status: "none", current_period_end: null }` (or the implementation's equivalent shape).
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Subscription status is visible in account settings."

- **GET /api/billing/subscription — returns premium/active shape** — active subscriber sees plan and renewal date.
  - File: `src/app/api/billing/subscription/__tests__/route.test.ts`
  - Preconditions: authenticated user; `getSubscriptionByUserId` mocked to return `{ status: "active", current_period_end: <future date> }`.
  - Actions: call `GET` handler.
  - Assertions: response 200; body reflects `{ plan: "premium", status: "active", current_period_end: <ISO date matching mock> }`.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Subscription status is visible in account settings."

- **GET /api/billing/subscription — returns past_due shape distinctly from active** — status field differentiates grace-period users from fully active ones (only this one axis changes vs. the previous case; all other inputs pinned identical).
  - File: `src/app/api/billing/subscription/__tests__/route.test.ts`
  - Preconditions: same authenticated user and `current_period_end` as the active case; only `status` changed to `past_due`.
  - Actions: call `GET` handler.
  - Assertions: body `status` is `"past_due"`; `plan` still reflects premium access (per grace period) if that is the chosen response contract — assert exactly one convention consistently.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Subscription status is visible in account settings" / "Billing and entitlement failures are handled gracefully."

- **GET /api/billing/subscription — returns canceled-but-still-active-until-period-end shape** — same period_end as active case, only `status` changed to `canceled`, to isolate the status axis.
  - File: `src/app/api/billing/subscription/__tests__/route.test.ts`
  - Preconditions: same `current_period_end` (future) as prior cases; only `status` changed to `canceled`.
  - Actions: call `GET` handler.
  - Assertions: body `status` is `"canceled"`; `current_period_end` is present and unchanged from input, so the UI can render "access ends on <date>".
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: "Downgrade/cancel flows revert user to free-tier behavior correctly" / "Subscription status is visible in account settings."

- **GET /api/billing/subscription — unauthenticated request is rejected** — no session returns 401, not a default free-tier body.
  - File: `src/app/api/billing/subscription/__tests__/route.test.ts`
  - Preconditions: request built without auth context.
  - Actions: call `GET` handler.
  - Assertions: response 401; `getSubscriptionByUserId` never called.
  - Cleanup: restore mocks.
  - Maps to acceptance criterion: security note "entitlement checks must be server-side."

- **Settings page — renders free-tier UI** — shows "Upgrade" call to action and no billing-management controls for a free user.
  - File: `src/app/settings/__tests__/page.test.tsx` (new)
  - Preconditions: mock `fetch`/data-loading for `GET /api/billing/subscription` to resolve `{ plan: "free", status: "none", current_period_end: null }`.
  - Actions: render the settings page component (React Testing Library, consistent with the project's existing patterns — confirm exact renderer/setup in plan.md, since no component test currently exists in the repo to copy from).
  - Assertions: an "Upgrade" button/link is present; no "Manage subscription" control is present; no error banner is shown.
  - Cleanup: unmount, restore mocks.
  - Maps to acceptance criterion: "Subscription status is visible in account settings."

- **Settings page — renders premium UI** — shows plan status, renewal date, and "Manage subscription" control for an active premium user.
  - File: `src/app/settings/__tests__/page.test.tsx`
  - Preconditions: mock the subscription fetch to resolve `{ plan: "premium", status: "active", current_period_end: <future ISO date> }`.
  - Actions: render the settings page component.
  - Assertions: page displays the plan as "Premium"/"Active"; displays the renewal date; shows a "Manage subscription" control instead of "Upgrade"; no "Upgrade" control is shown.
  - Cleanup: unmount, restore mocks.
  - Maps to acceptance criterion: "Subscription status is visible in account settings."

- **Settings page — renders canceled-but-in-grace UI** — communicates that access continues until period end after cancellation.
  - File: `src/app/settings/__tests__/page.test.tsx`
  - Preconditions: mock the subscription fetch to resolve `{ plan: "premium", status: "canceled", current_period_end: <future ISO date> }`.
  - Actions: render the settings page component.
  - Assertions: page shows a message indicating access continues until the given date (e.g., "Access ends on <date>"); does not show "Upgrade" as if the user were already free.
  - Cleanup: unmount, restore mocks.
  - Maps to acceptance criterion: "Downgrade/cancel flows revert user to free-tier behavior correctly."

- **Settings page — graceful billing failure surfaces an actionable message** — when the subscription status fetch fails (network error / 5xx) or the "Upgrade" action's checkout call fails, the user sees a clear error, not a blank/broken page.
  - File: `src/app/settings/__tests__/page.test.tsx`
  - Preconditions: mock the subscription fetch to reject or resolve with a non-2xx status; separately, mock a failed `POST /api/billing/checkout` triggered by clicking "Upgrade".
  - Actions: render the page under the failing fetch; simulate a user clicking "Upgrade" when checkout creation fails.
  - Assertions: an error message/banner is rendered (e.g., "Something went wrong loading your subscription — try again" / "Couldn't start checkout, please retry"); the page does not crash (no unhandled render error); no false "premium" or "free" state is asserted from stale/default data.
  - Cleanup: unmount, restore mocks.
  - Maps to acceptance criterion: "Billing and entitlement failures are handled gracefully." (This is the primary functional test for the "what does the user see on Stripe error" behavior requested in the dispatch.)

## Edge cases covered
- Billing failure mid-subscription (declined renewal): grace period vs. immediate downgrade → tested by: "Entitlement: past_due subscription grants premium (grace period)"; "customer.subscription.updated: active → past_due"; "customer.subscription.updated: past_due → canceled".
- Concurrent access during a subscription state change → **not tested** (see Not tested below).
- Graceful degradation when the billing/payment provider is unavailable (entitlement reads should not hard-fail downloads) → tested by: "Entitlement: DB/read failure degrades to a defined, non-crashing outcome"; "POST /api/billing/checkout — Stripe adapter failure surfaces an actionable error"; "Settings page — graceful billing failure surfaces an actionable message."
- Downgrade when usage already exceeds the free cap for the current month → **not tested** (see Not tested below; owned by issue #16's enforcer, not this ticket's code).
- Idempotency of billing provider webhooks → tested by: "subscriptions DB layer: idempotency markers"; "POST /api/billing/webhook — idempotency: same event ID processed twice is a no-op the second time."
- Security: entitlement checks must be server-side, client cannot self-report premium → tested by: "isUserPremium invalid/unknown input"; "POST /api/billing/checkout — unauthenticated request is rejected"; "POST /api/billing/webhook — invalid signature is rejected"; "GET /api/billing/subscription — unauthenticated request is rejected."
- Owners downloading their own resources are excluded from limit enforcement (issue #16 rule) → **not tested here**; this ticket only provides `isUserPremium`, it does not implement the download/limit path — owned by issue #11/#16.

## Not tested (with reason)
- **Concurrent access during a subscription state change** (edge case in ticket.md) — no concrete download/limit-enforcement code exists in this ticket's scope (owned by issues #11/#16); a true concurrency test requires the download endpoint to exist. Recommend a follow-up integration test once issue #11 lands, exercising a download request racing a webhook-driven state change against the real DB.
- **Downgrade when current-month usage already exceeds the free cap** (acceptance criterion, edge case) — the free-tier usage counter and its enforcement live in issue #16, not in this ticket's files. `isUserPremium` only reports the entitlement boolean/state; it does not know about usage counts. Flagged for issue #16's test plan instead.
- **End-to-end Stripe sandbox test (real Checkout/webhook round-trip)** — out of scope for unit/functional Vitest suite; would require live network calls to Stripe test mode and is better suited to a separate manual/CI-gated smoke test, not part of this PR's automated suite.
- **Migration SQL correctness** (`migrations/YYYYMMDD_add_subscriptions.sql`) — no test framework in this repo currently exercises raw SQL migrations against a real Postgres instance (no such harness exists yet, per `impact.md`'s note that issue #3's schema/data-access conventions are still pending). Recommend a migration-runner smoke test once issue #3 lands.
- **`.env.example` / `README.md` doc content assertions** — covered indirectly by existing `env-config.test.ts`/`readme.test.ts` if those tests enumerate expected keys; not a new test authored by this plan since it's about extending fixtures rather than new behavior (see Fixtures & data).

## Fixtures & data
- **Auth/session stub**: all four billing routes and the settings page require a resolved `userId`. Since issue #2 (auth) is not yet implemented, tests must use whatever session-stub/mocking convention the implementation plan establishes (e.g., a mocked `getSession()`/`getCurrentUser()` module). This planner cannot fix the exact mechanism (not in scope of files read); implementation plan should specify it, and this test plan's "authenticated request" setups assume that stub is injectable via `vi.mock`.
- **Stripe SDK mock**: `src/lib/stripe.ts`'s exported functions (`createCheckoutSession`, `createPortalSession`, `constructWebhookEvent`) should be mocked with `vi.mock("@/lib/stripe")` in all route tests — no test should hit the real Stripe network API or require real Stripe keys in CI.
- **Subscriptions DB fixture**: `src/lib/db/__tests__/subscriptions.test.ts` needs a way to exercise `upsertSubscription`/`getSubscriptionByUserId`/`getSubscriptionByStripeId`/`markEventProcessed`/`isEventProcessed` against real logic without a live Postgres instance — recommend an in-memory fake (e.g., a Map-backed test double swapped in via dependency injection or module mock) unless the implementation plan chooses a different test-DB strategy (e.g., pg-mem, sqlite shim, or a Postgres test container). This choice belongs to the implementation planner; this test plan assumes *some* isolated, resettable store is available per test (`beforeEach` reset).
- **Fixed/fake "now" for period_end comparisons**: entitlement tests comparing `current_period_end` to "now" should either inject a fake timer (`vi.useFakeTimers().setSystemTime(...)`) or use relative offsets (`Date.now() + N`) to avoid flakiness and clarify intent; pick one convention and apply consistently across `entitlements.test.ts`.
- **Sample Stripe event payloads**: webhook tests need representative fixture objects for `checkout.session.completed`, `customer.subscription.updated` (with nested Stripe `status` values `active`/`past_due`/`canceled`), and `customer.subscription.deleted`, each including a unique `id` field for idempotency testing. These can live as inline literals in `webhook/__tests__/route.test.ts` or a shared `src/app/api/billing/webhook/__tests__/fixtures.ts` if reused.
- **Request construction pattern**: follow the existing style in `src/app/api/health/__tests__/route.test.ts` — build routes' inputs with `new Request(url, { method, headers, body })` and call the exported `GET`/`POST` handler directly (no live server needed).
