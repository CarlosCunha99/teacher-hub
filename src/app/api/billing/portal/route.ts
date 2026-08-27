import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth/session";
import { subscriptionsRepo } from "@/lib/db/subscriptions";
import { createPortalSession } from "@/lib/stripe";

export async function POST(request: Request): Promise<Response> {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "billing is not configured" }, { status: 500 });
  }

  try {
    const subscription = await subscriptionsRepo.getSubscriptionByUserId(userId);
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "no billing customer for this user" }, { status: 400 });
    }

    const { url } = await createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${appUrl}/settings`,
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
