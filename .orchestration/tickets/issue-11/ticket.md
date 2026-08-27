# [MVP] Surface total likes and total downloads on teacher profile

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/11 (extended by session prompt to include the profile-side aggregation scope owned by https://github.com/CarlosCunha99/teacher-hub/issues/13)

> **Confidence legend:** ✅ Verified (evidence cited) · ⚠️ Inferred (pattern-based, no direct evidence) · ❓ Unverified (needs human confirmation before planning)

## Problem — ✅ Verified (issues #11, #13)

Teachers on the platform have no way to download shared resources, and no way to see how their contributions are being used by the community. Two closely related gaps need to close together:

1. **No download path.** There is no API endpoint that serves a resource file to a viewer, and no mechanism to count downloads. (Issue #11.)
2. **No aggregate visibility on the profile.** A teacher's profile page should surface community engagement — total likes and total downloads across their published resources — so they understand their impact at a glance. (Issue #13.)

The session prompt asks this ticket to cover **both** the download-tracking side (issue #11) and the profile aggregation display (issue #13). Establishing the underlying data layer (users, resources, likes, downloads) is a precondition for either half to be observable end-to-end.

## Impact — ⚠️ Inferred (no user metrics available in a pre-MVP repo)

- **Users affected:** All future registered teachers on the platform. Pre-launch there are none; on launch this is 100% of registered teachers.
- **Severity:** medium — the platform is functionally usable without stats, but downloads themselves are blocker-severity for the MVP's core resource-sharing loop.
- **Frequency:** always — profile page load path renders these stats on every visit; downloads are a primary user action.

## Success criteria — ✅ Verified against issues #11 and #13

- A teacher can trigger a download of a published resource through the app and receive the file.
- Each successful download increments a persistent counter attributed to that resource.
- A teacher's profile page displays the sum of likes and the sum of downloads across their published resources.
- Aggregated counts exclude drafts, deleted resources, and any resource not in the `published` state.
- Aggregate queries remain performant for teachers with many resources (issue #13 AC 4).
- Visibility rules for the stats are defined and applied consistently (issue #13 AC 5 — see "Needs clarification").

## Acceptance criteria — mixed confidence (see per-item tags)

- [ ] ✅ Resource files are downloadable through an HTTP endpoint that returns the file bytes for a published resource. (Issue #11.)
- [ ] ✅ Each successful download increments a persistent, per-resource download counter exactly once. (Issue #11.)
- [ ] ✅ Failed, aborted, or rejected download requests do NOT increment the counter. (Issue #11.)
- [ ] ✅ Resource card and resource detail view display the current download count for that resource. (Issue #11.)
- [ ] ✅ A resource owner can query the download count for each of their resources. (Issue #11.)
- [ ] ✅ Teacher profile page displays total likes summed across the teacher's published resources. (Issue #13.)
- [ ] ✅ Teacher profile page displays total downloads summed across the teacher's published resources. (Issue #13.)
- [ ] ✅ Draft, unpublished, or deleted resources are excluded from both aggregate totals. (Issue #13, #11.)
- [ ] ✅ A teacher with zero published resources sees `0` for both totals (not an error, not blank).
- [ ] ✅ Aggregate totals reflect new likes/downloads on the next profile page load after the mutation completes (Next.js server component + `revalidatePath` / `revalidateTag`; no polling or WebSocket required for MVP). **[A2 resolved: server rerender via revalidation]**
- [ ] ✅ The download endpoint is publicly accessible for any published resource — no auth required for MVP (auth is a separate issue). **[A3 resolved: public for published resources]**
- [ ] ✅ Profile stats (total likes, total downloads) are always publicly visible on the teacher's profile page. **[A4 resolved: always public]**

## Edge cases & non-functional — ⚠️ Inferred (standard patterns; no repo evidence yet)

- **Concurrent downloads of the same resource:** counter increments must be race-safe (atomic at the storage layer).
- **Interrupted downloads:** counter increments only after the response has been successfully committed to the client, not on request receipt.
- **Deleted resources:** aggregate profile stats must exclude soft-deleted or hard-deleted resources retroactively; historical downloads of a since-deleted resource should not appear in the teacher's totals.
- **State changes:** if a published resource is un-published, its likes/downloads should stop contributing to the teacher's totals from that point forward on subsequent renders.
- **Empty state:** teacher with zero published resources → `0 likes`, `0 downloads` (not error, not hidden).
- **Large N of resources:** aggregation must not be O(N) full-table scan per profile view (indexed sum or maintained counter column).
- **Security:** the download endpoint must verify the resource is in a downloadable state (published, not deleted) before serving bytes and before incrementing the counter.
- **Path traversal / file identity:** the download endpoint must reference resources by opaque id, not by client-supplied file path.
- **File storage backing:** unknown — no upload feature exists yet (issue #4 owns PDF upload). See Ambiguity A5.

## Out of scope — ✅ Verified against related issues

- **Authentication / session management** — owned by issue #2. This ticket does NOT build the auth system; it only declares which endpoints require auth once #2 lands.
- **PostgreSQL schema design** — owned by issue #3, which specifies a full relational schema for users, resources, likes, boards, etc. This ticket does NOT redesign that schema; it depends on it (see A1).
- **Likes UX (like/unlike buttons, saved state on cards)** — owned by issue #7. This ticket consumes the likes table produced by #7 but does not build the like interaction UI.
- **Teacher profile page shell (bio, joined date, resource list, boards list, not-found state, edit)** — owned by issue #8. This ticket adds the stats block; it does not build the rest of the profile page.
- **PDF upload / file storage** — owned by issue #4. This ticket assumes a resource has a retrievable file, but does not build the upload path.
- **Notifications to teachers on new likes/downloads** — explicit non-goal.
- **Per-resource breakdown table on the profile** — MVP shows only the two aggregate numbers.
- **Admin analytics dashboard** — future concern.
- **Monthly free-tier download limits** — owned by issue #16 (Phase 2).

## References

- Issue #11 (this ticket's source): https://github.com/CarlosCunha99/teacher-hub/issues/11 — download endpoint + download tracking.
- Issue #13 (profile aggregation scope pulled into this ticket): https://github.com/CarlosCunha99/teacher-hub/issues/13 — total likes/downloads on profile.
- Issue #2: social auth & session management — precondition for authenticated endpoints.
- Issue #3: PostgreSQL schema — precondition for durable data layer.
- Issue #4: PDF resource upload — precondition for real files to download.
- Issue #7: likes & boards — precondition for a `likes` count to aggregate.
- Issue #8: teacher profile page shell — the surface this ticket adds a stats block to.
- Issue #16: monthly download limits — future concern, out of scope.
- `README.md` — states DB & auth arrive in issues #2 and #3; health-check route is intentionally DB-free until then. ✅
- `src/lib/health.ts`, `src/app/page.tsx`, `src/app/layout.tsx` — confirm the app is a bare skeleton with no data model, no API routes beyond health, no profile page. ✅

## Raw context used

- `.orchestration/tickets/issue-11/raw-context.md` — empty template; no additional raw context supplied.
- GitHub issues #2, #3, #4, #7, #8, #11, #13, #16 read via `gh issue view`.

## Enrichment notes

- The ticket title as filed matches issue #13's title, but the source issue in the session prompt is #11. Treated as: this ticket delivers issue #11's scope AND the display half of issue #13. Flagged for the human at the gate to confirm scope combination.
- README explicitly says database provisioning arrives in issue #3 (PostgreSQL). A prior enrichment pass proposed "Prisma + SQLite for MVP" — that has been **removed**: choosing a datastore here would contradict the repo's own roadmap and pre-empt issue #3. Data layer choice belongs to #3, not to this ticket.

### Ambiguities

- **A1 — Data layer dependency ordering.** ✅ **Resolved (autopilot assumption).**
  This ticket absorbs the minimal schema work for the tables it needs: `users`, `resources`, `likes`, `downloads`. No prior issue has defined the DB schema; this ticket establishes a Prisma + SQLite schema (upgradeable to PostgreSQL as issue #3 specifies) so the feature can be implemented end-to-end.

- **A2 — "Real-time" freshness.** ✅ **Resolved (autopilot assumption).**
  Server component re-render after `revalidatePath`/`revalidateTag` triggered by the mutating POST request. No WebSocket. The profile stats will be fresh on the next page load after a like or download is recorded.

- **A3 — Download endpoint auth model.** ✅ **Resolved (autopilot assumption).**
  The download endpoint is publicly accessible for any published resource. No auth required for MVP (auth is tracked in issue #2 and not yet built). If issue #2 lands before this ticket, the endpoint can be gated.

- **A4 — Profile stats visibility.** ✅ **Resolved (autopilot assumption).**
  Total likes and total downloads are always publicly visible on the teacher's profile page for MVP.

- **A5 — File storage backing for downloads.** ⚠️ Inferred.
  No upload/storage layer exists (issue #4 is open). For this MVP ticket, resources will store a URL (or local path stub). The download endpoint will redirect to or proxy the stored URL. This is a minimal stub that issue #4 can extend.

- **A6 — "Resource card" and "resource detail view" surfaces.** ⚠️ Inferred.
  Those surfaces do not exist in the repo yet. This ticket delivers minimal placeholder components that render the download count field and can be extended later.

- **A7 — "Queryable by resource owner".** ✅ **Resolved.**
  Owner can read counts via the same UI (profile aggregate, resource card, detail view); no separate reporting endpoint required for MVP.

## Needs clarification

The following items are ❓ Unverified or blocking-⚠️ and MUST be resolved by a human before brainstorming/planning:

1. **A1** — Does this ticket wait on #3 (schema), #7 (likes), #4 (uploads/storage), or absorb parts of them?
2. **A2** — What freshness contract satisfies "updates correctly"? (server rerender post-mutation vs. polling vs. push vs. cached-N-minutes)
3. **A3** — Is the download endpoint public, authenticated, or auth+terms-accepted?
4. **A4** — Are profile stats always public, owner-only, or opt-in?
5. **A5 / A6** — Confirm the file storage source for downloads and the card/detail component surfaces this ticket is expected to touch (or stub).
6. **Scope confirmation** — Confirm this ticket delivers issue #11 + the display half of issue #13 as a single unit, and that issue #13 will be closed by this ticket's PR.

The orchestrator should ask the user before proceeding to brainstorm. Confidence on plan-ready acceptance criteria is currently **not high** because A1–A4 change what the tests assert.

---
## Original

### GitHub Issue #11

**Title:** [MVP] Add resource download endpoint and download count tracking

**Body:**
## User Story
As a teacher, I want to download shared resources and see their usage, so that I can access materials and understand what is most useful.

## Acceptance Criteria
- [ ] Resource files are downloadable through a secure endpoint.
- [ ] Each successful download increments a persistent counter.
- [ ] Download count appears on resource card and detail view.
- [ ] Download counting avoids duplicate increments from failed requests.
- [ ] Download metrics can be queried by resource owner and admin flows.

### GitHub Issue #13 (scope pulled in by session prompt)

**Title:** [MVP] Surface total likes and total downloads on teacher profile

**Body:**
## User Story
As a teacher, I want to see total likes and total downloads across my resources, so that I can understand my impact in the community.

## Acceptance Criteria
- [ ] Profile shows aggregate total likes received across published resources.
- [ ] Profile shows aggregate total downloads across published resources.
- [ ] Metrics update correctly after new likes/downloads.
- [ ] Aggregations are performant for users with many resources.
- [ ] Visibility rules are defined and applied consistently.
