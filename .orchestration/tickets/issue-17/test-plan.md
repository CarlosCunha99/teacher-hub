# Test plan

## Coverage summary
- Unit tests: 46 new, 0 updated
- Functional/integration tests: 22 new, 0 updated
- Existing regression tests preserved: yes — `env-config.test.ts` and `scripts.test.ts` are expected to need implementation-side updates (new `DATABASE_URL` env var, new `db:generate`/`db:migrate` scripts) but their existing assertions (non-empty `.env.example`, no leaked secrets, `lint`/`format:check`/`build` exit 0) continue to pass unmodified; no test logic in this plan removes or weakens those checks. `health/route.test.ts` is untouched and re-run as-is for regression.

## Test runner
- Framework: Vitest 3.x, `environment: "node"`, `globals: true` (see `vitest.config.ts`), with `vite-tsconfig-paths` so `@/` imports resolve.
- Command: `npm test` (runs `vitest run`, the full suite).
- Fast subset: `npx vitest run src/app/api/resources src/app/api/notifications src/lib/__tests__/auth.test.ts src/lib/db/__tests__/schema.test.ts src/lib/comments` (path-scoped to only the new commenting/notification test files added by this feature).

## Behaviors to test

### Unit

- **Rejects empty comment body** — posting a comment whose body is an empty string is rejected.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions:
    - `POST` with `body: ""` returns 400
    - Response JSON includes a human-readable error message (e.g. `error` field is a non-empty string)
    - No row is persisted (mock DB insert is not called, or a subsequent GET does not include it)
  - Setup: mock `getCurrentUser` to return an authenticated dev user; mock/stub the DB layer (in-memory fake or Drizzle mock) so no real Postgres is needed
  - Maps to acceptance criterion: "Comment body is plain text, trimmed, non-empty after trimming... Empty... bodies are rejected with 400"

- **Rejects whitespace-only comment body** — a body of only spaces/tabs/newlines is rejected after trimming.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions:
    - `POST` with `body: "   \n\t  "` returns 400 with error message
    - No row persisted
  - Setup: same as above
  - Maps to acceptance criterion: "...non-empty after trimming... whitespace-only... bodies are rejected with 400"

- **Rejects comment body over 2000 characters** — a body of length 2001 is rejected.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions:
    - `POST` with a 2001-char string returns 400 with error message
    - `POST` with exactly 2000 chars (boundary) succeeds — isolate this as its own assertion/test so the boundary is independently verified
  - Setup: generate strings via `"a".repeat(2000)` / `"a".repeat(2001)`; mock auth + DB
  - Maps to acceptance criterion: "...≤ 2000 characters... oversized bodies are rejected with 400"

- **Accepts and trims a valid comment body** — a valid, padded body is trimmed and stored trimmed.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions:
    - `POST` with `body: "  Great resource!  "` returns 201 (or 200, per implementation convention)
    - Persisted/returned comment `body` equals `"Great resource!"` (no leading/trailing whitespace)
  - Setup: mock auth + DB
  - Maps to acceptance criterion: "Comment body is plain text, trimmed, non-empty after trimming"

- **Rejects reply-to-reply (threading depth enforcement)** — creating a reply whose target parent is itself a reply (has a non-null `parent_id`) is rejected.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.test.ts` (new)
  - Key assertions:
    - Given a top-level comment A and a reply B to A, `POST .../comments/B/replies` returns 400
    - Response includes a human-readable error (e.g. "cannot reply to a reply")
    - No new row is persisted for the rejected attempt
  - Setup: seed/mock two existing comment records — a top-level (`parent_id: null`) and a reply (`parent_id: <top-level id>`); mock auth as any authenticated user
  - Maps to acceptance criterion: "Threading is strictly one level: a reply cannot itself be replied to. Attempting to reply to a reply returns 400."

- **Accepts reply to a top-level, non-deleted comment** — baseline positive case isolated from the rejection case above (independent axis: parent type = top-level vs reply).
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.test.ts` (new)
  - Key assertions:
    - `POST` reply to a top-level comment returns 201 with `parent_id` equal to the top-level comment's id
  - Setup: mock auth + DB with one top-level comment
  - Maps to acceptance criterion: "An authenticated user can reply to any existing (non-deleted) top-level comment."

