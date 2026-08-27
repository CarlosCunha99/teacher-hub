import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function errorResponse(error: string, code: string, status: number): Response {
  return NextResponse.json({ error, code }, { status });
}

function getTeacherId(request: Request): string | null {
  const teacherId = request.headers.get("X-Teacher-Id")?.trim();
  return teacherId ? teacherId : null;
}

function getTagIdFromPayload(payload: unknown): string | null {
  const tagId =
    payload && typeof payload === "object" && "tagId" in payload
      ? (payload as { tagId?: unknown }).tagId
      : undefined;

  if (typeof tagId !== "string" || !tagId.trim()) {
    return null;
  }

  return tagId.trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const teacherId = getTeacherId(request);

  if (!teacherId) {
    return errorResponse("Missing teacher ID", "UNAUTHORIZED", 401);
  }

  const { id: resourceId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", "VALIDATION_ERROR", 400);
  }

  const tagId = getTagIdFromPayload(payload);

  if (!tagId) {
    return errorResponse("Tag ID is required", "VALIDATION_ERROR", 400);
  }

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });

  if (!resource) {
    return errorResponse("Resource not found", "NOT_FOUND", 404);
  }

  if (resource.teacherId !== teacherId) {
    return errorResponse("Not allowed to modify this resource", "FORBIDDEN", 403);
  }

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });

  if (!tag) {
    return errorResponse("Tag not found", "NOT_FOUND", 404);
  }

  if (tag.teacherId !== teacherId) {
    return errorResponse("Not allowed to use this tag", "FORBIDDEN", 403);
  }

  const resourceTag = await prisma.resourceTag.upsert({
    where: {
      resourceId_tagId: {
        resourceId,
        tagId,
      },
    },
    update: {},
    create: {
      resourceId,
      tagId,
    },
    select: {
      resourceId: true,
      tagId: true,
    },
  });

  return NextResponse.json(resourceTag, { status: 201 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const teacherId = getTeacherId(request);

  if (!teacherId) {
    return errorResponse("Missing teacher ID", "UNAUTHORIZED", 401);
  }

  const { id: resourceId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", "VALIDATION_ERROR", 400);
  }

  const tagId = getTagIdFromPayload(payload);

  if (!tagId) {
    return errorResponse("Tag ID is required", "VALIDATION_ERROR", 400);
  }

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });

  if (!resource) {
    return errorResponse("Resource not found", "NOT_FOUND", 404);
  }

  if (resource.teacherId !== teacherId) {
    return errorResponse("Not allowed to modify this resource", "FORBIDDEN", 403);
  }

  const association = await prisma.resourceTag.findUnique({
    where: {
      resourceId_tagId: {
        resourceId,
        tagId,
      },
    },
  });

  if (!association) {
    return errorResponse("Resource tag association not found", "NOT_FOUND", 404);
  }

  await prisma.resourceTag.delete({
    where: {
      resourceId_tagId: {
        resourceId,
        tagId,
      },
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
