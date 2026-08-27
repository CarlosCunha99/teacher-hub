# [Phase 2] Implement resource commenting and feedback system

**Type:** feature
**Source:** user-provided (session created for Phase 2 commenting feature; note: current GitHub issue #17 tracks a separate taxonomy feature — this ticket captures the commenting system as described by the product owner)

## Problem

Teachers currently have no way to leave feedback, ask questions, or engage in discussion directly on resources within Teacher Hub. When a teacher discovers a useful resource, they cannot communicate with the author or community about it — they can only download or save it. This limits the platform's value as a collaborative professional community.

A resource commenting system would allow educators to share their experience using a resource, suggest improvements, ask the author for clarification, and build a richer signal around resource quality — beyond simple download counts or likes.

## Impact

- Users affected: all authenticated teachers on the platform
- Severity: medium (core social/community feature for Phase 2)
- Frequency: would be used regularly once the resource library is populated

## Success criteria

- A teacher can post a comment on any resource detail page.
- Teachers can reply to existing comments (one level of threading).
- Comment authors can edit or delete their own comments.
- Resource owners and moderators can delete any comment (moderation).
- Users receive in-app notifications when their resource receives a comment, or when someone replies to their comment.
- Comments are displayed chronologically with threading visually represented.

## Acceptance criteria

- [ ] A POST `/api/resources/:id/comments` endpoint creates a comment for the authenticated user.
- [ ] A GET `/api/resources/:id/comments` endpoint returns paginated comments with replies nested under parent comments.
- [ ] A PUT `/api/comments/:id` endpoint allows the comment author to edit their comment body.
- [ ] A DELETE `/api/comments/:id` endpoint allows the comment author or a moderator to delete a comment.
- [ ] A POST `/api/comments/:id/replies` endpoint creates a reply to a comment (one level of threading — replies cannot have their own replies).
- [ ] A GET `/api/notifications` endpoint returns unread notifications for the authenticated user, including comment events.
- [ ] A PUT `/api/notifications/:id/read` endpoint marks a notification as read.
- [ ] When a comment is posted on a resource, the resource owner receives a notification.
- [ ] When a reply is posted on a comment, the parent comment author receives a notification.
- [ ] A moderator (role-based) can delete any comment regardless of authorship.
- [ ] Soft-delete is used for comments: deleted comments are not returned in listings but the thread structure is preserved (show "comment deleted" placeholder).
- [ ] Comment body is plain text, max 2000 characters; empty and whitespace-only comments are rejected with 400.
- [ ] All comment endpoints require authentication; unauthenticated requests return 401.
- [ ] Pagination for comments: default page size 20, cursor-based or offset-based.

## Edge cases & non-functional

- A user deleting their account: their comments should either be anonymized ("Deleted User") or removed — needs decision.
- Race condition: concurrent replies to the same comment must not corrupt thread order.
- Moderation: flagging / reporting comments is out of scope for this phase but the data model should not preclude it.
- Notifications: only in-app for this phase; email is out of scope.
- Performance: comment count per resource should not require a full table scan; an indexed counter or pre-computed value is preferred.
- Self-notifications: posting a comment on your own resource should NOT generate a notification for yourself.
- Threading depth: strictly one level (comment → replies); no nested replies.

## Out of scope

- Email / push notifications (in-app only).
- Comment reactions / emoji responses.
- Rich text or markdown in comments.
- Comment flagging / reporting (defer to moderation v2).
- Nested threading beyond one level.
- Anonymous comments.

## References

- Session: "[Phase 2] Implement resource commenting and feedback system"
- Branch: `issue-17-phase-2-implement-resource-commenting-a-e40573`
- Related Phase 2 issues: #3 (PostgreSQL schema), #2 (auth/sessions), #7 (likes/saves)
- Phase 2 roadmap context: add collaborative features on top of the MVP resource library

## Raw context used

- User description: "Add a commenting system so teachers can leave feedback, suggestions, and questions on resources. Includes threading, notifications, and moderation tools."
- Repo: Next.js 15 App Router, TypeScript strict, Vitest, PostgreSQL planned (ref: issue #3)

## Enrichment notes

- **Ambiguity:** The README references issue #2 (auth) and #3 (PostgreSQL schema) as prerequisites. This commenting feature depends on both. The enricher will need to confirm whether those foundations exist in code or need to be scaffolded as part of this ticket. blocking: no (safe to assume prerequisites exist conceptually for planning purposes)
- **Ambiguity:** "Moderator" role is not defined in the current codebase. We'll need to design a simple role model. blocking: no (can plan with a `role` enum on the user model)
- **Ambiguity:** Notification delivery mechanism (WebSocket vs polling vs SSE) is not specified. Will default to a simple DB-backed notifications table with polling; real-time can be added later. blocking: no

---
## Original

User request: "Use the agentic-ticket-to-pr skill to implement GitHub issue #17 in CarlosCunha99/teacher-hub. This is a Phase 2 roadmap item. Add a commenting system so teachers can leave feedback, suggestions, and questions on resources. Includes threading, notifications, and moderation tools."
