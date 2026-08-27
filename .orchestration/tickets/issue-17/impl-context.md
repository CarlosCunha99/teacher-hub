# Implementation context (shared A/B brief)

## Files this touches

### New files — must create
- `src/lib/auth.ts` — `getCurrentUser` stub; seam for issue #2 real auth
- `src/lib/comments/service.ts` — all business logic: list, create, reply, edit, soft-delete, notifications
- `src/lib/db/index.ts` — Drizzle client singleton (`db` export)
- `src/lib/db/schema.ts` — Drizzle table definitions (`commentsTable`, `notificationsTable`, `usersTable`, `resourcesTable`)
- `src/app/api/resources/[resourceId]/comments/route.ts` — GET + POST handlers
- `src/app/api/resources/[resourceId]/comments/[commentId]/route.ts` — PATCH + DELETE handlers
- `src/app/api/resources/[resourceId]/comments/[commentId]/replies/route.ts` — POST handler
- `src/app/api/notifications/route.ts` — GET handler
- `src/app/api/notifications/[notificationId]/route.ts` — PATCH handler
- `src/components/comments/CommentThread.tsx` — container; fetches + renders paginated comments
- `src/components/comments/CommentCard.tsx` — single comment display with edit/delete controls
- `src/components/comments/ReplyList.tsx` — nested replies under a parent `CommentCard`
- `src/components/comments/CommentComposer.tsx` — textarea + submit; `dir="auto"`, keyboard accessible, client-side length guard
- `src/components/notifications/NotificationBadge.tsx` — unread count badge; polls every 30 s
- `src/components/notifications/NotificationList.tsx` — dropdown; PATCH on click, link to `/resources/:resourceId#comment-:commentId`
- `src/app/resources/[resourceId]/page.tsx` — resource detail shell; mounts `<CommentThread />`
- `drizzle.config.ts` — Drizzle Kit config (dialect `postgresql`, schema `./src/lib/db/schema.ts`, out `./drizzle/migrations`)
- `drizzle/migrations/0001_create_comments_notifications.sql` — initial migration
- `.env.example` — document `DATABASE_URL`

### Modified files — existing
- `package.json` — add `drizzle-orm`, `postgres` to deps; `drizzle-kit` to devDeps; add `db:generate`, `db:migrate` scripts
- `.gitignore` — add `drizzle/` exclusion if not present
- `src/__tests__/env-config.test.ts` — add `DATABASE_URL` to expected-var list if test asserts exact set
- `src/__tests__/scripts.test.ts` — add `db:generate`, `db:migrate` to expected-scripts list if test snapshots script keys

---

## Patterns to follow

### Naming
- Route handler exports: `export async function GET(request: Request): Promise<Response>` — match existing `src/app/api/health/route.ts` convention.
- Use `_request` for unused request params (see health route).
- TypeScript type aliases (not interfaces) for data shapes: `type Comment = { ... }`.
- camelCase for all JSON response field names (`authorId`, `createdAt`, `editedAt`, `readAt`, etc.).
- Error classes in `src/lib/comments/service.ts` (or a shared `src/lib/errors.ts`) with a `code` discriminant for catch-based routing in route handlers.
- Constants in `SCREAMING_SNAKE_CASE` at module top-level.

### Error handling in route handlers
```ts
// canonical pattern — map typed errors to HTTP status codes
try {
  const result = await someServiceFn(params);
  return NextResponse.json(result, { status: 201 });
} catch (err) {
  if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof AuthzError)      return NextResponse.json({ error: err.message }, { status: 403 });
  if (err instanceof NotFoundError)   return NextResponse.json({ error: err.message }, { status: 404 });
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```
Always check `getCurrentUser` first; return `401` before touching the service layer:
```ts
const user = await getCurrentUser(request);
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### Async style
- All service functions are `async`; all return `Promise<T>`.
- Route handlers are `async` and `export`ed as named functions (`GET`, `POST`, `PATCH`, `DELETE`).
- No top-level `await` outside Next.js page/component boundaries.
- Notification calls in route handlers: fire-and-forget (`void createNotificationFor...(...)`) — their failure must NOT affect the HTTP response.

### Drizzle ORM style
- Use the `eq`, `and`, `isNull`, `isNotNull`, `gt`, `lte` helpers from `drizzle-orm`.
- `db.select().from(table).where(...)` for reads; `db.insert(table).values(...).returning()` for inserts; `db.update(table).set(...).where(...).returning()` for updates.
- `db.query.<tableName>.findFirst(...)` is available if relational queries are preferred for joined reads.
- Always use `.returning()` on inserts/updates to get the full row back without a second SELECT.

### Testing style
- Framework: **Vitest 3.x** with `globals: true` (no `import { describe, it, expect }` needed).
- Test files live at `__tests__/route.test.ts` adjacent to the route file being tested (matching `src/app/api/health/__tests__/route.test.ts`).
- Import the handler function directly: `import { GET, POST } from "@/app/api/.../route"`.
- Construct requests with `new Request("http://localhost/path", { method: "POST", body: JSON.stringify({...}), headers: { "content-type": "application/json" } })`.
- Parse responses with `await response.json()`.
- Mock `@/lib/auth` with `vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }))` and cast `getCurrentUser as vi.Mock` to set return values per test.
- Mock `@/lib/db` with `vi.mock("@/lib/db")` returning an in-memory fake; do NOT hit a real Postgres in unit tests.
- Integration tests that need a real DB: gate with `describe.skipIf(!process.env.DATABASE_URL)(...)`.

---

## Utilities to reuse

- `next/server::NextResponse` — `NextResponse.json(body, { status })` for all JSON responses (matches health route).
- `@/lib/auth::getCurrentUser` — call at the top of every route handler; return 401 on null.
- `drizzle-orm::{eq, and, isNull, isNotNull, gt, lte, desc, asc, sql}` — standard query helpers.
- `crypto.randomUUID()` — available in Node 20+ and Edge runtime; use for generating UUIDs in tests/fixtures.

---

## Anti-patterns in this codebase

- **No `dangerouslySetInnerHTML`** — comment body must be rendered as text content only (security requirement called out explicitly in plan).
- **No `eval` or dynamic `import()`** in route handlers.
- **No client-side secret access** — `DATABASE_URL` and `DEV_USER_ID` are server-only; never expose in client components.
- **No global layout mutation for auth-dependent UI yet** — `NotificationBadge` must NOT be added to `src/app/layout.tsx`; leave a `// TODO(auth): mount <NotificationBadge> once issue #2 lands` comment instead.
- **No nested threading** — never allow `createReply` to succeed when `parent.parent_id IS NOT NULL`; enforce in the service, not just the route.
- **No hard deletes** — all comment removal is soft (`deleted_at`); the row stays in the DB.
- **No notification on self** — both `createNotificationForComment` and `createNotificationForReply` must no-op when `actorId === recipientId`.

---

## Repo commands (verified)

- **Test:** `npm test` (runs `vitest run`, full suite)
- **Fast subset:** `npx vitest run src/app/api/resources src/app/api/notifications src/lib/__tests__/auth.test.ts src/lib/db/__tests__/schema.test.ts src/lib/comments`
- **Lint:** `npm run lint` (Next.js ESLint)
- **Format check:** `npm run format:check` (Prettier)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build`
- **DB migration generate:** `npm run db:generate` (add to `package.json` as `drizzle-kit generate`)
- **DB migration apply:** `npm run db:migrate` (add to `package.json` as `drizzle-kit migrate`)
