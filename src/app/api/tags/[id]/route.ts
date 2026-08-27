import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function errorResponse(error: string, code: string, status: number): Response {
  return NextResponse.json({ error, code }, { status });
}

function getTeacherId(request: Request): string | null {
  const teacherId = request.headers.get("X-Teacher-Id")?.trim();
  return teacherId ? teacherId : null;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const teacherId = getTeacherId(request);

  if (!teacherId) {
    return errorResponse("Missing teacher ID", "UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const tag = await prisma.tag.findUnique({ where: { id } });

  if (!tag) {
    return errorResponse("Tag not found", "NOT_FOUND", 404);
  }

  if (tag.teacherId !== teacherId) {
    return errorResponse("Not allowed to delete this tag", "FORBIDDEN", 403);
  }

  await prisma.resourceTag.deleteMany({ where: { tagId: id } });
  await prisma.tag.delete({ where: { id } });

  return NextResponse.json({ success: true }, { status: 200 });
}
