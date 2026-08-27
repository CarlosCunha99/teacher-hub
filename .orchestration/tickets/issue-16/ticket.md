# [Phase 2] Enforce monthly free-tier download limits

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/16

> ⚠️ This is a **Phase 2** ticket. Multiple foundational MVP features (auth, PostgreSQL
> schema #3, download endpoint + counter #11) and the sibling Phase 2 feature
> (premium membership #15) must land first. This ticket documents the product
> requirements so they are ready to plan once prerequisites are in place; it is not
> ready to implement today.

## Problem

Free-tier teachers on Teacher Hub currently have unlimited downloads of shared
classroom resources. As Teacher Hub introduces a paid premium membership (#15), the
free tier needs a monthly cap on downloads so that heavy users are guided toward
upgrading and the two tiers are meaningfully differentiated. Without an enforced
limit, there is no product-level incentive to purchase premium, and Teacher Hub
cannot monetize its most active users.

The feature must also give free users clear, ongoing visibility into how much of
their monthly allowance they have consumed, so hitting the cap is never a surprise
and the upgrade prompt lands at a moment of genuine intent (a user actively trying
to download something they cannot).

**Confidence:** ✅ Verified — problem framing matches the original GitHub issue #16
body and the sibling premium ticket #15.

## Impact

- **Users affected:** All free-tier teachers who download resources. Premium
  subscribers (#15) and resource owners downloading their own uploads are explicitly
  excluded. (⚠️ Inferred size — no analytics data available in repo; the platform is
  pre-launch.)
- **Severity:** medium — this is a monetization/roadmap feature, not a bug or
  blocker. It gates revenue from Phase 2, not core teacher workflows.
- **Frequency:** always — every download attempt by a free user must be checked
  against the limit.

**Confidence:** ⚠️ Inferred — severity/frequency derived from the issue's labels
(`nice-to-have`, `roadmap`, `billing`) and the fact that the enforcement runs on
every download.

## Success criteria

- A free user can download resources up to a configurable monthly allowance without
  friction, and sees a running count of remaining downloads throughout the month.
- Once a free user reaches the allowance in a given month, further download attempts
  are prevented and the user is presented with a clear path to upgrade to premium
  (#15).
- Resource owners are never blocked from downloading their own resources, regardless
  of monthly usage.
- The allowance automatically becomes available again at the start of each new
  month, without manual intervention or a scheduled job the operator has to
  babysit.
- The monthly allowance value can be changed by an operator (config/env-level, not
  per-user) without a code change to the enforcement logic.

**Confidence:** ✅ Verified against issue #16 acceptance criteria; the "clear upgrade
path" success criterion is ⚠️ Inferred pending resolution of ambiguity **A2** below.

## Acceptance criteria

- [ ] **AC1 — Configurable allowance.** The monthly free-tier download allowance is
      read from a single configuration source (env var or config file), not
      hard-coded in call sites. Changing the value and restarting the service
      applies the new limit to subsequent downloads.
- [ ] **AC2 — Enforcement below the limit.** A free user whose current-month
      download count is strictly less than the allowance can complete a download
      successfully, and the count increments by exactly one on success.
- [ ] **AC3 — Enforcement at/above the limit.** A free user whose current-month
      download count equals or exceeds the allowance is prevented from completing
      a download of a resource they do not own. The response communicates that
      the monthly limit has been reached and references the upgrade path to
      premium.
      _(❓ Unverified: exact response semantics — hard block with error vs.
      soft-gate with upgrade CTA — see Ambiguity **A2**.)_
- [ ] **AC4 — Owner exemption.** A user downloading a resource they own is never
      blocked by the limit, and (per rule to be documented) that download does not
      count against the owner's monthly allowance. The exemption rule is written
      into user-facing help or in-product copy so users understand why owner
      downloads are free.
- [ ] **AC5 — Automatic monthly reset.** At the start of each new month, every
      free user's effective remaining allowance returns to the full configured
      value without any manual admin action. A user who was blocked in month N
      can download again in month N+1.
      _(❓ Unverified: whether "month" is a fixed calendar month (UTC) or the
      user's subscription-anniversary month — see Ambiguity **A3**.)_
- [ ] **AC6 — Remaining-downloads UI.** Free users can see, in the app, how many
      downloads they have remaining in the current month. This indicator updates
      after a successful download and is visible in a location the user
      encounters during normal browsing (e.g., account/header area or resource
      pages).
- [ ] **AC7 — Premium bypass.** A premium user (per #15) is never blocked by the
      free-tier limit, and the remaining-downloads indicator either does not
      apply to them or clearly indicates unlimited/premium status.
- [ ] **AC8 — Failed downloads do not count.** A download attempt that fails
      (network error, file missing, unauthorized) does not decrement the user's
      remaining allowance. Only successful deliveries count. _(Aligns with #11
      AC "Download counting avoids duplicate increments from failed requests.")_
- [ ] **AC9 — Rule documentation.** The owner-exemption rule and the definition
      of "month" are documented in a place the product/support team can point
      users to (README, docs page, or in-product help copy).

**Confidence:** ✅ AC1, AC2, AC4, AC6, AC7, AC8, AC9 verified against issue #16 and
issue #11 language. ❓ AC3, AC5 depend on unresolved ambiguities.

## Edge cases & non-functional

- **Concurrent downloads.** If a free user has 1 download remaining and fires two
  download requests concurrently, at most one should succeed against the free
  allowance; the other must be blocked. The system must not permit the counter to
  overshoot the configured limit via race conditions. (⚠️ Inferred — not stated in
  the issue but a standard requirement for any quota counter.)
- **Clock boundaries.** A download in progress across the month-rollover boundary
  should count in the month the download attempt was authorized (checked), not the
  month it completed streaming. (⚠️ Inferred.)
- **Timezone.** "Month" must have a single well-defined timezone (see A3). Users
  in different regions must not be able to "unlock" a fresh allowance by manipulating
  local time. (⚠️ Inferred.)
- **Config changes mid-month.** If the allowance is raised mid-month, users whose
  usage is between the old and new limit should regain the ability to download; if
  it is lowered, users already over the new limit are blocked for the remainder of
  the month (they are not retroactively penalized beyond being blocked). (⚠️
  Inferred — surface for reviewer.)
- **Anonymous / unauthenticated download attempts.** Out of scope for this ticket —
  authentication (#2) and download endpoint (#11) own that behavior. This ticket
  assumes the caller is an authenticated user with a known tier.
- **Backward compatibility / migration.** Before this ticket ships, all users have
  had unlimited downloads. On rollout, in-flight users should not be retroactively
  blocked for downloads made before enforcement went live; enforcement begins from
  a defined cutover. (⚠️ Inferred — surface for reviewer.)
- **Observability.** Operators should be able to see, in logs or metrics, when a
  user is blocked by the limit, so support can help users and product can measure
  conversion pressure. (⚠️ Inferred — standard billing-feature requirement.)
- **Accessibility of the "remaining downloads" UI.** The indicator must be
  perceivable to screen readers and not conveyed by color alone (standard a11y).
  (⚠️ Inferred.)
- **Security.** The enforcement decision must be made server-side. A client that
  hides the indicator or spoofs a "premium" flag must not be able to bypass the
  cap. (⚠️ Inferred — standard for entitlement checks.)

## Out of scope

- **Building the download endpoint or the download counter** — owned by issue #11.
  This ticket _consumes_ the endpoint and counter; it does not create them.
- **Building the premium subscription model, billing, upgrade flow, or entitlement
  service** — owned by issue #15. This ticket assumes a way to know whether a
  given user is free or premium.
- **Building the PostgreSQL schema, user model, or resource-owner relationship** —
  owned by issue #3 (schema) and predecessor auth/upload issues.
- **Per-user custom allowances, promo/gift downloads, referral bonuses, or usage
  rollover** — not requested; explicitly deferred.
- **Alternative limit dimensions** (e.g., MB downloaded, downloads per resource,
  per-subject caps) — not requested; explicitly deferred.
- **Admin UI to view/reset a user's counter** — not requested in this ticket; if
  support needs it, file separately.
- **Email/notification when the user is approaching or has hit the limit** — not
  requested; the in-app indicator (AC6) is the only surface committed.
- **Analytics dashboards on conversion driven by the limit** — separate concern.

## References

- Original ticket: https://github.com/CarlosCunha99/teacher-hub/issues/16
- Prerequisite — download endpoint and counter: https://github.com/CarlosCunha99/teacher-hub/issues/11
- Sibling Phase 2 feature — premium membership (the upgrade path): https://github.com/CarlosCunha99/teacher-hub/issues/15
- Prerequisite — PostgreSQL schema: https://github.com/CarlosCunha99/teacher-hub/issues/3
- Repo state — Next.js skeleton only (no auth, no DB, no download endpoint yet):
  `README.md`, `package.json`, `src/` (only `app/api/health/route.ts`, `lib/health.ts`,
  and skeleton pages/tests present).

## Raw context used

- `.orchestration/tickets/issue-16/raw-context.md` — contains only intake-template
  placeholder text; no additional facts beyond the issue body.
- Verified via `gh issue view` for issues #16, #11, #15, #3.
- Verified against local repo tree (`src/` contains only the Next.js skeleton — no
  download, auth, DB, or entitlement code exists yet).

## Enrichment notes

- The repo is a **Next.js skeleton only**. There is no code today that implements
  users, resources, downloads, tiers, or persistence. Multiple prerequisite tickets
  (#3, #11, plus auth, plus #15) must land before this ticket is implementable.
  The enriched requirements below are written as product acceptance criteria so
  they can be planned against once those foundations exist.
- The original ticket's "counter resets automatically each new billing month" line
  is the source of Ambiguity **A3**: "billing month" strongly implies subscription-
  anniversary semantics, but the dispatch context and the label "monthly free-tier"
  suggest calendar month. These are materially different products (per-user rolling
  window vs. global reset), so the reading affects AC5 wording directly.
- **Ambiguity A1 (default allowance value):**
  Proposed reading: default allowance is **50 downloads per month**, configurable
  via env var. Alternatives rejected: 10 (too punitive for teachers who legitimately
  browse many resources per week), 100 (weak differentiation vs. premium),
  hard-coded (violates AC1). Blocking: **no** — a placeholder default can be
  chosen; the number can be tuned after launch. Recommend confirming with product
  owner before planning.
- **Ambiguity A2 (behavior at the limit — hard block vs. soft-gate):**
  Proposed reading: **soft-gate** — server returns a specific "limit reached"
  response (e.g., HTTP 402 Payment Required or 403 with an upgrade code) and the
  UI renders an upgrade CTA linking to the premium purchase flow (#15), rather than
  a generic error. Alternative rejected: silent hard-block with generic error
  (fails the product goal of driving conversions). Blocking: **yes** — this
  determines the exact assertion in AC3 and the copy/UX for AC6.
- **Ambiguity A3 (calendar month vs. subscription-anniversary month):**
  Proposed reading: **calendar month, UTC** — counter resets at 00:00 UTC on the
  1st of each month for every free user, globally. Alternative rejected:
  per-user rolling 30-day window keyed to signup date (adds significant
  implementation complexity, harder to communicate to users, and free users have
  no "subscription" to anchor against). Blocking: **yes** — this determines AC5,
  the counter storage design, and how the reset happens.
- **Ambiguity A4 (owner-exemption accounting):**
  Proposed reading: owner downloads bypass the limit check entirely and **do not
  count** toward the owner's monthly allowance (as if the download never happened
  from an entitlement standpoint). The download-count metric on the resource
  itself (per #11) is a separate concern and outside this ticket. Alternative
  rejected: counting owner downloads (would make owners' allowances inconsistent
  with the rule, and is user-hostile). Blocking: **no** — recommend confirming
  with product owner but the proposed reading is the natural interpretation.

## Needs clarification

The following items are ❓ Unverified or ⚠️ Inferred and should be resolved by the
product owner before brainstorming. The orchestrator should batch these into the
gate-1 review question set:

1. **A1 — Default allowance value.** Confirm the default (proposed: **50/month**).
   _Non-blocking; can be a placeholder._
2. **A2 — Behavior when limit is reached.** Confirm **soft-gate with upgrade CTA**
   (proposed) vs. hard block with generic error. **Blocking** — directly shapes
   AC3 and the UI copy in AC6.
3. **A3 — Definition of "month".** Confirm **calendar month, UTC** (proposed) vs.
   per-user 30-day rolling window keyed to signup/subscription date. **Blocking** —
   directly shapes AC5 and counter storage semantics.
4. **A4 — Owner-download accounting.** Confirm owner downloads **do not count**
   against the owner's own allowance (proposed). _Non-blocking but should be
   documented explicitly per AC9._
5. **UI surface for remaining downloads.** Confirm the intended location (account
   menu / global header / resource card / download button tooltip). Not blocking
   for product ACs but useful before brainstorm.

Because ambiguities **A2** and **A3** are blocking, `confidence` in the worker
envelope is **medium**, not high. The orchestrator should pause at gate 1 to
resolve them before moving to brainstorm.

---
## Original

**Title:** [Phase 2] Enforce monthly free-tier download limits
**Author:** CarlosCunha99
**Labels:** enhancement, roadmap, backend, billing, nice-to-have
**URL:** https://github.com/CarlosCunha99/teacher-hub/issues/16

### User Story
As a free teacher user, I want a monthly download limit with clear usage feedback, so that I know when I need premium access.

### Acceptance Criteria
- [ ] Monthly download allowance is configurable.
- [ ] Free users cannot download beyond monthly limit.
- [ ] Usage counter resets automatically each new billing month.
- [ ] UI shows remaining downloads for current month.
- [ ] Limit enforcement excludes resource owners downloading their own files (rule documented).
