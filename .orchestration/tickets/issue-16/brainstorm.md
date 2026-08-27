# Brainstorm — issue-16

_This brainstorm was conducted in autopilot mode (developer unavailable). The orchestrator adopted both roles to converge on a technical direction. The enriched ticket.md and prerequisite-chain analysis (issues #3, #11, #15) were the primary inputs._

---

### 2026-08-27 21:59 — dev (autopilot)

The ticket is a Phase 2 billing gate: enforce a monthly download cap on free-tier users, soft-gate at the limit with an upgrade CTA, auto-reset on calendar-month UTC, owner downloads exempt. The codebase is a Next.js skeleton — no auth, no DB, no download endpoint yet.

The two real design questions are:
1. Where and how do we store the per-user monthly download counter?
2. How does enforcement integrate with the download endpoint (issue #11)?

My instinct is a lazy-reset model: a `monthly_download_counts` table keyed by `(user_id, year, month)`. At download time, we look for a row matching the current UTC year+month. If there's no row (or a row from a previous month), that is effectively zero remaining. We increment atomically with a conditional check. No scheduled reset job needed — the check itself handles the reset by targeting the current year+month.

### 2026-08-27 22:00 — agent

That lazy-reset pattern eliminates the scheduled-job complexity and guarantees that the "is it the current month?" question is answered at query time without state maintenance. The risk is the concurrent-request edge case: two download requests arriving simultaneously for a user at exactly the monthly limit. An atomic `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count` in the same transaction as the limit check handles that at the DB level. Does the proposed download endpoint (issue #11) follow a transactional pattern you can hook into, or does it stream directly?

### 2026-08-27 22:01 — dev (autopilot)

Issue #11 is not yet implemented, so we have full design latitude. The download handler will be a Next.js API route. The limit check needs to be a synchronous DB call before the file stream begins — so the pattern is: authenticate → check tier → if free-tier, run `check_and_increment_download_count(user_id, year, month, limit)` as an atomic DB operation → if result > limit, return 402 → else stream file. Rollback on stream error (decrement the counter).

### 2026-08-27 22:02 — agent

That flow is clean. One thing to probe: the rollback on stream failure. A file stream error mid-transfer is hard to roll back atomically because the HTTP response headers have already been sent. The simpler contract: count increments when the download is authorized (before stream), and a failed stream is not decremented. The counter represents "download attempts authorized" not "bytes successfully delivered." The enricher's AC8 ("failed downloads do not count") applies to the authorization check failing — not to stream errors after authorization succeeds. Worth documenting that nuance in AC9.

### 2026-08-27 22:03 — dev (autopilot)

Agreed. The authorization window is the gate — once authorized, it counts, regardless of whether the stream completes. This is consistent with how most quota systems work (the unit is "download authorized," not "download confirmed received"). I'll make that explicit in solution.md.

For the UI side: a server-side `/api/me/download-quota` endpoint returning `{ used, limit, reset_at }` feeds a lightweight `DownloadQuotaIndicator` React component in the account/nav area. Premium users see "Unlimited" or the component is hidden. The indicator calls on page load (not per-download), so it's not a hot path.

### 2026-08-27 22:04 — agent

Makes sense. For the 402 response shape: `{ "code": "DOWNLOAD_LIMIT_EXCEEDED", "limit": 50, "reset_at": "2026-09-01T00:00:00Z", "upgrade_url": "/premium" }` gives the frontend everything it needs to render a contextual upgrade CTA. The `reset_at` timestamp lets the UI show "limit resets in X days" without the client computing it.

### 2026-08-27 22:05 — dev (autopilot)

Good. Let's lock that in. The full direction: lazy-reset counter table, atomic DB check-and-increment, 402 with structured upgrade body, `/api/me/download-quota` for the UI indicator, env-var config `FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`. Let's go with this.

### 2026-08-27 22:05 — agent

Direction locked. Distilling to solution.md.
