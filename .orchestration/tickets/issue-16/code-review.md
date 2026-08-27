# Code Review — issue-16

Reviewer model family: **Claude (claude-opus-4.7)** — deliberately different from
the coder's model family (`gpt-5.3-codex`, OpenAI) so the adversarial pass is
independent.

Scope reviewed: `git diff main...HEAD -- src/ .env.example README.md package.json`
against `ticket.md` and `contract.md`. `plan.md`, `solution.md`, `test-plan.md`,
`brainstorm.md`, worker envelopes were not read.

---

## Blockers

None that are strictly code bugs relative to the locked contract. See H1 below —
it is a real acceptance-criterion violation but the fix conflicts with a
contract invariant, so the orchestrator/product owner needs to decide whether
to relax the contract or accept an AC gap.

---

## High-severity findings

### H1 — Quota is consumed for downloads that fail at the upstream fetch (AC8 violation)

**File:** `src/app/api/downloads/[id]/route.ts:57-79`

**Problem:** `checkAndIncrementQuota` is called (incrementing the DB counter)
*before* `fetch(resource.file_url)`. If the upstream fetch returns non-ok or
has no body, the route responds `502` — but the user's monthly quota has
already been decremented for a download they never received.

Reproduction path:
1. Free user, `used = 10`, `limit = 50`.
2. `GET /api/downloads/<id>` → auth ok, resource found, `checkAndIncrementQuota`
   upserts → `count = 11`.
3. `fetch(resource.file_url)` returns 500 / times out / has no body.
4. Route returns `502` to the client. DB still shows `count = 11`.

`ticket.md` AC8: *"A download attempt that fails (network error, file missing,
unauthorized) does not decrement the user's remaining allowance. Only successful
deliveries count."* — "network error" and "file missing" match this exact
failure mode.

**Evidence:** Direct reading of the route handler; the increment happens in the
`try { await checkAndIncrementQuota(...) }` block, and only after that block
completes does the code do `fetch(resource.file_url)` and check
`upstream.ok || upstream.body`. No compensating decrement exists.

**Tension with contract:** `contract.md` says quota is called "before any file
stream begins" and locks a single atomic upsert. A conservative fix is to run
a HEAD probe on `resource.file_url` (or otherwise validate the resource is
retrievable) before calling `checkAndIncrementQuota`; a more invasive fix is
to compensate with a decrement on 502. Either changes the contract's
sequencing invariant slightly and should be routed through the contract owner.

**Suggested fix (do not implement here):** Move `checkAndIncrementQuota` to
run only after upstream retrievability is confirmed, or issue a
compensating `count = count - 1` update when the upstream path returns 502.
Flag to the contract owner that the current sequencing makes AC8 unreachable
for the 502 path.

---

## Medium-severity findings

### M1 — `getSession()` stub throws instead of returning `null`, so 401 path is unreachable at runtime

**File:** `src/lib/auth.ts:17-19` and its call sites at
`src/app/api/downloads/[id]/route.ts:48` and
`src/app/api/me/download-quota/route.ts:7`.

**Problem:** The `getSession` stub unconditionally throws
`NOT_IMPLEMENTED_ERROR`. Both routes call it as
`const session = await getSession(request); if (!session) return 401;` with no
`try/catch`. Any real HTTP request today therefore returns a `500` (with the
stub message potentially leaking into logs/response), not the `401` the
contract prescribes for unauthenticated access.

