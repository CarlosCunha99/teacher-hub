# [Phase 2] Implement resource commenting and feedback system

**Type:** feature
**Source:** GitHub issue #20 — https://github.com/CarlosCunha99/teacher-hub/issues/20 (created during intake; original session referenced #17 which is a different taxonomy feature)

## Problem

✅ **Verified** (from user session brief and product framing in README.md L1–L4)

Teachers using Teacher Hub can currently only discover and (per the Phase 2 roadmap) like/save resources. They have no way to leave feedback, ask the author a question, share how they used a resource in class, or discuss it with peers. When a resource is helpful — or has an issue (broken link, outdated content, wrong year level) — teachers have no channel to say so on the resource itself.

This is a gap in Teacher Hub's identity as a *collaborative teacher community* rather than a static file library. Without comments, resource quality signal is limited to download and like counts, and authors receive no textual feedback that would help them improve their materials.

## Impact

⚠️ **Inferred** (user counts and severity assessments are extrapolated from Phase 2 roadmap framing; no analytics or user research is present in the repo)

- **Users affected:** all authenticated teachers on the platform (both resource authors and consumers). Every active user is a potential commenter; every publishing teacher is a potential comment recipient.
- **Severity:** medium — this is a Phase 2 community feature, not a blocker for MVP. The platform is usable without it, but Phase 2's stated goal is layering social/collaborative behaviour on top of the MVP library, and commenting is the central primitive for that.
- **Frequency:** expected to be used regularly once the resource library has meaningful traffic. Comments are latency-tolerant (async discussion), not real-time.

## Success criteria

⚠️ **Inferred** (product-level goals derived from the user brief; no PRD or acceptance metrics provided)

- A signed-in teacher can post a plain-text comment on any resource detail page and see it appear in the thread.
- A signed-in teacher can reply to an existing comment (exactly one level of threading).
- A comment author can edit or delete their own comment; the UI clearly signals edited comments.
- A resource owner or a platform moderator can delete any comment on a resource they own / moderate.
- A teacher receives an in-app notification when (a) someone comments on their resource, or (b) someone replies to their comment. Users are never notified about their own actions.
- Comments and replies are displayed in a stable chronological order with threading visually represented.
- Comment listings scale to resources with hundreds of comments without a full-page reload or unbounded response payloads.

## Acceptance criteria

⚠️ **Inferred** unless noted. These are product-level assertions a tester can convert directly into cases; API paths / status codes reflect the conventions the user brief already committed to.

### Posting & reading
- [ ] An authenticated user can post a comment on a resource; unauthenticated requests are rejected with 401.
- [ ] Comment body is plain text, trimmed, non-empty after trimming, and ≤ 2000 characters. Empty, whitespace-only, or oversized bodies are rejected with 400 and a human-readable error.
- [ ] Comments for a resource are readable by anyone who can view the resource (authenticated user; visibility of unauthenticated read is **❓ Unverified**, see Ambiguity C).
- [ ] Listing endpoint returns comments in a paginated response with a default page size of 20 and a documented ordering (chronological, oldest first at the top level — see Ambiguity D).
- [ ] Replies are returned nested under their parent comment (or as a separate `replies` collection per parent) so the client can render threading without a second round-trip per comment.

### Replies (threading)
- [ ] An authenticated user can reply to any existing (non-deleted) top-level comment.
- [ ] Threading is strictly one level: a reply cannot itself be replied to. Attempting to reply to a reply returns 400.
- [ ] Replies to a comment are ordered chronologically, oldest first.

### Edit & delete
- [ ] A comment's author can edit the body of their own comment; edits are subject to the same validation as new comments.
- [ ] Edited comments are visibly marked as edited in listings (e.g. "edited" indicator with the edit timestamp).
- [ ] A comment's author can delete their own comment.
- [ ] A resource owner can delete any comment on their own resource.
- [ ] A user with the `moderator` role can delete any comment on any resource.
- [ ] Deletion is a **soft delete**: the record is retained but excluded from normal listings, replaced by a placeholder ("This comment has been deleted") so thread structure and reply anchors are preserved.
- [ ] Editing or deleting a comment you do not own (and are not a moderator / resource-owner authorised to moderate) returns 403.

