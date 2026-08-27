# Contract for issue-17

Written by: contract-writer agent
Locked at: 2026-08-27T21:12:42Z
Consumed by: coder, tester, spec-reviewer, diagnoser

---

## Interfaces

### `getCurrentUser`
- **Path:** `src/lib/auth.ts`
- **Signature:**
  ```ts
  export async function getCurrentUser(request: Request): Promise<CurrentUser | null>
  ```
- **Semantics:**
  - Pre-conditions: `request` is a Web API `Request` object.
  - Post-conditions: Returns `CurrentUser` for the active dev user (id from `process.env.DEV_USER_ID`, fallback to a fixed UUID). Returns `null` to represent no session. An `x-test-user` request header (JSON-encoded `CurrentUser | null`) overrides the return value for test injection.
  - Invariants: The returned `id` is always a non-empty UUID string; `role` is always one of `'user' | 'moderator' | 'admin'`.
- **Errors:** Never rejects; always resolves (returns `null` for the no-session case).
- **Side effects:** None.
- **Not in contract:** JWT validation, cookies, real session lookup — those belong to issue #2.

---

### `service.listComments`
- **Path:** `src/lib/comments/service.ts`
- **Signature:**
  ```ts
  export async function listComments(params: {
    resourceId: string;
    cursor?: string | null;
    limit?: number | null;
  }): Promise<PaginatedResult<CommentWithReplies>>
  ```
- **Semantics:**
  - Pre-conditions: `resourceId` is a UUID string. `limit` defaults to `20` when omitted/`null`. `cursor` is an opaque base64 string encoding `<iso-created_at>|<id>` from the last item of the previous page, or `null`/`undefined` for the first page.
  - Post-conditions: Returns up to `limit` top-level comments (`parent_id IS NULL`) for `resourceId`, ordered `(created_at ASC, id ASC)`. Each item includes a `replies` array (non-null, ordered `(created_at ASC, id ASC)`) containing all replies regardless of their `deleted_at` state. Soft-deleted top-level comments appear with `body = "This comment has been deleted"`, `authorId = null`, `authorName = null`; their original body/author is never exposed. `nextCursor` is `null` when no further pages exist.
  - Invariants: Only top-level items in `items`; replies are inlined in `replies`, never at the top level.
- **Errors:** Propagates DB errors unmodified (route handler maps to 500).
- **Side effects:** Read-only DB query.
- **Not in contract:** Authentication — caller must verify the user is authenticated before invoking.

---

### `service.createComment`
- **Path:** `src/lib/comments/service.ts`
- **Signature:**
  ```ts
  export async function createComment(params: {
    resourceId: string;
    authorId: string;
    body: string;
  }): Promise<Comment>
  ```
- **Semantics:**
  - Pre-conditions: `resourceId` and `authorId` are UUID strings. `body` is the raw (untrimmed) input string from the client.
  - Post-conditions: Trims `body`; inserts a new comment row with `parent_id = null`; returns the full populated `Comment` shape. `editedAt` and `deletedAt` are `null` on the returned object.
  - Invariants: Trimmed `body` must be non-empty and ≤ 2000 characters; any violation throws `ValidationError`.
- **Errors:**
  - `ValidationError` — trimmed body is empty or exceeds 2000 chars.
  - DB errors propagated.
- **Side effects:** Inserts one row into `commentsTable`.
- **Not in contract:** Notification creation — handled separately by `createNotificationForComment`.

---

### `service.createReply`
- **Path:** `src/lib/comments/service.ts`
- **Signature:**
  ```ts
  export async function createReply(params: {
    parentId: string;
    authorId: string;
    body: string;
  }): Promise<Comment>
  ```
- **Semantics:**
  - Pre-conditions: `parentId` is the id of the intended parent comment. `authorId` is a UUID. `body` is raw input.
  - Post-conditions: Trims and validates `body` (same rules as `createComment`). Looks up the parent comment by `parentId`; throws `NotFoundError` if not found **or** if `deleted_at IS NOT NULL`. Throws `ValidationError("cannot reply to a reply")` if the parent has a non-null `parent_id`. Otherwise inserts a new comment with `parent_id = parentId` and returns the full `Comment` shape.
  - Invariants: One-level threading only. `replies` array is not included in the returned `Comment`.
