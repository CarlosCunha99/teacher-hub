import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Subscription, SubscriptionStatus } from "@/lib/db/subscriptions.types";

const SUBSCRIPTIONS_MODULE = "@/lib/db/" + "subscriptions";

interface SubscriptionsRepository {
  upsertSubscription(data: {
    userId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    status: SubscriptionStatus;
    currentPeriodEnd?: Date | null;
    stripeEventId?: string | null;
  }): Promise<Subscription>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | null>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  markEventProcessed(stripeEventId: string): Promise<void>;
  isEventProcessed(stripeEventId: string): Promise<boolean>;
}

const loadSubscriptionsModule = async (): Promise<{
  subscriptionsRepo: SubscriptionsRepository;
  __resetForTests: () => void;
}> => import(SUBSCRIPTIONS_MODULE);

describe("subscriptionsRepo", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { __resetForTests } = await loadSubscriptionsModule();
    __resetForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a subscription row and retrieves it by user ID and Stripe subscription ID", async () => {
    const { subscriptionsRepo } = await loadSubscriptionsModule();

    const created = await subscriptionsRepo.upsertSubscription({
      userId: "user-123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_monthly",
      status: "active",
      currentPeriodEnd: new Date("2026-09-27T12:00:00.000Z"),
      stripeEventId: "evt_123",
    });

    const byUser = await subscriptionsRepo.getSubscriptionByUserId("user-123");
    const byStripeId = await subscriptionsRepo.getSubscriptionByStripeId("sub_123");

    expect(created.userId).toBe("user-123");
    expect(byUser).toEqual(created);
    expect(byStripeId).toEqual(created);
  });

  it("updates an existing row in place when upserting the same Stripe subscription ID", async () => {
    const { subscriptionsRepo } = await loadSubscriptionsModule();

    const created = await subscriptionsRepo.upsertSubscription({
      userId: "user-123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_monthly",
      status: "active",
      currentPeriodEnd: new Date("2026-09-27T12:00:00.000Z"),
      stripeEventId: "evt_123",
    });

    const updated = await subscriptionsRepo.upsertSubscription({
      userId: "user-123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_yearly",
      status: "past_due",
      currentPeriodEnd: new Date("2026-10-27T12:00:00.000Z"),
      stripeEventId: "evt_456",
    });

    const byStripeId = await subscriptionsRepo.getSubscriptionByStripeId("sub_123");
    const byUser = await subscriptionsRepo.getSubscriptionByUserId("user-123");

    expect(updated.id).toBe(created.id);
    expect(byStripeId).toEqual(updated);
    expect(byUser).toEqual(updated);
    expect(updated.status).toBe("past_due");
    expect(updated.stripePriceId).toBe("price_yearly");
    expect(updated.stripeEventId).toBe("evt_456");
  });

  it("returns the most recent subscription row for a user", async () => {
    const { subscriptionsRepo } = await loadSubscriptionsModule();

    await subscriptionsRepo.upsertSubscription({
      userId: "user-123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_old",
      stripePriceId: "price_monthly",
      status: "canceled",
      currentPeriodEnd: new Date("2026-08-30T12:00:00.000Z"),
      stripeEventId: "evt_old",
    });

    const latest = await subscriptionsRepo.upsertSubscription({
      userId: "user-123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_new",
      stripePriceId: "price_monthly",
      status: "active",
      currentPeriodEnd: new Date("2026-09-30T12:00:00.000Z"),
      stripeEventId: "evt_new",
    });

    await expect(subscriptionsRepo.getSubscriptionByUserId("user-123")).resolves.toEqual(latest);
  });

  it("tracks processed Stripe event IDs independently", async () => {
    const { subscriptionsRepo } = await loadSubscriptionsModule();

    await expect(subscriptionsRepo.isEventProcessed("evt_1")).resolves.toBe(false);
    await subscriptionsRepo.markEventProcessed("evt_1");

    await expect(subscriptionsRepo.isEventProcessed("evt_1")).resolves.toBe(true);
    await expect(subscriptionsRepo.isEventProcessed("evt_2")).resolves.toBe(false);
  });
});
