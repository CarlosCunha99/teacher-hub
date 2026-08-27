# [Phase 2] Implement premium membership to unlock higher download limits

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/15

> Confidence legend: ✅ Verified (repo evidence cited) · ⚠️ Inferred (reasoning, no direct evidence) · ❓ Unverified (no repo evidence; needs human confirmation)

## Problem

*(❓ Unverified — no user, download, or billing code exists in the repo yet; problem framing is derived from the ticket text and sibling roadmap issues #16/#11, not from implemented behavior.)*

Teachers use Teacher Hub to download classroom resources shared by others. Phase 2 introduces a monthly free-tier download cap (tracked separately in issue #16). Once a teacher hits that cap, they are blocked from downloading more resources until the next billing month — even if they need materials immediately. There is currently no way for a motivated teacher to pay to remove that friction.

This ticket adds a **premium membership tier** so teachers who reach the free limit can upgrade and continue downloading (with higher or unlimited limits), plus the associated perks the ticket lists (extended storage, exclusive features). The goal is to give power users an escape hatch from the free-tier cap and to establish the platform's first paid revenue path.

**Ambiguity:** The ticket also mentions "extended storage" and "exclusive features" as premium perks. The title and user story scope this ticket to **download limits** only. See Enrichment notes.

## Impact

- Users affected: ⚠️ Inferred — free-tier teachers who hit the monthly download cap (issue #16). Volume is unknown; the platform is pre-launch with no users, database, or auth yet (✅ repo skeleton confirms: only `GET /api/health`, no user model — README.md, src/lib/health.ts).
- Severity: low *(⚠️ Inferred — labeled `nice-to-have` and `roadmap` on the GH issue; not a blocker for MVP.)*
- Frequency: edge-case *(⚠️ Inferred — only affects users who both hit the free cap and choose to pay; depends on adoption.)*

## Success criteria

*(❓ Unverified — targets below are proposed, not sourced from any product doc. Confirm before planning.)*

- A teacher who has reached the free-tier monthly download limit can upgrade to premium and immediately resume downloading resources.
- A premium teacher's download entitlement is higher than (or removes) the free-tier cap defined by issue #16.
- A teacher can cancel/downgrade and is returned to free-tier behavior at the correct time (immediately vs. end of paid period — see Ambiguity).
- A teacher can see their current subscription status (free vs. premium) in account settings.
- Billing or entitlement failures never silently grant or revoke access; the user sees an actionable message.

## Acceptance criteria

*(Carried from the GH issue, kept testable. Several depend on unresolved blocking ambiguities — see "Needs clarification".)*

- [ ] A premium subscription entity exists and is queryable via the API, associating a user with a subscription state (e.g. free / active / past_due / canceled). *(❓ depends on data model from issue #3 and auth from issue #2, neither implemented.)*
- [ ] A teacher with an active premium subscription is not blocked by the free-tier download limit and can download beyond it.
- [ ] Canceling or downgrading reverts the teacher to free-tier enforcement, and the timing of that reversion is defined and observable.
- [ ] The teacher's current subscription status is displayed in account settings.
- [ ] Billing failures (e.g. failed payment, provider timeout, webhook loss) leave the account in a defined, recoverable state and surface a clear, actionable message to the user; entitlement is neither wrongly granted nor wrongly revoked.

## Edge cases & non-functional

- Billing failure mid-subscription (declined renewal): define grace period vs. immediate downgrade. *(❓ Unverified)*
- Concurrent access during a subscription state change (e.g. a download request in flight while a cancel/upgrade is processing). *(❓ Unverified)*
- Graceful degradation when the billing/payment provider is unavailable (reads of entitlement should not hard-fail all downloads). *(❓ Unverified)*
- Downgrade when the user's existing usage already exceeds the free cap for the current month — define whether they are blocked immediately or allowed to finish the month. *(❓ Unverified — blocking, see below.)*
- Idempotency of billing provider webhooks (avoid double-applying subscription events). *(⚠️ Inferred — standard requirement for any webhook-driven billing.)*
- Security: entitlement checks must be server-side; a client must not be able to self-report premium status. *(⚠️ Inferred — standard.)*
- Owners downloading their own resources are excluded from limit enforcement per issue #16; premium logic must not conflict with that rule. *(✅ rule stated in issue #16.)*

## Out of scope

- Enforcing the free-tier monthly download limit itself — owned by issue #16.
- The download endpoint and download-count tracking — owned by issue #11.
- The PostgreSQL schema and data-access conventions — owned by issue #3.
- Authentication / session management — owned by issue #2.
- "Extended storage" and "exclusive features" perks (mentioned in the issue body) unless product confirms they belong here — recommend filing separately. *(See Ambiguity.)*

## References

- Original ticket: https://github.com/CarlosCunha99/teacher-hub/issues/15
- Related (dependency): issue #16 — [Phase 2] Enforce monthly free-tier download limits
- Related (dependency): issue #11 — [MVP] Add resource download endpoint and download count tracking
- Related (dependency): issue #3 — [MVP] Design PostgreSQL schema for users, resources, tags, boards, and interactions
- Related (dependency): issue #2 — [MVP] Implement social authentication and session management
- README.md (tech stack, current skeleton state)
- src/lib/health.ts, src/app/page.tsx (confirm pre-database skeleton)

## Raw context used

- `raw-context.md` — no additional context provided (template only, empty body).

## Enrichment notes

- The codebase is a bare Next.js skeleton: only a health endpoint and a one-line home page exist (✅ src/app/page.tsx, src/lib/health.ts, README.md). There is **no** user model, no database, no auth, and no billing — so nearly every requirement here is ❓ Unverified against code and depends on unimplemented sibling issues (#2, #3, #11, #16). This is expected for an early-stage roadmap ticket.
- **Ambiguity (scope of perks):** The issue body lists "extended storage" and "exclusive features" alongside higher download limits, but the title and user story scope only download limits. Proposed reading: this ticket delivers **download-limit premium behavior + subscription status + billing failure handling**; storage/exclusive features are filed separately. Alternative rejected: bundling all perks into one ticket (too broad, unmeasurable). blocking: no
- **Ambiguity (payment provider):** No payment/billing provider is named anywhere in the repo or context. Proposed reading: a third-party provider (e.g. Stripe) will be integrated. This determines what "billing failures handled gracefully" concretely asserts. blocking: yes
- **Ambiguity (premium entitlement level):** "Higher download limits" is unquantified — premium could mean a larger monthly number or unlimited. This changes the pass/fail assertion of the "bypass free-tier limits" criterion. blocking: yes
- **Ambiguity (downgrade/cancel timing):** "Revert to free-tier correctly" is undefined — revert immediately on cancel, or at end of the paid period? And what happens when current-month usage already exceeds the free cap at downgrade time? blocking: yes
- **Ambiguity (pricing model):** Monthly vs. annual, price points, trials, and proration are unspecified. These may be product decisions outside engineering scope, but they affect acceptance criteria for renewal/proration. blocking: no

## Needs clarification

The following sections are ⚠️ Inferred or ❓ Unverified and should be confirmed by the user **before** brainstorming/planning:

1. **Problem / Impact / Success criteria** — ❓/⚠️: no user, download, or billing behavior exists in code; all framing is derived from the ticket and sibling issues.
2. **Payment provider** — ❓ blocking: which billing provider (Stripe or other)? Determines the graceful-failure acceptance criterion.
3. **Premium entitlement level** — ❓ blocking: is premium a higher fixed monthly limit or unlimited downloads?
4. **Downgrade/cancel timing** — ❓ blocking: immediate vs. end-of-period reversion, and handling of over-cap usage at downgrade.
5. **Scope of "extended storage" / "exclusive features"** — ⚠️ non-blocking: in scope here or filed separately?
6. **Dependency sequencing** — ⚠️: this ticket cannot be fully verified until #2 (auth), #3 (schema), #11 (download endpoint), and #16 (free-tier limits) land.

**Recommendation to orchestrator:** Ask the user questions 2, 3, and 4 (blocking) before proceeding to brainstorm. Do not present the entitlement level, provider, or downgrade behavior as decided.

---
## Original

# [Phase 2] Implement premium membership to unlock higher download limits

**Ticket-ID:** issue-15
**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/15
**Labels:** enhancement, roadmap, frontend, backend, billing, nice-to-have
**Author:** CarlosCunha99

---

## User Story

As a teacher, I want a premium plan, so that I can download more resources when the free limit is reached.

## Acceptance Criteria

- [ ] Premium subscription model exists in database and API.
- [ ] Upgraded users bypass free-tier download limits.
- [ ] Downgrade/cancel flows revert user to free-tier behavior correctly.
- [ ] Subscription status is visible in account settings.
- [ ] Billing and entitlement failures are handled gracefully.

## Context

This is a Phase 2 roadmap item. The platform is a Next.js teacher resource-sharing app in early stages. There is currently:
- A health endpoint (`GET /api/health`)
- No database, no user model, no billing infrastructure yet

Phase 2 introduces a premium membership tier with:
- Higher download limits (vs. free tier)
- Extended storage
- Exclusive features

The implementation must coordinate with billing and subscription infrastructure.

## Edge Cases (to be detailed in enrichment)

- Billing failures mid-subscription
- Concurrent access during subscription state changes
- Graceful degradation when billing service is unavailable
- Downgrade behavior when free tier limits are exceeded by existing downloads

---
## Autonomous decisions (gate 1)

User was unavailable; proceeding with these defaults (will be visible in PR for review):

1. **Payment provider**: Stripe — industry standard, best SDK/webhook support.
2. **Premium entitlement**: Unlimited downloads for premium subscribers (simpler enforcement than a higher fixed cap; can be revisited with tiered limits later).
3. **Downgrade/cancel timing**: Premium access continues until end of the current paid period; free-tier download limit is enforced from the next billing cycle. If usage at downgrade already exceeds the free cap, the user sees a warning but is not blocked mid-period.
4. **Scope**: "Extended storage" and "exclusive features" are out of scope for this ticket; filed as follow-up concerns.
