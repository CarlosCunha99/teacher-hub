# Brainstorm — issue-17

Autopilot mode: the orchestrator leads the brainstorm on behalf of the developer, since no human is present. The transcript captures the reasoning used to establish a technical direction.

---

### 2026-08-27T21:05 — dev

The codebase is a fresh Next.js 15 skeleton with no database, no auth, no resource model — just a health endpoint. The commenting system is Phase 2, meaning we're building on top of prerequisites that are planned but not yet implemented.

Given that context, my instinct is to design the full commenting system properly — schema, API, UI — but stub the prerequisites (auth user, resource model) with simple in-memory or placeholder implementations so we can build and test the feature in isolation. The feature itself is then ready to slot in when #2 (auth) and #3 (DB schema) are done.

For the data model: a `comments` table with a nullable `parent_id` column for one-level threading, plus a `notifications` table. Soft delete via a `deleted_at` column.

For the API: Next.js App Router API routes under `/api/resources/[resourceId]/comments` and `/api/comments/[commentId]`.

For notifications: a simple DB-backed table. Client polls the `/api/notifications` endpoint. No WebSockets.

Let me think through the threading: if I use `parent_id` on the same `comments` table, then "one level" means I reject attempts to reply to a row where `parent_id IS NOT NULL`. That's simple and enforces the threading rule server-side.

---

### 2026-08-27T21:05 — agent

The parent_id approach is clean for one-level threading — enforcement is a single NOT NULL check on the parent row. Worth confirming: how will you handle listing? Loading all top-level comments + a JOIN for their replies in one query is feasible; alternatively, the client makes a second call per visible comment thread. Given Phase 2 scope, a single query with nested replies (either a recursive CTE or a join with aggregation) seems right.

What database client are you planning to use? Since there's no ORM yet in the repo, Prisma or a lightweight query builder like Drizzle would need to be added — that's a real decision point since it affects how the schema and queries are written for the whole codebase, not just this feature.

---

### 2026-08-27T21:05 — dev

Good point on the DB client. Since the README references issue #3 for "PostgreSQL schema" and the repo has no ORM at all, I'll introduce Drizzle ORM — it's TypeScript-native, lightweight, and has strong Next.js App Router support. The schema for this feature (comments + notifications) becomes the reference for the rest of the DB work in #3.

For listing: a single query joining top-level comments with their replies (using LEFT JOIN on parent_id) is the right call. Response shape: array of comment objects, each with a nested `replies: Comment[]` array. Pagination is on the top-level comments only (cursor-based by created_at + id).

For auth: I'll define a `getCurrentUser(request)` utility in `src/lib/auth.ts` that returns a stubbed user in development and will be replaced by real session logic from #2. This lets us build + test the feature without waiting.

For the moderator role: a `role` column (`'teacher' | 'moderator' | 'admin'`) on the future `users` table. For this ticket, we define the column in the stub user type and add the schema column.

I'm satisfied with this direction. Let's go with this.

