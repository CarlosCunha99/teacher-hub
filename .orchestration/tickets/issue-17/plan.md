# Implementation plan

## Goal
A signed-in teacher can post, reply to, edit, and (soft-)delete comments on a resource detail page and receive in-app notifications, backed by Drizzle ORM against PostgreSQL.

## Approach
This is greenfield on a Next.js 15 App Router skeleton. We introduce Drizzle ORM as the DB layer and a `getCurrentUser` stub as the auth seam (both designed to be replaced when issues #2 and #3 land). The schema owns two real feature tables (`comments`, `notifications`) plus two minimal reference stubs (`users_stub`, `resources_stub`) sized only for FK integrity in this ticket.

The server surface is a set of App Router route handlers under `src/app/api/...`. All handlers call `getCurrentUser(request)` first, then delegate to Drizzle queries. Business rules — one-level threading, soft delete, self-notification suppression, role/owner-based authorization — live in the route handlers (or a small `src/lib/comments/` service module) so they are testable without HTTP.

The UI is a set of client components under `src/components/comments/` and `src/components/notifications/`, mounted from a new resource detail page shell. Comment listing uses a single cursor-paginated GET returning top-level comments with their `replies` inlined. Notifications are polled.

Bring-up order: dependencies + config first, then schema + migration, then auth stub, then routes, then UI, then wire the page shell and README.

## Steps

1. **Add dependencies and scripts** — Update `package.json`: add `drizzle-orm`, `postgres` to `dependencies`; add `drizzle-kit`, `@types/pg` to `devDependencies`; add scripts `"db:generate": "drizzle-kit generate"` and `"db:migrate": "drizzle-kit migrate"`. Add `DATABASE_URL` to `.env.example` (create if absent). Depends on: none.

2. **Add Drizzle config + DB client** — Create `drizzle.config.ts` at repo root (dialect `postgresql`, schema `./src/lib/db/schema.ts`, out `./drizzle/migrations`, reads `process.env.DATABASE_URL`). Create `src/lib/db/index.ts` exporting a lazily-initialised `db` singleton built from `postgres(process.env.DATABASE_URL!)` + `drizzle(client, { schema })`. Add `drizzle/` build outputs to `.gitignore` guard as needed. Depends on: step 1.

3. **Define schema** — Create `src/lib/db/schema.ts` with:
   - `usersTable` (stub): `id uuid pk`, `name text`, `role text default 'user'` (values: `user` | `moderator` | `admin`), `created_at timestamptz`.
   - `resourcesTable` (stub): `id uuid pk`, `owner_id uuid fk users.id`, `title text`, `created_at timestamptz`.
   - `commentsTable`: `id uuid pk`, `resource_id uuid fk resources.id on delete cascade`, `author_id uuid fk users.id`, `parent_id uuid nullable fk comments.id`, `body text not null`, `edited_at timestamptz nullable`, `deleted_at timestamptz nullable`, `created_at timestamptz`, `updated_at timestamptz`. Indexes: `(resource_id, parent_id, created_at)` and `(resource_id, deleted_at)` for count queries.
   - `notificationsTable`: `id uuid pk`, `recipient_id uuid fk users.id`, `type text` (`comment_on_resource` | `reply_to_comment`), `resource_id uuid`, `comment_id uuid`, `read_at timestamptz nullable`, `created_at timestamptz`. Index: `(recipient_id, read_at, created_at desc)`.
   Depends on: step 2.

4. **Generate initial migration** — Run `npm run db:generate` to produce `drizzle/migrations/0001_*.sql`; rename to `0001_create_comments_notifications.sql` if drizzle-kit uses a hash suffix and commit alongside its `_journal.json` / `_snapshot.json`. Verify the SQL creates all four tables + indexes and no destructive statements. Depends on: step 3. **Checkpoint: verify migration SQL matches schema before proceeding.**

5. **Auth stub** — Create `src/lib/auth.ts` exporting `type CurrentUser = { id: string; name: string; role: 'user' | 'moderator' | 'admin' }` and `async function getCurrentUser(request: Request): Promise<CurrentUser | null>`. Returns a hardcoded dev user (id from `process.env.DEV_USER_ID` fallback to a fixed UUID) unless a header like `x-test-user` overrides it (used by tests to simulate anonymous / moderator / other-user). Depends on: none (can run parallel to 2–4).

6. **Comments service module** — Create `src/lib/comments/service.ts` with pure functions used by routes: `listComments({ resourceId, cursor, limit })`, `createComment({...})`, `createReply({...})` (rejects if parent has non-null `parent_id`), `editComment({...})`, `softDeleteComment({...})` (authorization: author OR resource owner OR user with role `moderator`/`admin`), `createNotificationForComment(...)`, `createNotificationForReply(...)` (both skip when actor === recipient). Body validation: trim, non-empty, ≤ 2000 chars — throw a typed `ValidationError` handled by routes as 400. Depends on: steps 3, 5.

7a. **Comments list + create route** — Create `src/app/api/resources/[resourceId]/comments/route.ts` with `GET` (401 if no user; cursor-paginated top-level comments with `replies` array inlined; default `limit=20`, oldest-first) and `POST` (401 if no user; validate body; call `createComment`; fire `createNotificationForComment`; return 201 with the created comment). Depends on: step 6.

7b. **Comment edit + delete route** — Create `src/app/api/resources/[resourceId]/comments/[commentId]/route.ts` with `PATCH` (401/403/400/404 as appropriate; sets `edited_at`) and `DELETE` (401/403/404; soft delete via `deleted_at`). Depends on: step 6.

7c. **Replies route** — Create `src/app/api/resources/[resourceId]/comments/[commentId]/replies/route.ts` with `POST` (401; 400 if parent is itself a reply; 404 if parent missing/deleted; fires `createNotificationForReply`). Depends on: step 6.

7d. **Notifications routes** — Create `src/app/api/notifications/route.ts` (`GET` returns current user's notifications, unread first, newest-first) and `src/app/api/notifications/[notificationId]/route.ts` (`PATCH` marks single notification read; 403 if not recipient). Depends on: step 6.

8. **UI components** — Create client components under `src/components/`:
   - `comments/CommentThread.tsx` — fetches `GET /api/resources/:resourceId/comments`, renders list + `CommentComposer` + "Load more" using the returned cursor.
   - `comments/CommentCard.tsx` — author, timestamp, body (rendered as text — never `dangerouslySetInnerHTML`), "edited" badge when `edited_at`, edit/delete controls guarded by current user identity, inline reply toggle.
   - `comments/ReplyList.tsx` — renders nested replies from parent's `replies` field.
   - `comments/CommentComposer.tsx` — textarea + submit, client-side length check (mirrors server 2000-char cap), keyboard-accessible, labelled for screen readers, RTL-safe (`dir="auto"` on textarea and rendered body).
   - `notifications/NotificationBadge.tsx` — polls `GET /api/notifications` every 30s, shows unread count.
   - `notifications/NotificationList.tsx` — dropdown; clicking an item `PATCH`es it read and links to `/resources/:resourceId#comment-:commentId`.
   Depends on: step 7 (any of 7a–7d) so the API contract is settled.

9. **Resource detail page shell** — Create `src/app/resources/[resourceId]/page.tsx` (server component) that renders a minimal header and mounts `<CommentThread resourceId={params.resourceId} />`. Do **not** mount `NotificationBadge` in `src/app/layout.tsx` yet — real auth (issue #2) is a prerequisite for a global mount; leave a `TODO(auth)` comment referencing issue #2. Depends on: step 8.

10. **README + existing test updates** — README: add a "Commenting system" subsection under Phase 2, document `DATABASE_URL`, `npm run db:generate`, `npm run db:migrate`. If `src/__tests__/env-config.test.ts` or `src/__tests__/scripts.test.ts` assert exact env-var / script sets, update those assertions to include `DATABASE_URL`, `db:generate`, `db:migrate`. Add `serverExternalPackages: ['postgres']` to `next.config.ts` only if `npm run build` reports bundling issues (otherwise leave unchanged). Depends on: steps 1, 7.

## Files

### Create
- `drizzle.config.ts` — Drizzle Kit config
- `drizzle/migrations/0001_create_comments_notifications.sql` (+ `_journal.json`, `_snapshot.json`) — initial migration
- `.env.example` — document `DATABASE_URL` (create or extend)
- `src/lib/db/index.ts` — Drizzle client singleton
- `src/lib/db/schema.ts` — table definitions
- `src/lib/auth.ts` — `getCurrentUser` stub
- `src/lib/comments/service.ts` — business logic used by routes
- `src/app/api/resources/[resourceId]/comments/route.ts` — GET + POST
- `src/app/api/resources/[resourceId]/comments/[commentId]/route.ts` — PATCH + DELETE
- `src/app/api/resources/[resourceId]/comments/[commentId]/replies/route.ts` — POST
- `src/app/api/notifications/route.ts` — GET
- `src/app/api/notifications/[notificationId]/route.ts` — PATCH
- `src/components/comments/CommentThread.tsx`
- `src/components/comments/CommentCard.tsx`
- `src/components/comments/ReplyList.tsx`
- `src/components/comments/CommentComposer.tsx`
- `src/components/notifications/NotificationBadge.tsx`
- `src/components/notifications/NotificationList.tsx`
- `src/app/resources/[resourceId]/page.tsx` — resource detail shell

### Modify
- `package.json` — add deps + `db:generate`/`db:migrate` scripts
- `README.md` — document commenting feature + DB commands + `DATABASE_URL`
- `src/__tests__/env-config.test.ts` — only if it asserts an exact required-var set
- `src/__tests__/scripts.test.ts` — only if it snapshots script keys
- `.gitignore` — guard drizzle build artefacts if needed
- `next.config.ts` — only if the build actually fails without `serverExternalPackages`

### Delete
- None.

## Data / schema / migration
Introduces four tables (`users_stub`, `resources_stub`, `comments`, `notifications`) via a single new migration. No pre-existing tables to migrate. FKs from `comments`/`notifications` reference the stub tables; when issue #3 lands, its migration is expected to rename/replace the stubs (planner for that ticket owns the reconciliation). Backward compatibility is trivial: no existing DB state.

## Rollout
- Feature flag: **no**. Feature lives behind an unused route/page shell; it is inert until surfaced.
- Backfill: **no** — no prior data exists.
- Ordering: `DATABASE_URL` must be set and `npm run db:migrate` must run before any comment endpoint is exercised. CI: add a Postgres service and run `db:migrate` before tests only if integration tests hit a real DB; unit tests mock the Drizzle client.

## Assumptions and non-decisions
- Coder decides whether Drizzle queries in tests are mocked (spy on `db`) or hit a real Postgres via `pg-mem` / testcontainers — pick the lightest option that satisfies the test planner's needs.
- Coder chooses cursor encoding for pagination (e.g. base64(`created_at|id`)); ordering is oldest-first, tie-break on `id`.
- Coder decides exact wire shape for the listing response (recommendation: `{ items: Comment[], nextCursor: string | null }` where each top-level `Comment` has `replies: Comment[]`).
- The dev user's UUID and moderator override mechanism in the auth stub are the coder's call; document whatever they pick in `src/lib/auth.ts`.
- No tests are written in this stage — the test planner is producing `test-plan.md` in parallel; the coder will follow that.

## Not doing
- No email/push notifications, no WebSockets/SSE, no reactions, no markdown/rich text, no flagging/reporting, no rate limiting, no comment search, no nested threading beyond one level, no real auth (issue #2), no real user/resource schema (issue #3), no mounting `NotificationBadge` in the global layout yet.