### Notifications
- [ ] When a comment is posted on a resource, the resource owner receives an in-app notification — **unless the commenter is the resource owner**.
- [ ] When a reply is posted, the parent comment's author receives an in-app notification — **unless the replier is the parent comment author**.
- [ ] A user can list their unread notifications and mark an individual notification as read.
- [ ] Notifications include enough context to link back to the originating resource + comment.
- [ ] Deleting the source comment does not send a "new comment" notification retroactively; if a notification was already generated, its target link handles the deleted state gracefully.

### Non-functional
- [ ] All comment/reply/notification write endpoints require authentication.
- [ ] Endpoints are covered by automated tests (repo convention: Vitest, see ✅ package.json L16).
- [ ] Fetching the comment count for a resource does not require scanning all comment rows for that resource (product-level requirement — implementation strategy is the developer's call).

## Edge cases & non-functional

⚠️ **Inferred**

- **Self-notifications:** posting/replying to your own resource or your own comment MUST NOT produce a notification.
- **Concurrent replies:** two replies posted at nearly the same time must both be persisted and both appear in the thread with a stable ordering (no lost writes, no reordering on refresh).
- **Deleted parent, live replies:** when a top-level comment is soft-deleted, its replies remain visible under the "comment deleted" placeholder — thread continuity is preserved.
- **Deleted resource:** if the underlying resource is deleted, its comments are not listed anywhere and their notifications become inert (do not 500 when opened).
- **User account deletion:** see Ambiguity A — behaviour for comments authored by a deleted user is **❓ Unverified**.
- **Long comments / abuse:** the 2000-char cap is a first-line defence. Rate limiting is **out of scope** for this ticket but the design must not preclude adding it later.
- **Moderation surface:** flagging / reporting comments is out of scope; the data model must not preclude adding a `reports` table later.
- **Notification volume:** if a resource owner receives hundreds of comments, they receive one notification per comment. Batching is out of scope.
- **Backward compatibility:** the feature adds new tables/endpoints; no existing endpoint behaviour changes. The repo currently exposes only `/api/health` (✅ Verified in `src/app/api/health/route.ts`), so there is nothing to break.
- **i18n / a11y:** comment UI must render RTL text correctly, and the composer + thread controls must be keyboard-navigable and screen-reader labelled. Content itself is user-supplied and not translated by the platform.
- **Security:** comment bodies are plain text; the client must render them without HTML interpretation (no XSS via comment content). Authorization checks (author / owner / moderator) live server-side, never client-only.

## Out of scope

- Email or push notifications (in-app only for this phase).
- Comment reactions / emoji.
- Rich text or markdown in comment bodies.
- Comment flagging or reporting workflow (moderation v2).
- Nested threading beyond one level.
- Anonymous or pseudonymous comments.
- Rate limiting / anti-spam heuristics.
- Real-time push (WebSocket / SSE) of new comments — clients poll or refetch.
- Search over comment content.
- The taxonomy feature that GitHub issue #17 currently describes (that is a separate ticket — see Ambiguity B).

## References

- Session kickoff prompt (user-provided, in `## Original` below).
- README.md — product framing and phase model (✅ Verified L1–L4, L87–L89).
- GitHub issue #2 — "[MVP] Implement social authentication and session management" (prerequisite: auth). ✅ Verified via `gh issue view 2`.
- GitHub issue #3 — "[MVP] Design PostgreSQL schema for users, resources, tags, boards, and interactions" (prerequisite: DB + resource model). ✅ Verified via `gh issue view 3`.
- GitHub issue #17 — currently titled "[Phase 2] Extend taxonomy to include university-level resources" (⚠️ **not** the commenting feature — see Ambiguity B). ✅ Verified via `gh issue view 17`.
- Current repo surface: only `src/app/api/health/route.ts`, `src/lib/health.ts`, `src/app/page.tsx`, `src/app/layout.tsx` exist. No auth, DB, resource model, or user model is present yet. ✅ Verified.

## Raw context used

`raw-context.md` was present but empty (only the intake template). All product signal for this ticket comes from the session kickoff prompt (see `## Original`) and the `gh` issue investigation cited above.

## Enrichment notes

- Confidence legend applied throughout: ✅ Verified (evidence in repo/tooling), ⚠️ Inferred (reasoned from product framing, no direct evidence), ❓ Unverified (needs human confirmation).
- **Ambiguity A — Account deletion behaviour for comments.** The user brief does not say what happens to a teacher's comments if they delete their account. Proposed reading: soft-delete the user record and render their historical comments as "Deleted user" (author reference retained for thread integrity, PII removed). Rejected alternative: hard-delete comment rows on account deletion (breaks thread continuity, wipes signal for the resource owner). **blocking: no** — safe default proposed, but flag for confirmation before shipping.
- **Ambiguity B — GitHub issue number mismatch (RESOLVED).** A new GitHub issue #20 was created for the commenting feature: https://github.com/CarlosCunha99/teacher-hub/issues/20. The PR will close #20, not #17. **blocking: resolved**.
- **Ambiguity C — Read access for unauthenticated visitors.** The user brief says all write endpoints require auth ("All comment endpoints require authentication"). It is ambiguous whether *reading* a comment thread requires auth. Proposed reading: reads require auth in Phase 2 (matches "authenticated teachers" framing and simplifies scope). Rejected alternative: public read (would need cache-control, bot handling, GDPR review). **blocking: no** — proposed default is conservative.
- **Ambiguity D — Ordering of top-level comments.** The user brief says "chronological". Proposed reading: oldest-first at the top level (matches typical forum/thread UX and makes cursor pagination stable). Rejected alternatives: newest-first (common in social feeds but harder to paginate cursorly); score-based (requires a score primitive that doesn't exist yet). **blocking: no**.
- **Ambiguity E — Edit window / edit history.** The user brief allows authors to edit but does not specify a time window or whether prior versions are retained. Proposed reading: edits allowed indefinitely, no version history retained beyond an "edited at" timestamp shown in the UI. Rejected alternative: N-minute edit window (adds complexity, no product signal justifying it yet). **blocking: no**.
- **Ambiguity F — Moderator role source.** No user model exists in the repo yet (❓ Unverified). Proposed reading: this ticket asserts the *behaviour* ("a user with moderator role can delete any comment") and lets the planning stage decide whether the `role` column lives on the user table from issue #3 or in a separate table. **blocking: no**.
- **Prerequisite state.** Auth (issue #2) and the PostgreSQL schema (issue #3) do **not** exist in code yet (✅ Verified: `src/` contains only the health route and page shell). This ticket is written as if those prerequisites are available at implementation time. If they are not, planning must either sequence this behind them or scaffold minimal versions — but that is a *planning* concern, not a product-ticket concern.

## Needs clarification

The following items were flagged with ⚠️ or ❓ confidence and should be confirmed with the human before brainstorming/planning proceeds:

1. **(BLOCKING) Ambiguity B — GitHub issue mapping.** Should this feature land under a new GitHub issue, or does the product owner want to reassign issue #17? The pipeline needs a real target issue number before opening a PR.
2. **Ambiguity A — Account deletion.** Confirm "Deleted user" placeholder (proposed) vs hard delete.
3. **Ambiguity C — Read auth.** Confirm reads require auth (proposed) vs public read.
4. **Ambiguity D — Ordering.** Confirm oldest-first (proposed) vs newest-first for top-level comments.
5. **Ambiguity E — Edit history.** Confirm no version history, "edited at" timestamp only.
6. **Impact numbers.** No real user metrics exist in the repo — severity/frequency are ⚠️ Inferred and should be sanity-checked by the product owner.
7. **Prerequisite readiness.** Confirm whether auth (#2) and DB schema (#3) will be complete when this ticket is planned, or whether this ticket must scaffold them.

Recommendation: the orchestrator should raise **at minimum item 1** with the user before the brainstorm gate. Items 2–5 can be batched into a single question round if convenient; items 6–7 are for the planner to route.

---

## Original

User request (session kickoff):

> "Use the agentic-ticket-to-pr skill to implement GitHub issue #17 in CarlosCunha99/teacher-hub. This is a Phase 2 roadmap item. Add a commenting system so teachers can leave feedback, suggestions, and questions on resources. Includes threading, notifications, and moderation tools."

GitHub issue #17 as it exists today in `CarlosCunha99/teacher-hub` (retrieved via `gh issue view 17`):

> **Title:** [Phase 2] Extend taxonomy to include university-level resources
>
> **User Story:** As an educator, I want university levels in the taxonomy, so that higher-education resources can be categorized and discovered correctly.
>
> **Acceptance Criteria:**
> - Taxonomy model supports university education levels.
> - Browse and filtering include university levels.
> - Existing primary/secondary data remains compatible.
> - Migration plan preserves current resource classifications.
> - Admin/seed data includes initial university taxonomy values.

Note the mismatch between the session's stated feature (commenting) and GH #17's stated feature (taxonomy). This ticket tracks commenting per the user's kickoff prompt; see Ambiguity B.
