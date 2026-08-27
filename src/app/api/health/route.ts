import { NextResponse } from "next/server";
import { HEALTH_STATUS, type HealthPayload } from "@/lib/health";

export async function GET(_request: Request): Promise<Response> {
  const payload: HealthPayload = { status: HEALTH_STATUS };
  return NextResponse.json(payload, { status: 200 });
}