- **Rejects reply to a soft-deleted top-level comment** — parent-state axis (deleted vs live) isolated from the threading-depth axis.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.test.ts` (new)
  - Key assertions:
    - Given a top-level comment with `deleted_at` set, `POST .../replies` returns 400 (or 404, per implementation — assert whichever the contract defines; flag if ambiguous)
  - Setup: mock a soft-deleted top-level comment record
  - Maps to acceptance criterion: "reply to any existing (non-deleted) top-level comment" (implies deleted parents are rejected)

- **Rejects unauthenticated comment creation** — no session / auth stub returns "no user" → 401.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions:
    - `POST` with `getCurrentUser` mocked to return `null`/reject returns 401
    - No row persisted
  - Setup: mock `getCurrentUser` to simulate absence of a session
  - Maps to acceptance criterion: "unauthenticated requests are rejected with 401"

- **Rejects unauthenticated reply creation** — same as above, applied to the replies endpoint (independent axis: endpoint).
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.test.ts` (new)
  - Key assertions: `POST` reply without auth returns 401
  - Setup: mock `getCurrentUser` → null
  - Maps to acceptance criterion: "All comment/reply/notification write endpoints require authentication."

- **Rejects unauthenticated edit/delete** — `PATCH`/`DELETE` on `[commentId]` without auth returns 401.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions: both `PATCH` and `DELETE` return 401 when unauthenticated (2 assertions, one per verb)
  - Setup: mock `getCurrentUser` → null; existing comment record present
  - Maps to acceptance criterion: "All comment/reply/notification write endpoints require authentication."

- **Author can edit own comment** — the authenticated user matches `author_id`.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions:
    - `PATCH` with new valid body returns 200
    - Returned/persisted comment has updated `body` and a non-null `updated_at`/`edited_at` distinct from `created_at`
  - Setup: mock authenticated user = comment author; mock DB update
  - Maps to acceptance criterion: "A comment's author can edit the body of their own comment"

- **Edited comment is marked as edited** — listing surfaces an edited indicator.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions:
    - After an edit, `GET` listing includes the comment with a truthy edited flag/timestamp field (e.g. `editedAt` non-null) distinguishable from a never-edited comment (`editedAt` null) in the same response
  - Setup: mock DB with one edited and one non-edited comment
  - Maps to acceptance criterion: "Edited comments are visibly marked as edited in listings"

- **Editing another user's comment is rejected (403)** — non-author, non-owner, non-moderator.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions: `PATCH` returns 403; comment body unchanged in subsequent read/mock-state check
  - Setup: mock authenticated user with an id different from `author_id`, not resource owner, role != moderator
  - Maps to acceptance criterion: "Editing or deleting a comment you do not own... returns 403."

- **Edit validation reuses comment-creation validation rules** — empty/oversized edit body rejected with 400 (independent axis: create vs edit, same validation rule).
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions: `PATCH` with `body: ""` and with 2001-char body each return 400
  - Setup: mock authenticated user = author
  - Maps to acceptance criterion: "edits are subject to the same validation as new comments"

- **Author can delete own comment (soft delete)**.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions:
    - `DELETE` returns 200/204
    - Underlying record's `deleted_at` is set (non-null); row is NOT removed from the mock store
  - Setup: mock authenticated user = author
  - Maps to acceptance criterion: "A comment's author can delete their own comment." + "Deletion is a soft delete"

- **Resource owner can delete any comment on their resource** — actor role axis: resource owner, not comment author.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions: `DELETE` returns 200/204 when authenticated user id matches the resource's `owner_id` but not the comment's `author_id`
  - Setup: mock resource with `owner_id` = actor id; comment `author_id` = a different user
  - Maps to acceptance criterion: "A resource owner can delete any comment on their own resource."

- **Moderator can delete any comment on any resource** — actor role axis: moderator, not author, not owner.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions: `DELETE` returns 200/204 when authenticated user has `role: "moderator"`, is neither comment author nor resource owner
  - Setup: mock user with `role = "moderator"`; comment/resource owned by other users
  - Maps to acceptance criterion: "A user with the moderator role can delete any comment on any resource."