I am flagging this as medium (not high) because:
- The stub is scoped as a prerequisite (#2) and the routes' tests mock
  `getSession`, so the test suite doesn't hit this path.
- Nothing in production is calling these routes yet.
- However, the stub's message is user-facing on error and the routes will
  crash on the very first real invocation — worth documenting as a "known
  broken until #2 lands" or catching it and returning 401 defensively.

**Evidence:** Read `src/lib/auth.ts`; verified route handlers have no try/catch
around `getSession`.

**Suggested fix:** Either (a) make the stub return `null` (matching the
"unauthenticated" branch) so the routes degrade to 401 in dev, or (b) add a
top-level try/catch in each route that maps `NOT_IMPLEMENTED_ERROR` to 503.
Do not implement here.

---

### M2 — Ticket-vs-contract off-by-one at the limit boundary (not a code bug against the contract, but a spec discrepancy the reviewer should surface)

**File:** `src/lib/download-quota.ts:97-99` (the `>= LIMIT` check).

**Problem:** `ticket.md` AC2 says *"A free user whose current-month download
count is strictly less than the allowance can complete a download successfully,
and the count increments by exactly one on success."* With `LIMIT = 50`,
that means a pre-increment count of `49` (< 50) must succeed — leaving
post-increment count = `50`. The code throws when the *post-increment* value
`>= 50`, so the 50th download attempt (pre = 49) is blocked and the user
effectively gets 49 downloads instead of 50.

The contract explicitly locks this behavior (`If the resulting count >=
LIMIT, throws … (after the increment — the count is still recorded)`), and
the tests cover it as the "boundary" case. So the **code correctly
implements the contract**, but the contract and ticket disagree by one.

**Evidence:** Cross-read of ticket.md AC2, contract.md
`checkAndIncrementQuota` post-conditions, and
`src/lib/__tests__/download-quota.test.ts` boundary test.

**Suggested action (not a code change):** Route to the contract owner: either
change the check to `> LIMIT` (matching AC2 verbatim) or update AC2 to say
"strictly less than or equal to the allowance minus one". This is a product
decision.

---

## Low-severity findings

### L1 — Client-side upgrade URL is hard-coded and drifts from the server-side one

**File:** `src/components/DownloadQuotaIndicator.tsx:5` (`const UPGRADE_URL = "/upgrade"`)
vs. `src/lib/download-quota.ts:19`
(`const DOWNLOAD_UPGRADE_URL = process.env.DOWNLOAD_UPGRADE_URL || "/upgrade"`).

**Problem:** The 402 response body includes an operator-configurable
`upgrade_url` from env, but the standalone indicator component ignores env and
uses a hard-coded `/upgrade`. If an operator ever sets
`DOWNLOAD_UPGRADE_URL`, the indicator's CTA will point somewhere different
from the download-endpoint's CTA. Not a bug today (both default to `/upgrade`),
but a future footgun.

**Suggested fix:** Either drop the env var entirely, or plumb the same value
into the client (via a public env or by returning `upgrade_url` in the
`QuotaStatus` free variant). No change here.

---

### L2 — `.env.example` uncomments `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT` while `DATABASE_URL` is left commented

**File:** `.env.example:11-12`.

Cosmetic. Copying the example to `.env` now sets the limit to `50` even
though that already is the default. Harmless but inconsistent with the rest
of the file's convention of shipping placeholders commented out.

---

## Positive observations (worth keeping)

- The `checkAndIncrementQuota` upsert genuinely is a single-statement
  `INSERT … ON CONFLICT … DO UPDATE … RETURNING count`, so the read-modify-
  write on the counter is atomic at the DB level — no application-side race
  window between read and write. The concurrency test in
  `src/lib/__tests__/download-quota.test.ts` targets this correctly.
- The `402` response body precisely matches `QuotaExceededBody` (`code`,
  `limit`, `reset_at`, `upgrade_url`) per contract.
- Owner-bypass and premium-bypass short-circuit before touching the DB, in
  the contract-mandated order (owner before premium).
- `reset_at` correctly rolls over December → January in the year-boundary
  case (verified by test) and the ISO format strips the `.000` millis to
  match `YYYY-MM-DDTHH:MM:SSZ`.
- The `DownloadQuotaIndicator` renders `null` on 401 / fetch failure per
  contract, uses a numeric text count (not color-only), gives the upgrade CTA
  an `aria-label`, and cancels the pending fetch on unmount via the
  `active` flag. Solid on the accessibility/edge-case requirements the
  contract calls out.

---

## Notes

- **Reviewer model family:** Claude (`claude-opus-4.7`), independent from the
  coder's `gpt-5.3-codex` (OpenAI family), per the dispatch instruction.
- **Scope discipline:** did not read `plan.md`, `solution.md`,
  `test-plan.md`, `brainstorm.md`, or worker envelopes. Read only
  `ticket.md`, `contract.md`, `verify.md`, and the diff / touched source +
  test files.
- **verify.md warnings:** none of W1–W5 rise to real code issues; they are
  documentation/impact-tracking hygiene and do not affect shipping.
- H1 is the single finding I would block on. M1 is a foreseeable footgun the
  moment a real request hits the route. M2 is a spec-vs-code discrepancy
  that the code owner cannot fix alone.
