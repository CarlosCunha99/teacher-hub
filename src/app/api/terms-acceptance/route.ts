import { NextResponse } from "next/server";
import { getCurrentTeacherId } from "@/lib/auth";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { getAcceptanceStatus, recordAcceptance } from "@/lib/terms-acceptance";

export async function GET(_request: Request): Promise<Response> {
  const teacherId = await getCurrentTeacherId();

  if (teacherId === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const status = await getAcceptanceStatus(teacherId);
  return NextResponse.json(status, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const teacherId = await getCurrentTeacherId();

  if (teacherId === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { version?: string } | null;

  if (body?.version !== CURRENT_TERMS_VERSION) {
    return NextResponse.json({ error: "invalid_terms_version" }, { status: 400 });
  }

  const { acceptedAt } = await recordAcceptance(teacherId, body.version);
  return NextResponse.json({ acceptedAt }, { status: 201 });
}
