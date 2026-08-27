# Solution: DB-backed commenting system with Drizzle ORM

## Direction

We are building a full commenting and notification system for the Teacher Hub resource pages. The feature targets the Next.js App Router layer: API routes handle all data access and business logic, while the frontend renders the comment thread and notification badge.

Prerequisites (auth, PostgreSQL schema) do not yet exist in the repo. Rather than blocking, we introduce Drizzle ORM as the project-wide database client for this feature, and stub the auth surface with a `getCurrentUser(request)` utility that returns a fixed development user. This stub is designed to be swapped for real session logic when issue #2 lands.

The data model centers on a `comments` table with a nullable `parent_id` column for one-level threading and a `deleted_at` column for soft deletes. A separate `notifications` table records in-app notification events. Listing uses a single join query returning top-level comments with their replies nested inline; pagination is cursor-based on top-level comments only. The client polls for notifications; no WebSockets.

Moderation is role-based: the `users` table (established in this ticket's schema as a reference for issue #3) carries a `role` column. Comment deletion is available to the comment author, the resource owner, and any user with the moderator/admin role. Deleted comments are retained as placeholders to preserve thread continuity.

## Key decisions

- **Decided to use Drizzle ORM** because the repo has no ORM, Drizzle is TypeScript-native and lightweight, and this ticket's schema becomes the canonical reference for the broader DB work in issue #3.
- **Decided to stub auth with a dev utility** so the feature can be built and tested before issue #2 lands, with a clean seam for replacement.
- **Decided on one-level threading enforced server-side** via a NOT NULL check on the parent row's `parent_id` — attempts to reply to a reply return 400.
- **Decided on a single join query** for listings (top-level + replies) to avoid a second round-trip per thread.
- **Decided on cursor-based pagination** (created_at + id) on top-level comments only.
- **Decided on client polling** for notifications; no real-time push infrastructure needed.
- **Decided soft delete** retains the row but excludes it from normal listings and replaces it with a placeholder, preserving reply anchors.
- **Decided oldest-first ordering** for both top-level comments and replies (stable cursor pagination, standard thread UX).
- **Decided reads require auth** (conservative Phase 2 default; public read would require cache-control and GDPR review).
- **Decided no edit window and no version history** — edits are allowed indefinitely; only an "edited at" timestamp is stored and surfaced.

## Explicitly rejected

- **Prisma**: rejected in favour of Drizzle — lighter, TypeScript-first, better App Router fit.
- **Multiple queries per thread (N+1)**: rejected in favour of a single join query for listings.
- **WebSockets / SSE for notifications**: rejected as out of scope; polling is sufficient for async discussion latency.
- **Newest-first ordering**: rejected — harder to paginate cursorly and inconsistent with forum/thread convention.
- **N-minute edit window**: rejected — no product signal justifying the added complexity.
- **Public (unauthenticated) comment reads**: rejected — conservative Phase 2 default, avoids cache/bot/GDPR complexity.

## Open questions

- **Account deletion behaviour** (Ambiguity A): proposed "Deleted user" placeholder not yet confirmed by product owner.
- **Prerequisite readiness**: whether auth (#2) and DB schema (#3) will be complete at implementation time, or whether this ticket's stubs must serve longer than expected.
