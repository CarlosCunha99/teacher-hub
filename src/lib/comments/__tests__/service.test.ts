/**
 * Unit tests for src/lib/comments/service.ts
 *
 * The implementation does not exist yet — these tests are expected to fail at
 * module resolution in round 1.  They will pass once the coder's work lands.
 *
 * External dependencies (DB, Drizzle helpers, schema) are fully mocked so no
 * real Postgres connection is needed.
 */

// ------------------------------------------------------------------
// Mock: drizzle-orm helpers
// (mocked so that eq/and/isNull etc. do not throw when called with
//  plain string stub values from the schema mock below)
// ------------------------------------------------------------------
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ op: "or", args })),
  isNull: vi.fn((a: unknown) => ({ op: "isNull", a })),
  isNotNull: vi.fn((a: unknown) => ({ op: "isNotNull", a })),
  asc: vi.fn((a: unknown) => ({ op: "asc", a })),
  desc: vi.fn((a: unknown) => ({ op: "desc", a })),
  gt: vi.fn((a: unknown, b: unknown) => ({ op: "gt", a, b })),
  lte: vi.fn((a: unknown, b: unknown) => ({ op: "lte", a, b })),
  inArray: vi.fn((a: unknown, b: unknown) => ({ op: "inArray", a, b })),
  sql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

// ------------------------------------------------------------------
// Mock: DB schema tables
// Column objects are plain stubs — the db mock ignores their values
// and just needs them to be non-undefined for import resolution.
// ------------------------------------------------------------------
vi.mock("@/lib/db/schema", () => ({
  commentsTable: {
    id: "comments.id",
    resourceId: "comments.resource_id",
    authorId: "comments.author_id",
    authorName: "comments.author_name",
    parentId: "comments.parent_id",
    body: "comments.body",
    editedAt: "comments.edited_at",
    deletedAt: "comments.deleted_at",
    createdAt: "comments.created_at",
    updatedAt: "comments.updated_at",
  },
  notificationsTable: {
    id: "notifications.id",
    recipientId: "notifications.recipient_id",
    type: "notifications.type",
    resourceId: "notifications.resource_id",
    commentId: "notifications.comment_id",
    readAt: "notifications.read_at",
    createdAt: "notifications.created_at",
  },
  usersTable: { id: "users.id", name: "users.name" },
  resourcesTable: { id: "resources.id", ownerId: "resources.owner_id" },
}));

