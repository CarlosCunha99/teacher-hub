import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { type Notification } from "@/lib/comments/service";
import { db } from "@/lib/db";
import { notificationsTable } from "@/lib/db/schema";

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

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.recipientId, user.id), isNull(notificationsTable.readAt)))
      .orderBy(desc(notificationsTable.createdAt));

    return NextResponse.json({ items: notifications.map(toNotification) }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
