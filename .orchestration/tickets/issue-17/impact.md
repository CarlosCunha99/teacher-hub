# Impact analysis

## Direct changes

### NEW files — Database layer
- `src/lib/db/index.ts` — Drizzle ORM client initialisation; exports the `db` singleton used by all routes
- `src/lib/db/schema.ts` — Drizzle schema definitions: `users`, `resources`, `comments`, `notifications` tables
- `drizzle.config.ts` — Drizzle Kit configuration (dialect, schema path, migrations directory, connection string)
- `drizzle/migrations/0001_create_comments_notifications.sql` — initial migration: `comments` table (id, resource_id, author_id, parent_id, body, deleted_at, created_at, updated_at) + `notifications` table (id, recipient_id, type, resource_id, comment_id, read_at, created_at)

### NEW files — Auth stub
- `src/lib/auth.ts` — `getCurrentUser(request: Request)` stub; returns a hardcoded dev user; seam for real session logic from issue #2

### NEW files — API routes
- `src/app/api/resources/[resourceId]/comments/route.ts` — `GET` (list comments, paginated, cursor-based) and `POST` (create comment); auth required for both
- `src/app/api/resources/[resourceId]/comments/[commentId]/route.ts` — `PATCH` (edit body) and `DELETE` (soft delete); 403 if not author / resource-owner / moderator
- `src/app/api/resources/[resourceId]/comments/[commentId]/replies/route.ts` — `POST` (create reply); validates parent is top-level; auth required
- `src/app/api/notifications/route.ts` — `GET` (list unread notifications for current user)
- `src/app/api/notifications/[notificationId]/route.ts` — `PATCH` (mark single notification as read)

### NEW files — UI components
- `src/components/comments/CommentThread.tsx` — container; fetches paginated comments, renders list, contains "Load more" trigger
- `src/components/comments/CommentCard.tsx` — single comment display; shows author, timestamp, body, "edited" badge, edit/delete controls if owner
- `src/components/comments/ReplyList.tsx` — renders replies nested under a parent `CommentCard`
- `src/components/comments/CommentComposer.tsx` — textarea + submit for new top-level comments and inline reply forms
- `src/components/notifications/NotificationBadge.tsx` — unread count badge, polls `/api/notifications`
- `src/components/notifications/NotificationList.tsx` — dropdown list of notification items; marks as read on click

### NEW files — Resource detail page (shell)
- `src/app/resources/[resourceId]/page.tsx` — resource detail page shell; mounts `<CommentThread resourceId={resourceId} />`

### NEW files — Tests
- `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts` — unit tests for GET / POST comment endpoint
- `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts` — unit tests for PATCH / DELETE (authz matrix)
- `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.test.ts` — unit tests for POST reply; validates reply-to-reply rejection
- `src/app/api/notifications/__tests__/route.test.ts` — unit tests for GET notifications
- `src/app/api/notifications/[notificationId]/__tests__/route.test.ts` — unit tests for PATCH mark-read
- `src/lib/__tests__/auth.test.ts` — unit tests for auth stub
- `src/lib/db/__tests__/schema.test.ts` — smoke test that schema exports are defined

### MODIFIED files — Existing
- `package.json` — adds runtime and dev dependencies (see "Migrations / config / infra" section)
- `next.config.ts` — no change required initially; may need `serverExternalPackages` for `drizzle-orm` if bundler issues arise (low probability)
- `.gitignore` — add `drizzle/` output folder exclusion guard (migration artefacts)
- `src/__tests__/env-config.test.ts` — likely needs `DATABASE_URL` added to the expected env-var list if the test validates required vars

---

## Indirect: callers & consumers

