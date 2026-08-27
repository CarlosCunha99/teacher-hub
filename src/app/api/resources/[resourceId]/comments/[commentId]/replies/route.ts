import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createNotificationForReply,
  createReply,
  NotFoundError,
  ValidationError,
} from "@/lib/comments/service";
import { db } from "@/lib/db";
import { commentsTable } from "@/lib/db/schema";

type RouteContext = {
  params: Promise<{
    resourceId: string;
    commentId: string;
  }>;
};

type ReplyPayload = {
  body?: string;
};

async function getParentComment(commentId: string): Promise<{
  authorId: string;
  resourceId: string;
} | null> {
  const [parentComment] = await db
    .select({
      authorId: commentsTable.authorId,
      resourceId: commentsTable.resourceId,
    })
    .from(commentsTable)
    .where(eq(commentsTable.id, commentId))
    .limit(1);

  return parentComment ?? null;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as ReplyPayload | null;

  if (!payload || typeof payload.body !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { resourceId, commentId } = await context.params;

  try {
    const parentComment = await getParentComment(commentId);

    if (!parentComment || parentComment.resourceId !== resourceId) {
      throw new NotFoundError();
    }

    const reply = await createReply({
      parentId: commentId,
      authorId: user.id,
      body: payload.body,
    });

    void createNotificationForReply({
      resourceId,
      parentCommentAuthorId: parentComment.authorId,
      replyCommentId: reply.id,
      actorId: user.id,
    }).catch(() => undefined);

    return NextResponse.json(reply, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
