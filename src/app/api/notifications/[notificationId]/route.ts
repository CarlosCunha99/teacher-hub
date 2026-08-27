import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AuthzError, NotFoundError, type Notification } from "@/lib/comments/service";
import { db } from "@/lib/db";
import { notificationsTable } from "@/lib/db/schema";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

function toNotification(row: typeof notificationsTable.$inferSelect): Notification {
  return {
    id: row.id,
    recipientId: row.recipientId,
    type: row.type,
    resourceId: row.resourceId,
    commentId: row.commentId,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notificationId } = await context.params;

  try {
    const [notification] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notificationId))
      .limit(1);

    if (!notification) {
      throw new NotFoundError();
    }

    if (notification.recipientId !== user.id) {
      throw new AuthzError();
    }

    const [updated] = await db
      .update(notificationsTable)
      .set({
        readAt: sql`NOW()`,
      })
      .where(eq(notificationsTable.id, notificationId))
      .returning();

    return NextResponse.json(toNotification(updated), { status: 200 });
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