// ------------------------------------------------------------------
// Mock: Drizzle db client (@/lib/db)
// Supports the full fluent select chain used by the coder's implementation:
//   db.select().from(t).leftJoin(t2, cond).where(cond).limit(n)
//   db.select().from(t).where(cond).limit(n)
// as well as insert/update/delete chains and the relational query API.
// ------------------------------------------------------------------
const {
  mockDb,
  mockFindFirst,
  mockSelectLimit,
  mockSelectOrderBy,
  mockSelectOrderByResult,
  mockInsertReturning,
  mockInsertValues,
  mockDbInsert,
  mockUpdateReturning,
  mockDbUpdate,
  mockDbDelete,
} = vi.hoisted(() => {
  // findFirst (relational query API)
  const mockFindFirst = vi.fn();

  // select chain terminal: ...where(...).limit(n) → Promise<row[]>
  const mockSelectLimit = vi.fn();
  // orderBy() returns an object that is both awaitable (thenable) and has .limit()
  // The thenable branch is used when listComments awaits replies without a .limit() call.
  const mockSelectOrderByResult = vi.fn();
  const mockSelectOrderByObj = {
    limit: mockSelectLimit,
    then(onFulfilled: (v: unknown) => void, onRejected: (e: unknown) => void) {
      return mockSelectOrderByResult().then(onFulfilled, onRejected);
    },
    catch(onRejected: (e: unknown) => void) {
      return mockSelectOrderByResult().catch(onRejected);
    },
  };
  const mockSelectOrderBy = vi.fn().mockReturnValue(mockSelectOrderByObj);
  // where() returns object with limit() and orderBy()
  const mockSelectWhere = vi
    .fn()
    .mockReturnValue({ limit: mockSelectLimit, orderBy: mockSelectOrderBy });
  // leftJoin() returns object with where()
  const mockSelectLeftJoin = vi.fn().mockReturnValue({ where: mockSelectWhere });
  // from() returns object with where() and leftJoin()
  const mockSelectFrom = vi.fn().mockReturnValue({
    where: mockSelectWhere,
    leftJoin: mockSelectLeftJoin,
  });
  const mockDbSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

  // insert chain: db.insert(table).values(data).returning() → Promise<row[]>
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockDbInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  // update chain: db.update(table).set(data).where(condition).returning() → Promise<row[]>
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  // delete chain (should NEVER be called — soft deletes use update)
  const mockDbDeleteWhere = vi.fn().mockResolvedValue([]);
  const mockDbDelete = vi.fn().mockReturnValue({ where: mockDbDeleteWhere });

  const mockDb = {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    query: {
      commentsTable: { findFirst: mockFindFirst },
      notificationsTable: { findFirst: mockFindFirst },
    },
  };

  return {
    mockDb,
    mockFindFirst,
    mockSelectLimit,
    mockSelectOrderBy,
    mockSelectOrderByResult,
    mockInsertReturning,
    mockInsertValues,
    mockDbInsert,
    mockUpdateReturning,
    mockDbUpdate,
    mockDbDelete,
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

// ------------------------------------------------------------------
// Imports under test (assume implementation will exist per contract)
// ------------------------------------------------------------------
import {
  createComment,
  createReply,
  editComment,
  listComments,
  softDeleteComment,
  createNotificationForComment,
  createNotificationForReply,
  ValidationError,
  AuthzError,
  NotFoundError,
} from "@/lib/comments/service";

// ------------------------------------------------------------------
// Shared fixtures
// ------------------------------------------------------------------
const RESOURCE_ID = "10000000-0000-0000-0000-000000000000";
const AUTHOR_ID = "a0000000-0000-0000-0000-000000000000";
const OTHER_USER_ID = "b0000000-0000-0000-0000-000000000000";
const RESOURCE_OWNER_ID = "c0000000-0000-0000-0000-000000000000";
const COMMENT_ID = "d0000000-0000-0000-0000-000000000000";
const PARENT_COMMENT_ID = "e0000000-0000-0000-0000-000000000000";
const NOW = new Date().toISOString();

/** A row shaped to satisfy the Comment contract (camelCase, matching Drizzle output). */
const makeCommentRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: COMMENT_ID,
  resourceId: RESOURCE_ID,
  resource_id: RESOURCE_ID,
  authorId: AUTHOR_ID,
  author_id: AUTHOR_ID,
  authorName: "Test User",
  author_name: "Test User",
  parentId: null,
  parent_id: null,
  body: "A valid comment",
  editedAt: null,
  edited_at: null,
  deletedAt: null,
  deleted_at: null,
  createdAt: NOW,
  created_at: NOW,
  updatedAt: NOW,
  updated_at: NOW,
  ...overrides,
});

/**
 * The shape returned by getCommentById — the leftJoin select uses
 *   db.select({ comment: commentsTable, user: { name: usersTable.name } })
 * so Drizzle returns { comment: <commentsRow>, user: { name: string | null } }.
 */
const makeGetCommentByIdRow = (
  commentOverrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  comment: {
    id: COMMENT_ID,
    resourceId: RESOURCE_ID,
    authorId: AUTHOR_ID,
    parentId: null,
    body: "A valid comment",
    editedAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...commentOverrides,
  },
  user: { name: "Test User" },
});

// ------------------------------------------------------------------
// Per-test mock reset
// ------------------------------------------------------------------

/** Minimal user row for the author-lookup select used by createComment. */
const makeUserRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: AUTHOR_ID,
  name: "Test User",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default terminal returns after clearAllMocks.
  // Default select uses the nested getCommentById shape (softDelete, edit, createReply).
  mockSelectLimit.mockResolvedValue([makeGetCommentByIdRow()]);
  mockSelectOrderByResult.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue(undefined);
  mockInsertReturning.mockResolvedValue([makeCommentRow()]);
  mockUpdateReturning.mockResolvedValue([makeCommentRow()]);
});

