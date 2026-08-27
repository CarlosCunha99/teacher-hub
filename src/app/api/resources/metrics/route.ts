import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getResourcesByOwner } from "@/lib/store/resource-store";
import type { Resource } from "@/lib/types";

type ResourceResponse = Omit<Resource, "filePath">;

function toResourceResponse(resource: Resource): ResourceResponse {
  const { filePath: _filePath, ...safeResource } = resource;
  return safeResource;
}

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resources = await getResourcesByOwner(user.id);
    return NextResponse.json(resources.map(toResourceResponse), { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
