import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  AuthzError,
  editComment,
  NotFoundError,
  softDeleteComment,
  ValidationError,
} from "@/lib/comments/service";
import { db } from "@/lib/db";
import { commentsTable, resourcesTable } from "@/lib/db/schema";

type RouteContext = {
  params: Promise<{
    resourceId: string;
    commentId: string;
  }>;
};

type EditCommentPayload = {
  body?: string;
};

async function getResourceOwnerId(resourceId: string): Promise<string | null> {
  const [resource] = await db
    .select({ ownerId: resourcesTable.ownerId })
    .from(resourcesTable)
    .where(eq(resourcesTable.id, resourceId))
    .limit(1);

  return resource?.ownerId ?? null;
}

async function assertCommentBelongsToResource(
  commentId: string,
  resourceId: string
): Promise<void> {
  const [comment] = await db
    .select({ resourceId: commentsTable.resourceId })
    .from(commentsTable)
    .where(eq(commentsTable.id, commentId))
    .limit(1);

  if (!comment || comment.resourceId !== resourceId) {
    throw new NotFoundError();
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as EditCommentPayload | null;

  if (!payload || typeof payload.body !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { resourceId, commentId } = await context.params;

  try {
    await assertCommentBelongsToResource(commentId, resourceId);

    const comment = await editComment({
      commentId,
      editorId: user.id,
      body: payload.body,
    });

    return NextResponse.json(comment, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resourceId, commentId } = await context.params;

  try {
    await assertCommentBelongsToResource(commentId, resourceId);

    const resourceOwnerId = await getResourceOwnerId(resourceId);

    if (!resourceOwnerId) {
      throw new NotFoundError("Resource not found");
    }

    await softDeleteComment({
      commentId,
      actorId: user.id,
      actorRole: user.role,
      resourceOwnerId,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