- **Non-author/non-owner/non-moderator delete is rejected (403)** — negative control isolating the actor-role axis from the above three positive cases.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` (new)
  - Key assertions: `DELETE` returns 403; `deleted_at` remains null
  - Setup: mock plain authenticated user with no relation to the comment/resource, role != moderator
  - Maps to acceptance criterion: "Editing or deleting a comment you do not own (and are not a moderator / resource-owner authorised)... returns 403."

- **Soft-deleted comment excluded from normal listing, placeholder shown** — listing behavior for deleted rows.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions:
    - `GET` listing response for a resource containing one deleted top-level comment still includes an entry at that position (thread continuity) with `body` replaced by the placeholder text ("This comment has been deleted") — NOT the original body
    - Original `author_id`/body content is not leaked in the placeholder entry (assert body strictly equals placeholder string)
  - Setup: mock DB with one soft-deleted top-level comment that has at least one live reply
  - Maps to acceptance criterion: "Deletion is a soft delete: the record is retained but excluded from normal listings, replaced by a placeholder"

- **Deleted parent's live replies remain visible** — thread continuity edge case.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions: `GET` listing shows the placeholder parent AND its live (non-deleted) reply, both present and correctly nested/associated
  - Setup: mock a soft-deleted top-level comment with one live reply
  - Maps to acceptance criterion: "Deleted parent, live replies: ... replies remain visible under the comment deleted placeholder"

- **Self-notification suppressed on new comment** — commenter is the resource owner.
  - File: `src/lib/__tests__/notifications.test.ts` (new — or colocated in comments route test if notification dispatch is inline; adjust path once implementation location is known)
  - Key assertions:
    - After `POST` a comment where `author_id === resource.owner_id`, no notification row is created (mock notification-insert is not called / notifications table remains empty for that resource owner)
  - Setup: mock resource owned by the same user who is posting the comment
  - Maps to acceptance criterion: "unless the commenter is the resource owner"

- **Notification created on new comment (non-owner commenter)** — positive control for the above (independent axis: commenter == owner vs commenter != owner).
  - File: `src/lib/__tests__/notifications.test.ts` (new)
  - Key assertions: exactly one notification row is created, `recipient_id === resource.owner_id`, `type` indicates "new_comment", includes `resource_id` and `comment_id`
  - Setup: mock resource owned by user X; comment posted by user Y
  - Maps to acceptance criterion: "the resource owner receives an in-app notification"

- **Self-notification suppressed on reply** — replier is the parent comment's author.
  - File: `src/lib/__tests__/notifications.test.ts` (new)
  - Key assertions: no notification row created when `reply.author_id === parentComment.author_id`
  - Setup: mock parent comment authored by user X; reply posted by user X
  - Maps to acceptance criterion: "unless the replier is the parent comment author"

- **Notification created on reply (different replier)** — positive control (independent axis: replier == parent author vs replier != parent author).
  - File: `src/lib/__tests__/notifications.test.ts` (new)
  - Key assertions: one notification row created, `recipient_id === parentComment.author_id`, `type` indicates "reply", includes `resource_id` + `comment_id` (reply id) and/or parent comment id
  - Setup: mock parent comment authored by user X; reply posted by user Y
  - Maps to acceptance criterion: "the parent comment's author receives an in-app notification"

- **Notification includes resource + comment linkage context**.
  - File: `src/lib/__tests__/notifications.test.ts` (new)
  - Key assertions: created notification object has non-null `resource_id` and `comment_id` fields sufficient to construct a deep link
  - Setup: any notification-triggering action (reuse fixture from "Notification created on new comment")
  - Maps to acceptance criterion: "Notifications include enough context to link back to the originating resource + comment."

- **`getCurrentUser` auth stub returns a fixed dev user** — smoke test for the seam.
  - File: `src/lib/__tests__/auth.test.ts` (new)
  - Key assertions: `getCurrentUser(request)` resolves to an object with the expected shape (`id`, `role`, etc.) for a plain `Request`
  - Setup: call directly with a bare `new Request(...)`, no mocking needed (this is a unit test of the stub itself)
  - Maps to acceptance criterion: supports "authenticated user" preconditions used throughout; not itself an acceptance criterion, but a foundational unit for all authz tests

- **Schema exports are defined** — smoke test.
  - File: `src/lib/db/__tests__/schema.test.ts` (new)
  - Key assertions: `commentsTable`, `notificationsTable`, `usersTable`, `resourcesTable` are all defined (not `undefined`) and expose expected column keys (`parent_id`, `deleted_at`, `recipient_id`, `read_at`, etc.)
  - Setup: import schema module directly, no DB connection needed
  - Maps to acceptance criterion: foundational for soft-delete / threading / notification acceptance criteria; not directly listed itself

- **Pagination default page size is 20** — unit-level check on the query/handler logic in isolation from HTTP (if pagination logic is extracted into a helper) or as part of route test.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions: `GET` with no `?limit=` query param and 25 seeded top-level comments returns exactly 20 items in the page
  - Setup: mock DB with 25 top-level comments, distinct `created_at` values
  - Maps to acceptance criterion: "paginated response with a default page size of 20"

- **Comments ordered oldest-first at top level** — ordering unit check, independent axis from pagination size.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions: returned array's `created_at` values are non-decreasing (ascending); first item is the earliest-created comment
  - Setup: mock 3 comments with distinct, out-of-insertion-order `created_at` timestamps
  - Maps to acceptance criterion: "chronological, oldest first at the top level"

- **Replies ordered oldest-first within a parent** — ordering unit check for the nested collection (independent axis: top-level ordering vs reply ordering).
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` (new)
  - Key assertions: for a parent with 3 replies with distinct `created_at`, the `replies` array (or nested field) is ascending by `created_at`
  - Setup: mock one top-level comment with 3 replies inserted out of chronological order
  - Maps to acceptance criterion: "Replies to a comment are ordered chronologically, oldest first."