// ==================================================================
// 0. listComments
// ==================================================================
describe("listComments", () => {
  // ----------------------------------------------------------------
  // 0a. Nested replies structure
  // ----------------------------------------------------------------
  it("nests replies under their parent — reply is NOT at top level", async () => {
    const parentId = "parent-00000000-0000-0000-0000-000000000001";
    const replyId = "reply-000000000-0000-0000-0000-000000000002";

    const parentRow = makeGetCommentByIdRow({ id: parentId, parentId: null });
    const replyRow = makeGetCommentByIdRow({
      id: replyId,
      parentId,
      authorId: OTHER_USER_ID,
      body: "A reply",
    });

    // First select: top-level comments (no hasMore — 1 row < limit+1)
    mockSelectLimit.mockResolvedValueOnce([parentRow]);
    // Second select: replies for those parents
    mockSelectOrderByResult.mockResolvedValueOnce([replyRow]);

    const result = await listComments({ resourceId: RESOURCE_ID });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(parentId);
    expect(result.items[0].replies).toHaveLength(1);
    expect(result.items[0].replies[0].id).toBe(replyId);
  });

  // ----------------------------------------------------------------
  // 0b. Soft-deleted placeholder
  // ----------------------------------------------------------------
  it("replaces soft-deleted comment body/author with placeholder values", async () => {
    const deletedRow = makeGetCommentByIdRow({
      deletedAt: NOW,
      body: "Original body that should be hidden",
    });

    mockSelectLimit.mockResolvedValueOnce([deletedRow]);
    mockSelectOrderByResult.mockResolvedValueOnce([]);

    const result = await listComments({ resourceId: RESOURCE_ID });

    expect(result.items[0].body).toBe("This comment has been deleted");
    expect(result.items[0].authorId).toBeNull();
    expect(result.items[0].authorName).toBeNull();
  });

  // ----------------------------------------------------------------
  // 0c. Cursor / pagination
  // ----------------------------------------------------------------
  it("returns non-null nextCursor when more items exist beyond the current page", async () => {
    const limit = 2;
    // Returning limit+1 rows signals "there is a next page"
    const rows = [
      makeGetCommentByIdRow({ id: "id-1", createdAt: NOW }),
      makeGetCommentByIdRow({ id: "id-2", createdAt: NOW }),
      makeGetCommentByIdRow({ id: "id-3", createdAt: NOW }),
    ];

    mockSelectLimit.mockResolvedValueOnce(rows);
    mockSelectOrderByResult.mockResolvedValueOnce([]);

    const result = await listComments({ resourceId: RESOURCE_ID, limit });

    expect(result.nextCursor).not.toBeNull();
    expect(result.items).toHaveLength(limit);
  });

  it("returns null nextCursor on the last page", async () => {
    const limit = 2;
    const rows = [
      makeGetCommentByIdRow({ id: "id-1", createdAt: NOW }),
      makeGetCommentByIdRow({ id: "id-2", createdAt: NOW }),
    ];

    mockSelectLimit.mockResolvedValueOnce(rows);
    mockSelectOrderByResult.mockResolvedValueOnce([]);

    const result = await listComments({ resourceId: RESOURCE_ID, limit });

    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(2);
  });

  // ----------------------------------------------------------------
  // 0d. Default limit — must NOT pass vacuously
  // ----------------------------------------------------------------
  it("fetches limit+1 rows using COMMENTS_DEFAULT_LIMIT (20) when limit is omitted", async () => {
    // Return empty list so the replies query is skipped
    mockSelectLimit.mockResolvedValueOnce([]);

    await listComments({ resourceId: RESOURCE_ID });

    // The implementation does .limit(limit + 1) — with default 20 that is 21
    expect(mockSelectLimit).toHaveBeenCalledWith(21);
  });
});

