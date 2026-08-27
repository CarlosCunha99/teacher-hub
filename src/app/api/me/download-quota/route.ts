import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { getQuotaUsage, type QuotaStatus } from "@/lib/download-quota";

export async function GET(request: Request): Promise<Response> {
  const session = await getSession(request);

  if (!session) {
    return new Response(null, { status: 401 });
  }

  if (session.user.tier === "premium") {
    const payload: QuotaStatus = { tier: "premium", unlimited: true };
    return NextResponse.json(payload, { status: 200 });
  }

  const quota = await getQuotaUsage(session.user.id, db);
  const payload: QuotaStatus = {
    tier: "free",
    used: quota.used,
    limit: quota.limit,
    reset_at: quota.reset_at,
    upgrade_url: quota.upgrade_url,
  };

  return NextResponse.json(payload, { status: 200 });
}
