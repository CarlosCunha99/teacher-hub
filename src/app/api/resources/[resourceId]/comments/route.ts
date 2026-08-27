import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createComment,
  createNotificationForComment,
  listComments,
  ValidationError,
} from "@/lib/comments/service";
import { db } from "@/lib/db";
import { resourcesTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{
    resourceId: string;
  }>;
};

type CreateCommentPayload = {
  body?: string;
};

function parseLimit(rawLimit: string | null): number {
  const parsed = Number.parseInt(rawLimit ?? "", 10);

  if (Number.isNaN(parsed)) {
    return 20;
  }

  return Math.min(100, Math.max(1, parsed));
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resourceId } = await context.params;
  const { searchParams } = new URL(request.url);

  try {
    const result = await listComments({
      resourceId,
      cursor: searchParams.get("cursor"),
      limit: parseLimit(searchParams.get("limit")),
    });

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as CreateCommentPayload | null;

  if (!payload || typeof payload.body !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { resourceId } = await context.params;

  try {
    const comment = await createComment({
      resourceId,
      authorId: user.id,
      body: payload.body,
    });

    void db
      .select({ ownerId: resourcesTable.ownerId })
      .from(resourcesTable)
      .where(eq(resourcesTable.id, resourceId))
      .limit(1)
      .then(([resource]) => {
        if (!resource) {
          return;
        }

        return createNotificationForComment({
          resourceId,
          resourceOwnerId: resource.ownerId,
          commentId: comment.id,
          actorId: user.id,
        });
      })
      .catch(() => undefined);

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