- **List unread notifications** — `GET /api/notifications`.
  - File: `src/app/api/notifications/__tests__/route.test.ts` (new)
  - Key assertions: returns only notifications for the current user with `read_at IS NULL`; excludes already-read and other users' notifications
  - Setup: mock 3 notifications: unread for current user, read for current user, unread for a different user
  - Maps to acceptance criterion: "A user can list their unread notifications"

- **Mark a single notification as read**.
  - File: `src/app/api/notifications/[notificationId]/__tests__/route.test.ts` (new)
  - Key assertions: `PATCH` returns 200; notification's `read_at` becomes non-null; a subsequent (mocked) unread-list no longer includes it
  - Setup: mock one unread notification belonging to the current user
  - Maps to acceptance criterion: "mark an individual notification as read"

- **Cannot mark another user's notification as read** — authz edge case for notifications.
  - File: `src/app/api/notifications/[notificationId]/__tests__/route.test.ts` (new)
  - Key assertions: `PATCH` on a notification whose `recipient_id` != current user returns 403 or 404 (assert whichever the contract defines)
  - Setup: mock notification belonging to a different user
  - Maps to acceptance criterion: implied by per-user notification listing/ownership; not explicit in ticket but tightly coupled security boundary

- **Notification for a deleted comment does not 500** — inert-notification edge case.
  - File: `src/app/api/notifications/__tests__/route.test.ts` (new)
  - Key assertions: `GET` listing (or clicking through, if a resolve/detail endpoint exists) for a notification whose `comment_id` points at a soft-deleted comment returns 200, not 500; response still includes the notification with a valid (if degraded) link payload
  - Setup: mock a notification referencing a comment that has `deleted_at` set
  - Maps to acceptance criterion: "if a notification was already generated, its target link handles the deleted state gracefully"

### Functional / integration

- **Full comment lifecycle via API routes (create → list → edit → delete)** — end-to-end flow through the actual route handlers with an in-memory/test DB (not mocked at the query level), verifying route wiring, not just isolated unit logic.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.integration.test.ts` (new) — or folded into `route.test.ts` if the repo convention doesn't split unit/integration files; naming flagged for the implementation planner
  - Preconditions: test DB (Postgres test container/schema, or Drizzle in-memory/sqlite-shim if adopted) migrated with `comments`/`notifications`/stub `users`/`resources` tables; one seeded resource + owner
  - Actions: `POST` a comment as user A; `GET` the listing and assert it appears; `PATCH` the comment as user A; `DELETE` the comment as user A; `GET` the listing again
  - Assertions: after create, listing contains the new comment with correct body/author; after edit, listing shows updated body + edited marker; after delete, listing shows placeholder text, not the original body
  - Cleanup: truncate/reset comment + notification tables between tests (or transaction rollback per test)
  - Maps to acceptance criterion: "post a comment... see it appear in the thread" + edit + soft-delete criteria, exercised together as a flow

- **Reply flow with threading enforcement (integration)** — post top-level, reply once (success), attempt second-level reply (rejected).
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.integration.test.ts` (new)
  - Preconditions: seeded resource + two users
  - Actions: user A posts top-level comment C1; user B posts reply R1 to C1; user A attempts to reply to R1
  - Assertions: R1 created with `parent_id = C1.id` and 201; the reply-to-R1 attempt returns 400; listing shows C1 with `replies: [R1]`
  - Cleanup: reset tables
  - Maps to acceptance criterion: "Replies are returned nested under their parent comment" + "Threading is strictly one level"