// ==================================================================
// ==================================================================
describe("body validation", () => {
  // Using createComment as the canonical validation surface; the same
  // rules apply to createReply and editComment per the contract.
  describe("createComment", () => {
    it("throws ValidationError for an empty string body", async () => {
      await expect(
        createComment({ resourceId: RESOURCE_ID, authorId: AUTHOR_ID, body: "" })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for a whitespace-only body", async () => {
      await expect(
        createComment({
          resourceId: RESOURCE_ID,
          authorId: AUTHOR_ID,
          body: "   \n\t   ",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for a body of 2001 characters", async () => {
      await expect(
        createComment({
          resourceId: RESOURCE_ID,
          authorId: AUTHOR_ID,
          body: "a".repeat(2001),
        })
      ).rejects.toThrow(ValidationError);
    });

    it("succeeds (does not throw) for a body of exactly 2000 characters", async () => {
      // createComment first looks up the author; give it a valid user row
      mockSelectLimit.mockResolvedValueOnce([makeUserRow()]);
      await expect(
        createComment({
          resourceId: RESOURCE_ID,
          authorId: AUTHOR_ID,
          body: "a".repeat(2000),
        })
      ).resolves.not.toBeUndefined();
    });

    it("succeeds for a valid non-empty body", async () => {
      // createComment first looks up the author; give it a valid user row
      mockSelectLimit.mockResolvedValueOnce([makeUserRow()]);
      const result = await createComment({
        resourceId: RESOURCE_ID,
        authorId: AUTHOR_ID,
        body: "  Great resource!  ",
      });
      expect(result).toBeDefined();
    });

    it("passes the trimmed body to the db insert, not the original padded string", async () => {
      mockSelectLimit.mockResolvedValueOnce([makeUserRow()]);

      await createComment({
        resourceId: RESOURCE_ID,
        authorId: AUTHOR_ID,
        body: "  Great resource!  ",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ body: "Great resource!" })
      );
    });
  });
});

// ==================================================================
// 2. createReply — threading enforcement
// ==================================================================
describe("createReply — threading enforcement", () => {
  it("throws ValidationError with 'cannot reply to a reply' when the parent is itself a reply", async () => {
    // parent.comment.parentId is non-null → threading violation
    const parentAsReply = makeGetCommentByIdRow({
      id: PARENT_COMMENT_ID,
      parentId: "some-grandparent-id",
    });
    mockSelectLimit.mockResolvedValue([parentAsReply]);

    await expect(
      createReply({ parentId: PARENT_COMMENT_ID, authorId: AUTHOR_ID, body: "hello" })
    ).rejects.toThrow(ValidationError);

    await expect(
      createReply({ parentId: PARENT_COMMENT_ID, authorId: AUTHOR_ID, body: "hello" })
    ).rejects.toThrow("cannot reply to a reply");
  });

  it("throws NotFoundError when the parent comment is soft-deleted", async () => {
    // parent.comment.deletedAt is set → effectively "not found"
    const deletedParent = makeGetCommentByIdRow({
      id: PARENT_COMMENT_ID,
      parentId: null,
      deletedAt: NOW,
    });
    mockSelectLimit.mockResolvedValue([deletedParent]);

    await expect(
      createReply({ parentId: PARENT_COMMENT_ID, authorId: AUTHOR_ID, body: "hello" })
    ).rejects.toThrow(NotFoundError);
  });
});

// ==================================================================
// 2b. createReply — happy path
// ==================================================================
describe("createReply — happy path", () => {
  it("inserts a reply with the correct parentId when the parent is a top-level comment", async () => {
    // First select: getCommentById returns a top-level parent (parentId: null)
    mockSelectLimit
      .mockResolvedValueOnce([makeGetCommentByIdRow({ id: PARENT_COMMENT_ID, parentId: null })])
      .mockResolvedValueOnce([makeUserRow()]);

    const replyRow = makeCommentRow({ id: "reply-id", parentId: PARENT_COMMENT_ID });
    mockInsertReturning.mockResolvedValueOnce([replyRow]);

    const result = await createReply({
      parentId: PARENT_COMMENT_ID,
      authorId: AUTHOR_ID,
      body: "Nice reply!",
    });

    expect(result.parentId).toBe(PARENT_COMMENT_ID);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: PARENT_COMMENT_ID })
    );
  });
});

