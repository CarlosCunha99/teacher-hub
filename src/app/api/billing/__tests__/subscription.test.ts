import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = {
  getSessionUserId: vi.fn(),
};

const subscriptionsRepoMock = {
  getSubscriptionByUserId: vi.fn(),
};

const entitlementsMock = {
  isUserPremium: vi.fn(),
};

vi.mock("@/lib/auth/session", () => authMock);
vi.mock("@/lib/db/subscriptions", () => ({
  subscriptionsRepo: subscriptionsRepoMock,
}));
vi.mock("@/lib/entitlements", () => entitlementsMock);

const SUBSCRIPTION_ROUTE_MODULE = "@/app/api/billing/subscription/" + "route";

const loadSubscriptionRoute = async () => import(SUBSCRIPTION_ROUTE_MODULE);

const buildSubscription = (overrides: Record<string, unknown> = {}) => ({
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

describe("GET /api/billing/subscription", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.getSessionUserId.mockReset();
    subscriptionsRepoMock.getSubscriptionByUserId.mockReset();
    entitlementsMock.isUserPremium.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no authenticated session exists", async () => {
    authMock.getSessionUserId.mockResolvedValue(null);
    const { GET } = await loadSubscriptionRoute();

    const response = await GET(new Request("http://localhost/api/billing/subscription"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(subscriptionsRepoMock.getSubscriptionByUserId).not.toHaveBeenCalled();
  });

  it("returns the free-tier shape when no subscription row exists", async () => {
    authMock.getSessionUserId.mockResolvedValue("user-123");
    subscriptionsRepoMock.getSubscriptionByUserId.mockResolvedValue(null);
    entitlementsMock.isUserPremium.mockResolvedValue(false);
    const { GET } = await loadSubscriptionRoute();

    const response = await GET(new Request("http://localhost/api/billing/subscription"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "none",
      currentPeriodEnd: null,
      priceId: null,
      isPremium: false,
    });
  });

  it("returns an active subscription with isPremium=true", async () => {
    const subscription = buildSubscription({
      status: "active",
      currentPeriodEnd: new Date("2026-09-27T12:00:00.000Z"),
    });

    authMock.getSessionUserId.mockResolvedValue("user-123");
    subscriptionsRepoMock.getSubscriptionByUserId.mockResolvedValue(subscription);
    entitlementsMock.isUserPremium.mockResolvedValue(true);
    const { GET } = await loadSubscriptionRoute();

    const response = await GET(new Request("http://localhost/api/billing/subscription"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "active",
      currentPeriodEnd: "2026-09-27T12:00:00.000Z",
      priceId: "price_123",
      isPremium: true,
    });
  });

  it.each([
    ["past_due", true, "2026-09-27T12:00:00.000Z"],
    ["trialing", true, "2026-09-27T12:00:00.000Z"],
    ["canceled", false, "2026-08-20T12:00:00.000Z"],
  ])(
    "returns status %s with the corresponding isPremium value",
    async (status, isPremium, currentPeriodEndIso) => {
      authMock.getSessionUserId.mockResolvedValue("user-123");
      subscriptionsRepoMock.getSubscriptionByUserId.mockResolvedValue(
        buildSubscription({
          status,
          currentPeriodEnd: new Date(currentPeriodEndIso),
        })
      );
      entitlementsMock.isUserPremium.mockResolvedValue(isPremium);
      const { GET } = await loadSubscriptionRoute();

      const response = await GET(new Request("http://localhost/api/billing/subscription"));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status,
        currentPeriodEnd: currentPeriodEndIso,
        priceId: "price_123",
        isPremium,
      });
    }
  );
});
