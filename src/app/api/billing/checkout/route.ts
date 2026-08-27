import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth/session";
import { subscriptionsRepo } from "@/lib/db/subscriptions";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(request: Request): Promise<Response> {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!priceId || !appUrl) {
    return NextResponse.json({ error: "billing is not configured" }, { status: 500 });
  }

  try {
    const existing = await subscriptionsRepo.getSubscriptionByUserId(userId);

    const { url } = await createCheckoutSession({
      userId,
      customerId: existing?.stripeCustomerId ?? null,
      priceId,
      successUrl: `${appUrl}/settings?checkout=success`,
      cancelUrl: `${appUrl}/settings?checkout=cancel`,
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
}
