import { NextResponse } from "next/server";
import { getCurrentTeacherId } from "@/lib/auth";
import { hasAcceptedCurrentTerms } from "@/lib/terms-acceptance";

async function processUploadPlaceholder(_request: Request): Promise<Response> {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}

export async function POST(request: Request): Promise<Response> {
  const teacherId = await getCurrentTeacherId();

  if (teacherId === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const accepted = await hasAcceptedCurrentTerms(teacherId);

  if (!accepted) {
    return NextResponse.json({ error: "terms_not_accepted" }, { status: 403 });
  }

  return processUploadPlaceholder(request);
}