- **Errors:**
  - `ValidationError` — body invalid, or parent is itself a reply.
  - `NotFoundError` — parent not found or soft-deleted.
  - DB errors propagated.
- **Side effects:** Inserts one row into `commentsTable`.
- **Not in contract:** Notification creation — handled via `createNotificationForReply`.

---

### `service.editComment`
- **Path:** `src/lib/comments/service.ts`
- **Signature:**
  ```ts
  export async function editComment(params: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<Comment>
  ```
- **Semantics:**
  - Pre-conditions: `commentId` is a UUID of an existing, non-deleted comment. `editorId` is the current user's id. `body` is raw input.
  - Post-conditions: Trims and validates `body`. Verifies `editorId === comment.authorId`; throws `AuthzError` otherwise. Updates `body`, sets `editedAt = NOW()`, `updatedAt = NOW()`. Returns the updated `Comment`.
  - Invariants: Authorization (author-only) is enforced inside this function. Resource-owner and moderator roles may NOT edit — only delete.
- **Errors:**
  - `ValidationError` — body invalid.
  - `NotFoundError` — comment not found or soft-deleted.
  - `AuthzError` — `editorId` is not the `authorId`.
  - DB errors propagated.
- **Side effects:** Updates one row in `commentsTable`.
- **Not in contract:** Moderator/owner edit permission.

---

### `service.softDeleteComment`
- **Path:** `src/lib/comments/service.ts`
- **Signature:**
  ```ts
  export async function softDeleteComment(params: {
    commentId: string;
    actorId: string;
    actorRole: 'user' | 'moderator' | 'admin';
    resourceOwnerId: string;
  }): Promise<void>
  ```
- **Semantics:**
  - Pre-conditions: `commentId` is a UUID. `actorId` is the current user's id. `actorRole` is from `CurrentUser.role`. `resourceOwnerId` is pre-fetched by the route handler from `resourcesTable`.
  - Post-conditions: Sets `deletedAt = NOW()`, `updatedAt = NOW()` on the target row. Returns `void`.
  - Invariants: Authorised when any condition holds: `actorId === comment.authorId` OR `actorId === resourceOwnerId` OR `actorRole` is `'moderator'` or `'admin'`. Throws `AuthzError` if none hold. Does **not** delete replies; they remain and continue to be shown.
- **Errors:**
  - `NotFoundError` — comment not found.
  - `AuthzError` — actor not authorised.
  - DB errors propagated.
- **Side effects:** Updates one row in `commentsTable` (`deletedAt`, `updatedAt`).
- **Not in contract:** Hard delete; cascade-deleting replies; re-deleting an already-deleted comment (idempotent — a second call sets `deletedAt` again; no error).

---

### `service.createNotificationForComment`
- **Path:** `src/lib/comments/service.ts`
- **Signature:**
  ```ts
  export async function createNotificationForComment(params: {
    resourceId: string;
    resourceOwnerId: string;
    commentId: string;
    actorId: string;
  }): Promise<void>
  ```
- **Semantics:**
  - Pre-conditions: All params are UUID strings.
  - Post-conditions: If `actorId === resourceOwnerId`, returns immediately (no-op; self-notification suppressed). Otherwise inserts one row into `notificationsTable` with `recipientId = resourceOwnerId`, `type = 'comment_on_resource'`, `resourceId`, `commentId`, `readAt = null`.
  - Invariants: At most one notification row per call.
- **Errors:** DB errors propagated.
- **Side effects:** Conditionally inserts one row into `notificationsTable`.
- **Not in contract:** Batching, deduplication across multiple comments.

---

### `service.createNotificationForReply`
- **Path:** `src/lib/comments/service.ts`
- **Signature:**
  ```ts
  export async function createNotificationForReply(params: {
    resourceId: string;
    parentCommentAuthorId: string;
    replyCommentId: string;
    actorId: string;
  }): Promise<void>
  ```
