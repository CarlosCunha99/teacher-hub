import { NextResponse } from "next/server";
import { getResourceById } from "@/lib/store/resource-store";
import type { Resource } from "@/lib/types";

type ResourceResponse = Omit<Resource, "filePath">;

function toResourceResponse(resource: Resource): ResourceResponse {
  const { filePath: _filePath, ...safeResource } = resource;
  return safeResource;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  try {
    const resource = await getResourceById(id);

    if (!resource) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toResourceResponse(resource), { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
