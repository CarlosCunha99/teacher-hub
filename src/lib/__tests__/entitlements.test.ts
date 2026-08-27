import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Subscription, SubscriptionStatus } from "@/lib/db/subscriptions.types";

const dbRepoMock = {
  getSubscriptionByUserId: vi.fn(),
};

vi.mock("@/lib/db/subscriptions", () => ({
  subscriptionsRepo: dbRepoMock,
}));

const ENTITLEMENTS_MODULE = "@/lib/" + "entitlements";
const NOW = new Date("2026-08-27T12:00:00.000Z");

const loadIsUserPremium = async () => {
  const entitlementsModule = await import(ENTITLEMENTS_MODULE);
  return entitlementsModule.isUserPremium;
};

const buildSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: "sub-row-1",
  userId: "user-123",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_123",
  stripePriceId: "price_123",
  status: "active",
  currentPeriodEnd: new Date("2026-09-27T12:00:00.000Z"),
  stripeEventId: "evt_123",
  createdAt: new Date("2026-08-20T12:00:00.000Z"),
  updatedAt: new Date("2026-08-26T12:00:00.000Z"),
  ...overrides,
});

describe("isUserPremium", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    dbRepoMock.getSubscriptionByUserId.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns true for active subscriptions", async () => {
    dbRepoMock.getSubscriptionByUserId.mockResolvedValue(
      buildSubscription({
        status: "active",
        currentPeriodEnd: new Date("2026-08-01T12:00:00.000Z"),
      })
    );

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(true);
    expect(dbRepoMock.getSubscriptionByUserId).toHaveBeenCalledWith("user-123");
  });

  it("returns true for past_due subscriptions updated within the 7 day grace period", async () => {
    dbRepoMock.getSubscriptionByUserId.mockResolvedValue(
      buildSubscription({
        status: "past_due",
        updatedAt: new Date("2026-08-21T12:00:00.000Z"),
      })
    );

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(true);
  });

  it("returns false for past_due subscriptions updated more than 7 days ago", async () => {
    dbRepoMock.getSubscriptionByUserId.mockResolvedValue(
      buildSubscription({
        status: "past_due",
        updatedAt: new Date("2026-08-19T11:59:59.000Z"),
      })
    );

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(false);
  });

  it("returns true for canceled subscriptions with a future currentPeriodEnd", async () => {
    dbRepoMock.getSubscriptionByUserId.mockResolvedValue(
      buildSubscription({
        status: "canceled",
        currentPeriodEnd: new Date("2026-09-01T12:00:00.000Z"),
      })
    );

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(true);
  });

  it("returns false for canceled subscriptions with a past currentPeriodEnd", async () => {
    dbRepoMock.getSubscriptionByUserId.mockResolvedValue(
      buildSubscription({
        status: "canceled",
        currentPeriodEnd: new Date("2026-08-26T12:00:00.000Z"),
      })
    );

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(false);
  });

  it("returns true for trialing subscriptions", async () => {
    dbRepoMock.getSubscriptionByUserId.mockResolvedValue(
      buildSubscription({
        status: "trialing",
      })
    );

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(true);
  });

  it.each([
    ["no stored subscription", null],
    ["a row with status none", buildSubscription({ status: "none" })],
  ])("returns false for %s", async (_label, subscription) => {
    dbRepoMock.getSubscriptionByUserId.mockResolvedValue(subscription);

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(false);
  });

  it("fails closed and returns false when the repository throws", async () => {
    dbRepoMock.getSubscriptionByUserId.mockRejectedValue(new Error("db unavailable"));

    const isUserPremium = await loadIsUserPremium();

    await expect(isUserPremium("user-123")).resolves.toBe(false);
  });
});
