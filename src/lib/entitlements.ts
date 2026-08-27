import { subscriptionsRepo } from "@/lib/db/subscriptions";
import { PAST_DUE_GRACE_DAYS } from "@/lib/db/subscriptions.types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns whether a user currently has premium entitlement.
 *
 * Reads only the local subscription store and fails closed: any repository
 * error resolves `false` rather than throwing.
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const subscription = await subscriptionsRepo.getSubscriptionByUserId(userId);

    if (!subscription) {
      return false;
    }

    const now = Date.now();

    switch (subscription.status) {
      case "active":
      case "trialing":
        return true;
      case "past_due": {
        const graceExpiresAt = subscription.updatedAt.getTime() + PAST_DUE_GRACE_DAYS * MS_PER_DAY;
        return graceExpiresAt > now;
      }
      case "canceled":
        return (
          subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd.getTime() > now
        );
      case "none":
      default:
        return false;
    }
  } catch {
    return false;
  }
}
