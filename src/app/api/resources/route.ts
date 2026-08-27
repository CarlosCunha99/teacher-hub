import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function errorResponse(error: string, code: string, status: number): Response {
  return NextResponse.json({ error, code }, { status });
}

function getTeacherId(request: Request): string | null {
  const teacherId = request.headers.get("X-Teacher-Id")?.trim();
  return teacherId ? teacherId : null;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const tagsParam = searchParams.get("tags");
  const modeParam = searchParams.get("mode");

  if (modeParam && modeParam !== "or" && modeParam !== "and") {
    return errorResponse("Invalid mode parameter", "VALIDATION_ERROR", 400);
  }

  const mode = modeParam ?? "or";

  const slugs = tagsParam
    ? tagsParam
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean)
    : [];

  const where =
    slugs.length === 0
      ? {}
      : mode === "and"
        ? {
            AND: slugs.map((slug) => ({
              resourceTags: {
                some: {
                  tag: {
                    slug,
                  },
                },
              },
            })),
          }
        : {
            resourceTags: {
              some: {
                tag: {
                  slug: {
                    in: slugs,
                  },
                },
              },
            },
          };

  const resources = await prisma.resource.findMany({ where });
  return NextResponse.json(resources, { status: 200 });
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

  const title =
    payload && typeof payload === "object" && "title" in payload
      ? (payload as { title?: unknown }).title
      : undefined;

  if (typeof title !== "string" || !title.trim()) {
    return errorResponse("Resource title is required", "VALIDATION_ERROR", 400);
  }

  const resource = await prisma.resource.create({
    data: {
      title: title.trim(),
      teacherId,
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
