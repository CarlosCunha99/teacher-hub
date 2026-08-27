import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { commentsTable, notificationsTable, usersTable } from "@/lib/db/schema";

export type Comment = {
  id: string;
  resourceId: string;
  authorId: string | null;
  authorName: string | null;
  parentId: string | null;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentWithReplies = Comment & {
  replies: Comment[];
};

export type Notification = {
  id: string;
  recipientId: string;
  type: "comment_on_resource" | "reply_to_comment";
  resourceId: string;
  commentId: string;
  readAt: string | null;
  createdAt: string;
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthError extends Error {
  readonly code = "AUTH_ERROR" as const;

  constructor(message = "Not authenticated") {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthzError extends Error {
  readonly code = "AUTHZ_ERROR" as const;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthzError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;

  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export const COMMENT_MAX_LENGTH = 2000;
export const COMMENTS_DEFAULT_LIMIT = 20;
const DELETED_COMMENT_BODY = "This comment has been deleted";

type CommentJoinRow = {
  comment: typeof commentsTable.$inferSelect;
  user: Pick<typeof usersTable.$inferSelect, "name"> | null;
};

type CursorParts = {
  createdAt: string;
  id: string;
};

function normalizeBody(body: string): string {
  const trimmed = body.trim();

  if (trimmed.length === 0) {
    throw new ValidationError("comment body cannot be empty");
  }

  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new ValidationError(`comment body must be ${COMMENT_MAX_LENGTH} characters or fewer`);
  }

  return trimmed;
}

function encodeCursor(comment: Pick<Comment, "createdAt" | "id">): string {
  return Buffer.from(`${comment.createdAt}|${comment.id}`, "utf-8").toString("base64");
}

function decodeCursor(cursor?: string | null): CursorParts | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const separatorIndex = decoded.lastIndexOf("|");

    if (separatorIndex <= 0) {
      return null;
    }

    const createdAt = decoded.slice(0, separatorIndex);
    const id = decoded.slice(separatorIndex + 1);

    if (!createdAt || !id) {
      return null;
    }

    return { createdAt, id };
  } catch {
    return null;
  }
}

function toComment(row: CommentJoinRow): Comment {
  const isDeleted = row.comment.deletedAt !== null;

  return {
    id: row.comment.id,
    resourceId: row.comment.resourceId,
    authorId: isDeleted ? null : row.comment.authorId,
    authorName: isDeleted ? null : (row.user?.name ?? null),
    parentId: row.comment.parentId,
    body: isDeleted ? DELETED_COMMENT_BODY : row.comment.body,
    editedAt: row.comment.editedAt,
    deletedAt: row.comment.deletedAt,
    createdAt: row.comment.createdAt,
    updatedAt: row.comment.updatedAt,
  };
}

async function getCommentById(commentId: string): Promise<CommentJoinRow | null> {
  const [row] = await db
    .select({
      comment: commentsTable,
      user: {
        name: usersTable.name,
      },
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .where(eq(commentsTable.id, commentId))
    .limit(1);

  if (!row) {
    return null;
  }

  return row;
}

export async function listComments(params: {
  resourceId: string;
  cursor?: string | null;
  limit?: number | null;
}): Promise<PaginatedResult<CommentWithReplies>> {
  const limit = params.limit ?? COMMENTS_DEFAULT_LIMIT;
  const cursor = decodeCursor(params.cursor);

  const cursorFilter = cursor
    ? sql`(
        ${commentsTable.createdAt} > ${cursor.createdAt}
        OR (
          ${commentsTable.createdAt} = ${cursor.createdAt}
          AND ${commentsTable.id} > ${cursor.id}
        )
      )`
    : undefined;

  const topLevelRows = await db
    .select({
      comment: commentsTable,
      user: {
        name: usersTable.name,
      },
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .where(
      and(
        eq(commentsTable.resourceId, params.resourceId),
        isNull(commentsTable.parentId),
        cursorFilter
      )
    )
    .orderBy(asc(commentsTable.createdAt), asc(commentsTable.id))
    .limit(limit + 1);

  const hasMore = topLevelRows.length > limit;
  const pageRows = hasMore ? topLevelRows.slice(0, limit) : topLevelRows;
  const topLevelComments = pageRows.map(toComment);
  const parentIds = topLevelComments.map((comment) => comment.id);

  const replyRows =
    parentIds.length === 0
      ? []
      : await db
          .select({
            comment: commentsTable,
            user: {
              name: usersTable.name,
            },
          })
          .from(commentsTable)
          .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
          .where(
            and(
              eq(commentsTable.resourceId, params.resourceId),
              inArray(commentsTable.parentId, parentIds)
            )
          )
          .orderBy(asc(commentsTable.createdAt), asc(commentsTable.id));

  const repliesByParentId = new Map<string, Comment[]>();

  for (const row of replyRows) {
    const reply = toComment(row);
    const parentId = reply.parentId;

    if (!parentId) {
      continue;
    }

    const existing = repliesByParentId.get(parentId) ?? [];
    existing.push(reply);
    repliesByParentId.set(parentId, existing);
  }

  const items = topLevelComments.map((comment) => ({
    ...comment,
    replies: repliesByParentId.get(comment.id) ?? [],
  }));

  return {
    items,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
}

export async function createComment(params: {
  resourceId: string;
  authorId: string;
  body: string;
}): Promise<Comment> {
  const normalizedBody = normalizeBody(params.body);

  const [author] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, params.authorId))
    .limit(1);

  const [comment] = await db
    .insert(commentsTable)
    .values({
      id: crypto.randomUUID(),
      resourceId: params.resourceId,
      authorId: params.authorId,
      parentId: null,
      body: normalizedBody,
    })
    .returning();

  return toComment({
    comment,
    user: author ?? null,
  });
}

export async function createReply(params: {
  parentId: string;
  authorId: string;
  body: string;
}): Promise<Comment> {
  const normalizedBody = normalizeBody(params.body);
  const parent = await getCommentById(params.parentId);

  if (!parent || parent.comment.deletedAt !== null) {
    throw new NotFoundError();
  }

  if (parent.comment.parentId !== null) {
    throw new ValidationError("cannot reply to a reply");
  }

  const [author] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, params.authorId))
    .limit(1);

  const [reply] = await db
    .insert(commentsTable)
    .values({
      id: crypto.randomUUID(),
      resourceId: parent.comment.resourceId,
      authorId: params.authorId,
      parentId: parent.comment.id,
      body: normalizedBody,
    })
    .returning();

  return toComment({
    comment: reply,
    user: author ?? null,
  });
}

export async function editComment(params: {
  commentId: string;
  editorId: string;
  body: string;
}): Promise<Comment> {
  const normalizedBody = normalizeBody(params.body);
  const existing = await getCommentById(params.commentId);

  if (!existing || existing.comment.deletedAt !== null) {
    throw new NotFoundError();
  }

  if (existing.comment.authorId !== params.editorId) {
    throw new AuthzError();
  }

  const [updated] = await db
    .update(commentsTable)
    .set({
      body: normalizedBody,
      editedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(commentsTable.id, params.commentId))
    .returning();

  return toComment({
    comment: updated,
    user: existing.user,
  });
}

export async function softDeleteComment(params: {
  commentId: string;
  actorId: string;
  actorRole: "user" | "moderator" | "admin";
  resourceOwnerId: string;
}): Promise<void> {
  const existing = await getCommentById(params.commentId);

  if (!existing) {
    throw new NotFoundError();
  }

  const canDelete =
    existing.comment.authorId === params.actorId ||
    params.resourceOwnerId === params.actorId ||
    params.actorRole === "moderator" ||
    params.actorRole === "admin";

  if (!canDelete) {
    throw new AuthzError();
  }

  await db
    .update(commentsTable)
    .set({
      deletedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(commentsTable.id, params.commentId));
}

export async function createNotificationForComment(params: {
  resourceId: string;
  resourceOwnerId: string;
  commentId: string;
  actorId: string;
}): Promise<void> {
  if (params.actorId === params.resourceOwnerId) {
    return;
  }

  await db.insert(notificationsTable).values({
    id: crypto.randomUUID(),
    recipientId: params.resourceOwnerId,
    type: "comment_on_resource",
    resourceId: params.resourceId,
    commentId: params.commentId,
    readAt: null,
  });
}

export async function createNotificationForReply(params: {
  resourceId: string;
  parentCommentAuthorId: string;
  replyCommentId: string;
  actorId: string;
}): Promise<void> {
  if (params.actorId === params.parentCommentAuthorId) {
    return;
  }

  await db.insert(notificationsTable).values({
    id: crypto.randomUUID(),
    recipientId: params.parentCommentAuthorId,
    type: "reply_to_comment",
    resourceId: params.resourceId,
    commentId: params.replyCommentId,
    readAt: null,
  });
}
