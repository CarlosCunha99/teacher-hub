# Contract for issue-15

Written by: contract-writer agent
Locked at: 2026-08-27T22:10:09.410+01:00
Consumed by: coder, tester, spec-reviewer, diagnoser

---

## Interfaces

### subscriptions.types — SubscriptionStatus / Subscription / PAST_DUE_GRACE_DAYS
- **Path:** `src/lib/db/subscriptions.types.ts`
- **Signature:**
  ```ts
  export type SubscriptionStatus =
    | 'active'
    | 'past_due'
    | 'trialing'
    | 'canceled'
    | 'none';

  export interface Subscription {
    id: string;                          // UUID
    userId: string;                      // UUID — references users.id
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null; // UNIQUE
    stripePriceId: string | null;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    stripeEventId: string | null;        // last processed event id (idempotency)
    createdAt: Date;
    updatedAt: Date;
  }

  export const PAST_DUE_GRACE_DAYS = 7;
  ```
- **Semantics:**
  - Pre-conditions: none (pure types / constants).
  - Post-conditions: n/a.
  - Invariants: `status` is always one of the five literal values; `stripeSubscriptionId` is unique across all rows when non-null.
- **Errors:** none.
- **Side effects:** none.
- **Not in contract:** camelCase↔snake_case column mapping (implementation concern).

---

### SubscriptionsRepository — interface
- **Path:** `src/lib/db/subscriptions.ts`
- **Signature:**
  ```ts
  export interface SubscriptionsRepository {
    upsertSubscription(data: UpsertSubscriptionData): Promise<Subscription>;
    getSubscriptionByUserId(userId: string): Promise<Subscription | null>;
    getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
    markEventProcessed(stripeEventId: string): Promise<void>;
    isEventProcessed(stripeEventId: string): Promise<boolean>;
  }

  export interface UpsertSubscriptionData {
    userId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    status: SubscriptionStatus;
    currentPeriodEnd?: Date | null;
    stripeEventId?: string | null;
  }

  /** Module-level singleton (in-memory impl for dev/test). */
  export declare const subscriptionsRepo: SubscriptionsRepository;

  /** Reset internal state between tests. Only call from test files. */
  export declare function __resetForTests(): void;
  ```
- **Semantics:**
  - Pre-conditions:
    - `upsertSubscription`: `data.userId` is a non-empty string; `data.status` is a valid `SubscriptionStatus`.
    - `getSubscriptionByUserId` / `getSubscriptionByStripeId`: argument is a non-empty string.
    - `markEventProcessed` / `isEventProcessed`: `stripeEventId` is a non-empty string.
  - Post-conditions:
    - `upsertSubscription`: if a row with `stripeSubscriptionId` already exists, it is updated in place; otherwise a new row is created. Returns the final persisted row.
    - `getSubscriptionByUserId`: returns the most recent subscription row for the user, or `null` if none exists.
    - `getSubscriptionByStripeId`: returns the row whose `stripeSubscriptionId` matches, or `null`.
    - `markEventProcessed`: subsequent `isEventProcessed(stripeEventId)` returns `true`.
    - `isEventProcessed`: returns `true` iff `markEventProcessed` was previously called with the same ID.
  - Invariants: idempotency markers are per-event-ID; marking event A does not affect event B.
- **Errors:** implementations may throw on unexpected internal failure; callers must handle.
- **Side effects:** mutates in-memory store (dev/test) or DB rows (future Postgres impl).
- **Not in contract:** internal storage format; row auto-generated `id`/`createdAt` strategy.

---

### session — getSessionUserId
- **Path:** `src/lib/auth/session.ts`
- **Signature:**
  ```ts
  export async function getSessionUserId(request: Request): Promise<string | null>;
  ```
- **Semantics:**
  - Pre-conditions: `request` is a valid WHATWG `Request` object.
  - Post-conditions: returns the authenticated user's UUID string if a valid session is present; otherwise returns `null`.
  - Invariants: never throws; on any error or missing session returns `null`.
