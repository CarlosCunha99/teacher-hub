export type SubscriptionStatus = "active" | "past_due" | "trialing" | "canceled" | "none";

export interface Subscription {
  id: string; // UUID
  userId: string; // UUID — references users.id
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null; // UNIQUE
  stripePriceId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  stripeEventId: string | null; // last processed event id (idempotency)
  createdAt: Date;
  updatedAt: Date;
}

export const PAST_DUE_GRACE_DAYS = 7;
