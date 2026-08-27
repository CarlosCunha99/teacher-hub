import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toSlug } from "@/lib/slug";

function errorResponse(error: string, code: string, status: number): Response {
  return NextResponse.json({ error, code }, { status });
}

function getTeacherId(request: Request): string | null {
  const teacherId = request.headers.get("X-Teacher-Id")?.trim();
  return teacherId ? teacherId : null;
}

export async function GET(request: Request): Promise<Response> {
  const teacherId = getTeacherId(request);

  if (!teacherId) {
    return errorResponse("Missing teacher ID", "UNAUTHORIZED", 401);
  }

  const tags = await prisma.tag.findMany({ where: { teacherId } });
  return NextResponse.json(tags, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const teacherId = getTeacherId(request);

  if (!teacherId) {
    return errorResponse("Missing teacher ID", "UNAUTHORIZED", 401);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body", "VALIDATION_ERROR", 400);
  }

  const name =
    payload && typeof payload === "object" && "name" in payload
      ? (payload as { name?: unknown }).name
      : undefined;

  if (typeof name !== "string") {
    return errorResponse("Tag name is required", "VALIDATION_ERROR", 400);
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    return errorResponse("Tag name must not be empty", "VALIDATION_ERROR", 400);
  }

  let slug: string;

  try {
    slug = toSlug(trimmedName);
  } catch {
    return errorResponse("Tag name must not be empty", "VALIDATION_ERROR", 400);
  }

  try {
    const tag = await prisma.tag.create({
      data: {
        name: trimmedName,
        slug,
        teacherId,
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse("Tag slug already exists", "CONFLICT", 409);
    }

    throw error;
  }
}