- **Authorization matrix across roles (integration)** — table-driven test exercising author/owner/moderator/stranger against PATCH and DELETE.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.integration.test.ts` (new)
  - Preconditions: one resource owned by user O; one comment authored by user A; users M (role=moderator) and S (stranger, no relation) also exist
  - Actions: for each of {A, O, M, S} × {PATCH, DELETE}, issue the request against a freshly-seeded comment
  - Assertions: A/O/M succeed (200/204), S is rejected (403); table asserts each of the 8 cells independently so no combination is silently skipped
  - Cleanup: reseed the comment before each cell (fresh state per case)
  - Maps to acceptance criterion: all four authz bullets under "Edit & delete"

- **Notification round-trip (integration)** — comment/reply triggers a real notification row, retrievable via the notifications API.
  - File: `src/app/api/notifications/__tests__/route.integration.test.ts` (new)
  - Preconditions: resource owned by user O; user A ≠ O
  - Actions: user A posts a comment on O's resource; `GET /api/notifications` as O; `PATCH /api/notifications/:id` to mark read as O; `GET /api/notifications` as O again
  - Assertions: first GET includes the new-comment notification unread; after PATCH, second GET excludes it (or shows `read_at` set, depending on whether the "list unread" endpoint filters by read state)
  - Cleanup: reset notifications table
  - Maps to acceptance criterion: "receives an in-app notification" + "list their unread notifications and mark an individual notification as read"

- **No self-notification round-trip (integration)** — owner comments on their own resource; owner replies to their own comment.
  - File: `src/app/api/notifications/__tests__/route.integration.test.ts` (new)
  - Preconditions: resource owned by user O
  - Actions: O posts a comment on their own resource; O replies to their own comment
  - Assertions: `GET /api/notifications` as O returns empty (no notifications generated by either action)
  - Cleanup: reset tables
  - Maps to acceptance criterion: "posting/replying to your own resource or your own comment MUST NOT produce a notification"

- **Pagination cursor traversal (integration)** — walks multiple pages of top-level comments.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.integration.test.ts` (new)
  - Preconditions: 45 seeded top-level comments on one resource, distinct `created_at`
  - Actions: `GET` page 1 (no cursor); `GET` page 2 using the cursor from page 1's response; `GET` page 3
  - Assertions: page 1 has 20 items, page 2 has 20 items, page 3 has 5 items; no item appears on more than one page; concatenated pages preserve oldest-first order with no gaps or duplicates
  - Cleanup: reset comments table
  - Maps to acceptance criterion: "Listing endpoint returns comments in a paginated response with a default page size of 20"

- **Concurrent replies both persist with stable ordering (integration)** — race-condition edge case.
  - File: `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.integration.test.ts` (new)
  - Preconditions: one top-level comment C1
  - Actions: fire two `POST .../replies` requests to C1 concurrently (`Promise.all`) from two different users with distinct bodies
  - Assertions: both replies are persisted (2 rows, not 1); a subsequent `GET` listing shows both replies nested under C1 with a stable, deterministic order across repeated GETs (re-fetch twice and diff-compare ordering)
  - Cleanup: reset tables
  - Maps to acceptance criterion: "two replies posted at nearly the same time must both be persisted and both appear in the thread with a stable ordering"

- **Deleted resource hides its comments and does not 500 notifications (integration)** — cross-entity edge case.
  - File: `src/app/api/resources/[resourceId]/comments/__tests__/route.integration.test.ts` (new)
  - Preconditions: a resource with comments and at least one notification referencing it
  - Actions: simulate resource deletion (per whatever mechanism the implementation provides — direct DB flag/row removal in the test fixture since a resource-delete endpoint is out of scope for this ticket); then `GET` the comments listing for that resource id and `GET /api/notifications` for the affected recipient
  - Assertions: comments listing for the deleted resource returns empty (or 404, per contract) rather than the old comments; notifications endpoint returns 200 without 500, even though its target resource no longer resolves
  - Cleanup: reset tables
  - Maps to acceptance criterion: "if the underlying resource is deleted, its comments are not listed anywhere and their notifications become inert (do not 500 when opened)"

- **`npm run build` compiles cleanly with new DB/auth/route/component files (regression, existing test re-run)** — ensures TypeScript across all new files type-checks under the existing `scripts.test.ts` build check.
  - File: `src/__tests__/scripts.test.ts` (existing, re-run unmodified unless script list assertions require updating — see "Not tested" note below)
  - Preconditions: all new source files present
  - Actions: existing test already runs `npm run build`
  - Assertions: existing assertions (`status === 0`, `.next/` exists) continue to pass
  - Cleanup: none (existing test)
  - Maps to acceptance criterion: general regression guard, not a specific acceptance criterion