// ==================================================================
// 3. softDeleteComment — soft-delete behaviour & auth matrix
// ==================================================================
describe("softDeleteComment", () => {
  const commentJoinRow = makeGetCommentByIdRow({ authorId: AUTHOR_ID });
  const deletedJoinRow = makeGetCommentByIdRow({ authorId: AUTHOR_ID, deletedAt: NOW });

  beforeEach(() => {
    mockSelectLimit.mockResolvedValue([commentJoinRow]);
    mockUpdateReturning.mockResolvedValue([makeCommentRow({ deletedAt: NOW })]);
  });

  // ----------------------------------------------------------------
  // 3a. Soft-delete sets deletedAt and does NOT hard-delete
  // ----------------------------------------------------------------
  it("calls db.update (not db.delete) to set deletedAt", async () => {
    await softDeleteComment({
      commentId: COMMENT_ID,
      actorId: AUTHOR_ID,
      actorRole: "user",
      resourceOwnerId: RESOURCE_OWNER_ID,
    });

    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbDelete).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // 3b. Auth matrix — allowed actors
  // ----------------------------------------------------------------
  it("allows the comment author to delete their own comment", async () => {
    await expect(
      softDeleteComment({
        commentId: COMMENT_ID,
        actorId: AUTHOR_ID, // matches comment.authorId
        actorRole: "user",
        resourceOwnerId: RESOURCE_OWNER_ID,
      })
    ).resolves.toBeUndefined();
  });

  it("allows the resource owner to delete any comment on their resource", async () => {
    await expect(
      softDeleteComment({
        commentId: COMMENT_ID,
        actorId: RESOURCE_OWNER_ID, // matches resourceOwnerId, not authorId
        actorRole: "user",
        resourceOwnerId: RESOURCE_OWNER_ID,
      })
    ).resolves.toBeUndefined();
  });

  it("allows a moderator to delete any comment regardless of ownership", async () => {
    await expect(
      softDeleteComment({
        commentId: COMMENT_ID,
        actorId: OTHER_USER_ID, // unrelated to author & owner
        actorRole: "moderator", // role alone grants permission
        resourceOwnerId: RESOURCE_OWNER_ID,
      })
    ).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3c. Auth matrix — forbidden actor
  // ----------------------------------------------------------------
  it("throws AuthzError for a stranger (unrelated user, role=user)", async () => {
    await expect(
      softDeleteComment({
        commentId: COMMENT_ID,
        actorId: OTHER_USER_ID, // ≠ authorId, ≠ resourceOwnerId
        actorRole: "user", // not moderator/admin
        resourceOwnerId: RESOURCE_OWNER_ID,
      })
    ).rejects.toThrow(AuthzError);
  });
});

// ==================================================================
// 4. editComment — author-only authorization
// ==================================================================
describe("editComment — authorization", () => {
  it("throws AuthzError when the editor is not the comment author", async () => {
    // existing.comment.authorId = AUTHOR_ID; editorId = OTHER_USER_ID → mismatch
    mockSelectLimit.mockResolvedValue([makeGetCommentByIdRow({ authorId: AUTHOR_ID })]);

    await expect(
      editComment({
        commentId: COMMENT_ID,
        editorId: OTHER_USER_ID, // different user — not the author
        body: "an edited body",
      })
    ).rejects.toThrow(AuthzError);
  });
});

// ==================================================================
// 5. Notification self-suppression & positive path
// ==================================================================
describe("notification self-suppression", () => {
  it("createNotificationForComment does NOT insert when actorId === resourceOwnerId", async () => {
    // actorId and resourceOwnerId are intentionally identical
    await createNotificationForComment({
      resourceId: RESOURCE_ID,
      resourceOwnerId: AUTHOR_ID,
      commentId: COMMENT_ID,
      actorId: AUTHOR_ID,
    });

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("createNotificationForComment DOES insert with correct args when actorId !== resourceOwnerId", async () => {
    await createNotificationForComment({
      resourceId: RESOURCE_ID,
      resourceOwnerId: RESOURCE_OWNER_ID,
      commentId: COMMENT_ID,
      actorId: AUTHOR_ID, // AUTHOR_ID !== RESOURCE_OWNER_ID
    });

    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: RESOURCE_OWNER_ID,
        type: "comment_on_resource",
        resourceId: RESOURCE_ID,
        commentId: COMMENT_ID,
      })
    );
  });

  it("createNotificationForReply does NOT insert when actorId === parentCommentAuthorId", async () => {
    // actorId and parentCommentAuthorId are intentionally identical
    await createNotificationForReply({
      resourceId: RESOURCE_ID,
      parentCommentAuthorId: AUTHOR_ID,
      replyCommentId: COMMENT_ID,
      actorId: AUTHOR_ID,
    });

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("createNotificationForReply DOES insert with correct args when actorId !== parentCommentAuthorId", async () => {
    const REPLY_ID = "f0000000-0000-0000-0000-000000000000";

    await createNotificationForReply({
      resourceId: RESOURCE_ID,
      parentCommentAuthorId: RESOURCE_OWNER_ID, // RESOURCE_OWNER_ID !== AUTHOR_ID
      replyCommentId: REPLY_ID,
      actorId: AUTHOR_ID,
    });

    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: RESOURCE_OWNER_ID,
        type: "reply_to_comment",
        resourceId: RESOURCE_ID,
        commentId: REPLY_ID,
      })
    );
  });
});