- **Semantics:**
  - Pre-conditions: All params are UUID strings.
  - Post-conditions: If `actorId === parentCommentAuthorId`, returns immediately (self-notification suppressed). Otherwise inserts one row with `recipientId = parentCommentAuthorId`, `type = 'reply_to_comment'`, `resourceId`, `commentId = replyCommentId`, `readAt = null`.
  - Invariants: At most one notification row per call.
- **Errors:** DB errors propagated.
- **Side effects:** Conditionally inserts one row into `notificationsTable`.
- **Not in contract:** Notifying the resource owner of the reply (only parent-comment author is notified here).

---

## HTTP API contracts

### `GET /api/resources/[resourceId]/comments`
- **File:** `src/app/api/resources/[resourceId]/comments/route.ts`
- **Auth:** Required — returns `401` if `getCurrentUser` returns `null`.
- **Query params:** `cursor?: string`, `limit?: string` (parsed as integer, clamped to `[1, 100]`, default `20`).
- **Responses:**
  | Status | Body |
  |--------|------|
  | 200 | `PaginatedResult<CommentWithReplies>` |
  | 401 | `{ error: string }` |
  | 500 | `{ error: string }` |

### `POST /api/resources/[resourceId]/comments`
- **File:** `src/app/api/resources/[resourceId]/comments/route.ts`
- **Auth:** Required — `401` if unauthenticated.
- **Request body:** `{ body: string }`
- **Responses:**
  | Status | Body |
  |--------|------|
  | 201 | `Comment` |
  | 400 | `{ error: string }` |
  | 401 | `{ error: string }` |
  | 500 | `{ error: string }` |
- **Side effects on success:** Calls `createNotificationForComment` (fire-and-forget; its failure must not fail the 201 response).

### `PATCH /api/resources/[resourceId]/comments/[commentId]`
- **File:** `src/app/api/resources/[resourceId]/comments/[commentId]/route.ts`
- **Auth:** Required.
- **Request body:** `{ body: string }`
- **Responses:**
  | Status | Body |
  |--------|------|
  | 200 | `Comment` |
  | 400 | `{ error: string }` |
  | 401 | `{ error: string }` |
  | 403 | `{ error: string }` |
  | 404 | `{ error: string }` |
  | 500 | `{ error: string }` |

### `DELETE /api/resources/[resourceId]/comments/[commentId]`
- **File:** `src/app/api/resources/[resourceId]/comments/[commentId]/route.ts`
- **Auth:** Required.
- **Request body:** None.
- **Responses:**
  | Status | Body |
  |--------|------|
  | 204 | (empty) |
  | 401 | `{ error: string }` |
  | 403 | `{ error: string }` |
  | 404 | `{ error: string }` |
  | 500 | `{ error: string }` |
- **Side effects on success:** Soft delete only (`deletedAt` set); replies are preserved.

### `POST /api/resources/[resourceId]/comments/[commentId]/replies`
- **File:** `src/app/api/resources/[resourceId]/comments/[commentId]/replies/route.ts`
- **Auth:** Required.
- **Request body:** `{ body: string }`
- **Responses:**
  | Status | Body |
  |--------|------|
  | 201 | `Comment` |
  | 400 | `{ error: string }` — body invalid OR parent is itself a reply |
  | 401 | `{ error: string }` |
  | 404 | `{ error: string }` — parent not found or soft-deleted |
  | 500 | `{ error: string }` |
- **Side effects on success:** Calls `createNotificationForReply` (fire-and-forget).

### `GET /api/notifications`
- **File:** `src/app/api/notifications/route.ts`
- **Auth:** Required.
- **Query params:** None.
- **Responses:**
  | Status | Body |
  |--------|------|
  | 200 | `{ items: Notification[] }` — only unread (`readAt IS NULL`) for current user, ordered `createdAt DESC` |
  | 401 | `{ error: string }` |
  | 500 | `{ error: string }` |

### `PATCH /api/notifications/[notificationId]`
- **File:** `src/app/api/notifications/[notificationId]/route.ts`
- **Auth:** Required.
- **Request body:** `{}` (empty; server sets `readAt = NOW()`).
- **Responses:**
  | Status | Body |
  |--------|------|
  | 200 | `Notification` (with `readAt` now set) |
  | 401 | `{ error: string }` |
  | 403 | `{ error: string }` — `recipientId !== currentUser.id` |
  | 404 | `{ error: string }` — notification not found |
  | 500 | `{ error: string }` |