- **Errors:** swallows internal errors and returns `null` (TODO — issue #2 will implement real logic).
- **Side effects:** none today (stub returns `null`).
- **Not in contract:** session cookie name, JWT format — deferred to issue #2.

---

### entitlements — isUserPremium
- **Path:** `src/lib/entitlements.ts`
- **Signature:**
  ```ts
  export async function isUserPremium(userId: string): Promise<boolean>;
  ```
- **Semantics:**
  - Pre-conditions: `userId` is a non-empty string (callers must validate; empty/undefined input resolves `false` or throws a clear validation error — the same branch is used consistently).
  - Post-conditions:
    - `status === 'active'` → `true`.
    - `status === 'past_due'` → `true` if `updatedAt + PAST_DUE_GRACE_DAYS > now`; else `false`.
    - `status === 'canceled'` → `true` if `currentPeriodEnd > now`; else `false`.
    - `status === 'trialing'` → `true`.
    - `status === 'none'` or row not found → `false`.
  - Invariants: reads only from `subscriptionsRepo`; never modifies state.
- **Errors:** if `subscriptionsRepo.getSubscriptionByUserId` rejects, resolves `false` (fail-closed — no unhandled rejection).
- **Side effects:** none.
- **Not in contract:** grace-period clock source (uses `Date.now()` unless fake timers injected in tests).

---

### stripe — createCheckoutSession
- **Path:** `src/lib/stripe.ts`
- **Signature:**
  ```ts
  export async function createCheckoutSession(params: {
    userId: string;
    customerId?: string | null;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  ```
- **Semantics:**
  - Pre-conditions: `STRIPE_SECRET_KEY` env var set; `priceId`, `successUrl`, `cancelUrl` are non-empty.
  - Post-conditions: returns `{ url }` which is the Stripe-hosted Checkout URL.
  - Invariants: does not persist any data locally.
- **Errors:** throws `StripeConfigError` (or a plain `Error`) if `STRIPE_SECRET_KEY` is missing; propagates Stripe SDK errors to the caller.
- **Side effects:** creates a Checkout Session via Stripe REST API.
- **Not in contract:** Stripe SDK version; lazy vs. eager client instantiation.

---

### stripe — createPortalSession
- **Path:** `src/lib/stripe.ts`
- **Signature:**
  ```ts
  export async function createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  ```
- **Semantics:**
  - Pre-conditions: `STRIPE_SECRET_KEY` set; `customerId` is a non-empty Stripe customer ID.
  - Post-conditions: returns `{ url }` which is the Stripe Customer Portal URL.
- **Errors:** throws if `STRIPE_SECRET_KEY` missing; propagates Stripe SDK errors.
- **Side effects:** creates a Portal Session via Stripe REST API.
- **Not in contract:** portal configuration IDs — resolved from Stripe dashboard.

---

### stripe — constructWebhookEvent
- **Path:** `src/lib/stripe.ts`
- **Signature:**
  ```ts
  export function constructWebhookEvent(
    rawBody: string,
    signature: string,
    secret: string
  ): Stripe.Event;
  ```
- **Semantics:**
  - Pre-conditions: `rawBody` is the unmodified request body string; `signature` is the `stripe-signature` header value; `secret` is `STRIPE_WEBHOOK_SECRET`.
  - Post-conditions: returns a verified `Stripe.Event` object on success.
- **Errors:** throws `Stripe.errors.StripeSignatureVerificationError` (from Stripe SDK) if the signature is invalid or the payload is tampered.
- **Side effects:** none.
- **Not in contract:** tolerance window — Stripe SDK default (~300 s).

---

### Route handler — POST /api/billing/checkout
- **Path:** `src/app/api/billing/checkout/route.ts`
- **Signature:**
  ```ts
  export async function POST(request: Request): Promise<Response>;
  ```
- **Semantics:**
  - Pre-conditions: none (route validates internally).
  - Post-conditions:
    - `200 { url: string }` — authenticated user; Stripe Checkout session URL returned.
    - `401 { error: 'unauthenticated' }` — `getSessionUserId` returns `null`.
    - `500 { error: string }` — Stripe call fails.
  - Invariants: `createCheckoutSession` is never called if userId is null.
- **Errors:** see post-conditions.
- **Side effects:** creates Stripe Checkout session; may upsert a subscription row.
- **Not in contract:** body parsing strategy; request body schema (currently no body expected).

---

### Route handler — POST /api/billing/portal
- **Path:** `src/app/api/billing/portal/route.ts`
- **Signature:**
  ```ts
  export async function POST(request: Request): Promise<Response>;
  ```
- **Semantics:**
  - Post-conditions:
    - `200 { url: string }` — authenticated user with a `stripeCustomerId` on their subscription row.
    - `401 { error: 'unauthenticated' }` — no session.
    - `400 { error: string }` — authenticated but no `stripeCustomerId` (never subscribed).
    - `500 { error: string }` — Stripe call fails.
  - Invariants: `createPortalSession` is never called without a valid `stripeCustomerId`.
- **Errors:** see post-conditions.
- **Side effects:** creates Stripe Customer Portal session.
- **Not in contract:** body schema.

---

### Route handler — POST /api/billing/webhook
- **Path:** `src/app/api/billing/webhook/route.ts`
- **Signature:**
  ```ts
  export const runtime = 'nodejs';
  export async function POST(request: Request): Promise<Response>;
  ```
- **Semantics:**
  - Pre-conditions: request carries a `stripe-signature` header; `STRIPE_WEBHOOK_SECRET` env var set.
  - Post-conditions:
    - `200 { received: true }` — valid signature, event processed (or already processed — idempotent).
    - `400 { error: string }` — invalid/missing signature.
  - Invariants:
    - Raw body is read with `await request.text()` before any parsing.
    - `isEventProcessed` is checked before any DB write; if `true`, skip upsert and return `200`.
    - Handled event types: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
    - Unknown event types are silently ignored and return `200`.
    - Stripe status values are mapped to local `SubscriptionStatus` before upsert.
- **Errors:** see post-conditions. Unhandled exceptions in the handler body must not bubble as unhandled rejections; catch and return `500`.
- **Side effects:** upserts subscription row; calls `markEventProcessed`.
- **Not in contract:** mapping from Stripe subscription status strings to `SubscriptionStatus` (implementation detail, but `checkout.session.completed` → `'active'`; `customer.subscription.deleted` → `'canceled'`).

---

### Route handler — GET /api/billing/subscription
- **Path:** `src/app/api/billing/subscription/route.ts`
- **Signature:**
  ```ts
  export async function GET(request: Request): Promise<Response>;
  ```
- **Semantics:**
  - Post-conditions:
    - `200 SubscriptionResponse` — authenticated user; subscription data (defaults to free-tier shape if no row).
    - `401 { error: 'unauthenticated' }` — no session.
  - Invariants: `getSubscriptionByUserId` is never called if userId is null.
- **Errors:** see post-conditions.
- **Side effects:** none (read-only).
- **Not in contract:** caching headers.

---

### Settings page — SettingsPage (client component)
- **Path:** `src/app/settings/page.tsx`
- **Signature:**
  ```ts
  'use client';
  export default function SettingsPage(): JSX.Element;
  ```
- **Semantics:**
  - Pre-conditions: renders in a browser environment (client component).
  - Post-conditions:
    - Fetches `GET /api/billing/subscription` on mount.
    - Free tier (`isPremium === false`): renders "Upgrade to premium" button; clicking it POSTs to `/api/billing/checkout` and redirects to returned `url`.
    - Premium tier (`isPremium === true`): renders plan status, `currentPeriodEnd`, and "Manage subscription" button; clicking it POSTs to `/api/billing/portal` and redirects to returned `url`.
    - Loading state: shown while fetch is in flight.
    - Error state: renders an actionable error message on fetch failure or non-2xx response; no crash.
  - Invariants: component never exposes raw error details to the DOM.
- **Errors:** surfaces actionable message to the user; never propagates unhandled errors.
- **Side effects:** `fetch` calls to billing API routes.
- **Not in contract:** exact button text (implementation choice, but tests will assert presence/absence of upgrade vs. manage controls).

---

## Data shapes

### SubscriptionResponse
```ts
// Returned by GET /api/billing/subscription
interface SubscriptionResponse {
  status: SubscriptionStatus;          // 'active' | 'past_due' | 'trialing' | 'canceled' | 'none'
  currentPeriodEnd: string | null;     // ISO-8601 date string, or null
  priceId: string | null;
  isPremium: boolean;                  // result of isUserPremium(userId) at request time
}
```
> When no subscription row exists, the route returns `{ status: 'none', currentPeriodEnd: null, priceId: null, isPremium: false }`.

### UpsertSubscriptionData
```ts
// Input to subscriptionsRepo.upsertSubscription — see repository interface above
```

### CheckoutSessionResponse
```ts
// Returned by POST /api/billing/checkout and POST /api/billing/portal
interface BillingRedirectResponse {
  url: string;
}
```

### ErrorResponse
```ts
interface ErrorResponse {
  error: string;
}
```

---

## Constants / config keys

- `PAST_DUE_GRACE_DAYS = 7` — exported from `src/lib/db/subscriptions.types.ts`; measured in days from `updatedAt`.
- `STRIPE_SECRET_KEY` — env var; required at runtime for all Stripe API calls.
- `STRIPE_WEBHOOK_SECRET` — env var; required by webhook signature verification.
- `STRIPE_PRICE_ID` — env var; premium monthly price ID passed to `createCheckoutSession`.
- `NEXT_PUBLIC_APP_URL` — env var; base URL for Stripe success/cancel redirect URLs.

---

## Resolved ambiguities

| # | Disagreement / gap | Resolution |
|---|---|---|
| 1 | plan.md says `isUserPremium` with `past_due` uses `updatedAt + 7d`; test-plan.md says "grace period" but uses `current_period_end: <future>` in the test fixture | **Resolution:** `past_due` grace period is measured from `updatedAt` (per plan.md). The test fixture for `past_due` must set `updatedAt` within the last 7 days, not just `currentPeriodEnd`. Testers: use `updatedAt: new Date(Date.now() - 1 * 86400000)` (1 day ago) for the passing case and `updatedAt: new Date(Date.now() - 8 * 86400000)` (8 days ago) for the expired case. |
| 2 | test-plan.md refers to `plan: "free"` and `plan: "premium"` in `SubscriptionResponse`; plan.md does not mention a `plan` field | **Resolution:** `SubscriptionResponse` does NOT include a `plan` field. The `isPremium` boolean (from plan.md step 11) is the authoritative premium indicator. Testers must assert `isPremium: true/false` rather than `plan: "premium"/"free"`. |
| 3 | `isUserPremium` behavior on DB failure — test-plan.md says "resolve `false` or reject with typed error, pick one"; plan.md is silent | **Resolution:** fail-closed — always resolve `false` on DB error; never propagate an unhandled rejection. |
| 4 | `isUserPremium` behavior on `trialing` status — test-plan.md does not test it; plan.md lists `trialing` in the union but does not map it | **Resolution:** `status === 'trialing'` → `true` (trialing users have active access). Testers may optionally cover this case. |
| 5 | `customer.subscription.deleted` terminal status — test-plan.md says "the terminal status the implementation defines (`canceled` or `none`)" | **Resolution:** `customer.subscription.deleted` maps to local status `'canceled'` (not `'none'`); `currentPeriodEnd` is preserved so period-end access semantics apply. `'none'` is only the default for a user who has never had a subscription. |