| Caller / Consumer | Changed thing | Impact |
|---|---|---|
| `src/app/api/health/route.ts` | Nothing — no new dependencies on it | none |
| `src/lib/health.ts` | Nothing — standalone module | none |
| `src/app/layout.tsx` | May mount `<NotificationBadge />` once auth lands; not required now | none (future behavior-change) |
| `src/app/page.tsx` | No changes needed | none |
| `src/__tests__/env-config.test.ts` | `DATABASE_URL` env var is now required at runtime; test may assert known required vars | behavior-change (test may fail if it asserts exact required-var list) |
| `src/__tests__/scripts.test.ts` | `package.json` gains new scripts (`db:generate`, `db:migrate`); test may assert script names | behavior-change (test may fail if it snapshots script keys) |

---

## Public API surface

### Exported: new symbols in new modules
- `db` (default) in `src/lib/db/index.ts` — new export; Drizzle client singleton
- `schema.*` in `src/lib/db/schema.ts` — `usersTable`, `resourcesTable`, `commentsTable`, `notificationsTable` — new exports
- `getCurrentUser` in `src/lib/auth.ts` — new export; async function `(request: Request) => Promise<User>`
- `CommentThread` in `src/components/comments/CommentThread.tsx` — new React component export
- `CommentComposer` in `src/components/comments/CommentComposer.tsx` — new React component export
- `NotificationBadge` in `src/components/notifications/NotificationBadge.tsx` — new React component export

### New HTTP endpoints (API surface)
| Method | Path | Auth required |
|---|---|---|
| GET | `/api/resources/:resourceId/comments` | yes |
| POST | `/api/resources/:resourceId/comments` | yes |
| PATCH | `/api/resources/:resourceId/comments/:commentId` | yes (author / owner / mod) |
| DELETE | `/api/resources/:resourceId/comments/:commentId` | yes (author / owner / mod) |
| POST | `/api/resources/:resourceId/comments/:commentId/replies` | yes |
| GET | `/api/notifications` | yes |
| PATCH | `/api/notifications/:notificationId` | yes |

### Breaking
- None. The only existing endpoint is `GET /api/health`; this feature adds no changes to it.

---

## Tests affected

- `src/__tests__/env-config.test.ts` — may need `DATABASE_URL` added to the required-env list if it asserts a fixed set of required vars
- `src/__tests__/scripts.test.ts` — may need `db:generate` and `db:migrate` added if it snapshots `package.json` scripts
- `src/app/api/health/__tests__/route.test.ts` — no change; health route is untouched
- `src/__tests__/typescript.test.ts` — likely passes unchanged; new TypeScript files must compile cleanly without errors
- `src/__tests__/readme.test.ts` — no change expected unless it asserts feature sections
- `src/__tests__/gitignore.test.ts` — no change unless it asserts specific ignore patterns

### New test files (all added by this feature)
- `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts`
- `src/app/api/resources/[resourceId]/comments/[commentId]/__tests__/route.test.ts`
- `src/app/api/resources/[resourceId]/comments/[commentId]/replies/__tests__/route.test.ts`
- `src/app/api/notifications/__tests__/route.test.ts`
- `src/app/api/notifications/[notificationId]/__tests__/route.test.ts`
- `src/lib/__tests__/auth.test.ts`
- `src/lib/db/__tests__/schema.test.ts`

---

## Docs to update

- `README.md` — add "Commenting system" section under Phase 2 features; document `DATABASE_URL` env var requirement and Drizzle migration commands (`npm run db:generate`, `npm run db:migrate`)

---

## Migrations / config / infra

### npm packages to add (`package.json`)
| Package | Type | Purpose |
|---|---|---|
| `drizzle-orm` | dependency | ORM runtime; SQL query builder |
| `postgres` | dependency | Node.js PostgreSQL driver (used by Drizzle) |
| `drizzle-kit` | devDependency | Drizzle CLI for schema introspection and migration generation |
| `@types/pg` or `@types/postgres` | devDependency | TypeScript types for the driver (if not bundled) |

### `package.json` scripts to add
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

### New config file
- `drizzle.config.ts` (root) — Drizzle Kit config; references `DATABASE_URL`