---

## Data shapes

```ts
// src/lib/auth.ts
export type CurrentUser = {
  id: string;      // UUID
  name: string;
  role: 'user' | 'moderator' | 'admin';
};

// src/lib/comments/service.ts (or src/lib/comments/types.ts)
export type Comment = {
  id: string;              // UUID
  resourceId: string;      // UUID
  authorId: string | null; // null when soft-deleted
  authorName: string | null; // null when soft-deleted
  parentId: string | null; // null for top-level comments
  body: string;            // "This comment has been deleted" when soft-deleted
  editedAt: string | null; // ISO 8601 timestamp, null if never edited
  deletedAt: string | null; // ISO 8601 timestamp, null if not deleted
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
};

export type CommentWithReplies = Comment & {
  replies: Comment[]; // non-null; empty array when no replies
};

export type Notification = {
  id: string;          // UUID
  recipientId: string; // UUID
  type: 'comment_on_resource' | 'reply_to_comment';
  resourceId: string;  // UUID — for deep-link construction
  commentId: string;   // UUID — the triggering comment/reply id
  readAt: string | null; // ISO 8601 timestamp, null = unread
  createdAt: string;   // ISO 8601 timestamp
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null; // opaque base64 string; null = no more pages
};

// Typed errors thrown by service functions and caught by route handlers
export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthError extends Error {
  readonly code = 'AUTH_ERROR' as const;
  constructor(message = 'Not authenticated') {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthzError extends Error {
  readonly code = 'AUTHZ_ERROR' as const;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthzError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
```

---

## Constants / config keys

| Key | Location | Default | Description |
|-----|----------|---------|-------------|
| `DATABASE_URL` | `process.env.DATABASE_URL` | — (required at runtime) | PostgreSQL connection string, e.g. `postgres://user:pass@host:5432/teacher_hub` |
| `DEV_USER_ID` | `process.env.DEV_USER_ID` | `"00000000-0000-0000-0000-000000000001"` | UUID for the hardcoded dev user returned by `getCurrentUser` |
| `COMMENT_MAX_LENGTH` | constant in `src/lib/comments/service.ts` | `2000` | Maximum allowed character length for a comment/reply body after trimming |
| `COMMENTS_DEFAULT_LIMIT` | constant in `src/lib/comments/service.ts` | `20` | Default and reference page size for comment listing |

---

## Resolved ambiguities

| # | Ambiguity | Resolution | Rationale |
|---|-----------|------------|-----------|
| 1 | `POST .../replies` on a soft-deleted parent: test-plan says "400 or 404, per contract" | **404** | A deleted parent is semantically absent; the reply target does not exist. |
| 2 | `PATCH /api/notifications/:id` when not the recipient: test-plan says "403 or 404, per contract" | **403** | The notification exists; the user just lacks permission. Returning 404 would obscure existence; 403 is correct. |
| 3 | `DELETE` success response code: test-plan says "200 or 204" | **204** (empty body) | Soft-delete has no meaningful response body; 204 is the REST convention for successful no-content operations. |
| 4 | `GET /api/notifications` scope: plan says "unread first, newest-first"; test says "only `read_at IS NULL`" | Returns **only unread** notifications for current user, ordered `createdAt DESC`. | The test-plan's assertion ("excludes already-read") is more specific and consistent with the polling badge use-case; plan's "unread first" is interpreted as "only unread". |
| 5 | `createNotificationForReply` dispatch signature omits `resourceId`; `notificationsTable` has `resource_id` | Added `resourceId` to params. | The notification row schema requires `resource_id` for deep-link construction; the replies route handler already has this from `params.resourceId`. |
| 6 | `softDeleteComment` dispatch signature omits `actorRole`; authorization requires knowing the actor's role | Added `actorRole: 'user' \| 'moderator' \| 'admin'` to params. | Avoids an extra `usersTable` lookup in the service; route handler already has `actorRole` from `getCurrentUser()`. |