## Edge cases covered
- Self-notifications (own resource comment) → tested by: "Self-notification suppressed on new comment"
- Self-notifications (own comment reply) → tested by: "Self-notification suppressed on reply" + integration "No self-notification round-trip"
- Concurrent replies, stable ordering, no lost writes → tested by: integration "Concurrent replies both persist with stable ordering"
- Deleted parent, live replies preserved → tested by: "Deleted parent's live replies remain visible"
- Deleted resource hides comments / inert notifications, no 500 → tested by: integration "Deleted resource hides its comments and does not 500 notifications"
- 2000-char cap boundary (exactly 2000 vs 2001) → tested by: "Rejects comment body over 2000 characters" (includes boundary assertion)
- Notification volume (one notification per comment, no batching) → tested by: "Notification created on new comment (non-owner commenter)" implicitly (single-notification-per-event assertion); no dedicated volume/load test — see "Not tested"

## Not tested (with reason)
- **User account deletion behaviour for authored comments** (Ambiguity A, ❓ Unverified in ticket) — not tested because the product behaviour ("Deleted user" placeholder vs hard delete) is explicitly unresolved and blocking-no; no user-deletion endpoint is in this ticket's scope per impact.md. Should be added once Ambiguity A is confirmed and a user-deletion mechanism exists.
- **Unauthenticated read access** (Ambiguity C) — not tested as "must be rejected" because the proposed default (reads require auth) is a proposed reading, not yet confirmed; instead, the plan tests "reads require auth" implicitly by having all listing tests use an authenticated mock user. If Ambiguity C is confirmed as public-read, a new test ("unauthenticated GET returns 200") must be added and the implicit assumption revisited.
- **Rate limiting / anti-spam** — explicitly out of scope per ticket; no test written.
- **i18n / RTL rendering and accessibility (keyboard nav, screen-reader labels) of the comment UI** — out of scope for this test plan's unit/integration layer since it requires component/DOM-level or a11y tooling (e.g. axe, RTL rendering) not evidenced in the existing test conventions (`vitest` config here is `environment: "node"`, no jsdom/DOM testing library detected in `package.json`); flagged for a follow-up UI test layer if/when a DOM test environment is added.
- **Notification batching / high-volume (hundreds of comments → hundreds of notifications)** — explicitly out of scope per ticket ("Batching is out of scope"); no load/volume test written, only the single-notification-per-event unit case.
- **Moderation reporting/flagging** — explicitly out of scope per ticket; no test written.
- **Comment count index / performance requirement** ("fetching comment count must not scan all comment rows") — this is a non-functional implementation-strategy requirement the ticket explicitly leaves to the developer; no automated performance/query-plan test is included since Vitest has no query-plan inspection tooling in this repo. Recommend a manual `EXPLAIN ANALYZE` check or a dedicated index-existence smoke test (e.g. asserting the migration SQL contains a `CREATE INDEX` on `(resource_id, deleted_at)`) if the planner wants automated coverage — not included here since it tests implementation, not behavior.

## Fixtures & data
- **Mock auth helper** (`test/helpers/mockAuth.ts`, new — suggested location for implementer): a small utility to override `getCurrentUser` per test (e.g. via `vi.mock("@/lib/auth")`) so each test can inject `{ id, role }` for the "current user," including a "no user" case for 401 tests.
- **In-memory/fake DB fixture**: since `drizzle-orm` + `postgres` are new dependencies with no existing test DB convention in the repo, unit tests should mock the DB client (`vi.mock("@/lib/db")`) with an in-memory array-backed fake exposing the subset of the query builder surface the routes use. This avoids requiring a live Postgres for every unit test.
- **Integration test DB**: integration tests need a real (or test-container) Postgres instance with migrations applied, OR a documented in-memory alternative if the implementation chooses one. This plan assumes a `DATABASE_URL` pointing at a disposable test database, reset via truncate or transaction rollback between tests, consistent with the `DATABASE_URL` env var already flagged in impact.md. If no test Postgres is available in CI, integration tests must be gated (e.g. `describe.skipIf(!process.env.DATABASE_URL)`) so unit tests still run standalone.
- **Seed fixtures**: reusable factory functions (e.g. `makeUser({ role })`, `makeResource({ ownerId })`, `makeComment({ authorId, resourceId, parentId, deletedAt })`) to keep the many authz/threading/ordering cases terse and consistent — suggested location `test/fixtures/comments.ts`.