### Environment variables
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Runtime + CI | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/teacher_hub` |

### `.env.example` / `.env.local.example`
- Should be created (or updated if it exists) to document `DATABASE_URL`

### Database migrations
- `drizzle/migrations/0001_create_comments_notifications.sql` — creates `comments` and `notifications` tables
- A minimal `users` and `resources` reference schema may be included in the migration as stubs for FK integrity (or FKs deferred to issue #3)
- Migration must be run before the app can serve comment endpoints

### CI / infrastructure
- CI pipeline (if any exists) must set `DATABASE_URL` and run `npm run db:migrate` before test runs that exercise DB-touching code
- If tests mock the DB client, no CI DB is needed for unit tests — but integration / e2e tests will require a real (or Docker-based) PostgreSQL instance

---

## External systems

- **PostgreSQL** — new tables `comments` and `notifications` added; reference stubs for `users` and `resources` tables introduced (full schema owned by issue #3). No changes to existing tables.

---

## Estimated diff size

- **Files touched (modified):** 3–4 (package.json, next.config.ts if needed, .gitignore, env-config.test.ts / scripts.test.ts)
- **Files added (new):** ~25–30
  - 5 API route files
  - 6 API test files
  - 3 DB/auth lib files + 2 lib test files
  - 6 UI component files
  - 1 resource page shell
  - 1 Drizzle config
  - 1–2 migration SQL files
  - 1 .env.example update
- **Rough lines changed:** ~1 000–1 500 lines added across new files; ~20–40 lines modified in existing files
- **Confidence:** medium — line estimates based on typical Next.js route handler + Drizzle schema boilerplate; component complexity is uncertain until UX detail is locked

---

## Warnings

1. **Prerequisites not in repo yet.** Auth (issue #2) and the full PostgreSQL schema (issue #3) do not exist. This feature introduces a `getCurrentUser` stub and a minimal schema — but the stub will need replacing before production ship. Any test relying on real session data will need to mock or await issue #2.
2. **Foreign key strategy for `users`/`resources`.** The `comments` table will reference `user_id` and `resource_id`. If those tables do not exist at migration time, the migration must either create stubs or use deferred/disabled FK constraints. This is a planning decision but has schema implications.
3. **`src/__tests__/env-config.test.ts` and `scripts.test.ts` may fail** if they snapshot exact sets of env vars or script keys — they will need updating to include `DATABASE_URL` and `db:generate`/`db:migrate`.
4. **Drizzle vs Prisma blast-radius comparison (for stage 04 rejected alternatives):**
   | Concern | Drizzle ORM | Prisma |
   |---|---|---|
   | Files added | ~2 (schema.ts, drizzle.config.ts) | ~3–4 (schema.prisma, client.ts, generated types folder) |
   | Generated artefacts | SQL migration files in `drizzle/` | Generated JS client in `node_modules/.prisma` + `prisma/migrations/` |
   | Bundle impact | Small (tree-shakeable, no generated client) | Larger (full generated client, query engine binary) |
   | Type safety | TypeScript-native (inferred from schema) | Generated types (re-gen required on schema change) |
   | App Router compatibility | Native (no Prisma Accelerate needed) | Requires Accelerate or edge-compatible adapter for serverless/edge routes |
   | Existing repo fit | Zero config; no Prisma binary to vendor | Would need `prisma generate` in CI and `postinstall` hook |
   | Files modified in package.json | +2 deps | +2 deps + postinstall script |
5. **Comment count index.** The ticket's non-functional requirement states "fetching comment count must not scan all rows." An index on `(resource_id, deleted_at)` — or a separate `comment_counts` denormalization — must be included in the migration. This is easy to miss.
6. **`next.config.ts` may need `serverExternalPackages: ['drizzle-orm', 'postgres']`** if the Next.js bundler attempts to bundle the native PostgreSQL driver. This is a common gotcha with Drizzle + Next.js App Router.
