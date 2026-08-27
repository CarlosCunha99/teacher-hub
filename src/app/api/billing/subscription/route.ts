import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth/session";
import { subscriptionsRepo } from "@/lib/db/subscriptions";
import { isUserPremium } from "@/lib/entitlements";
import type { SubscriptionStatus } from "@/lib/db/subscriptions.types";

interface SubscriptionResponse {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  priceId: string | null;
  isPremium: boolean;
}

export async function GET(request: Request): Promise<Response> {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const subscription = await subscriptionsRepo.getSubscriptionByUserId(userId);

    if (!subscription) {
      const body: SubscriptionResponse = {
        status: "none",
        currentPeriodEnd: null,
        priceId: null,
        isPremium: false,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const body: SubscriptionResponse = {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd
        ? subscription.currentPeriodEnd.toISOString()
        : null,
      priceId: subscription.stripePriceId,
      isPremium: await isUserPremium(userId),
    };

    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
