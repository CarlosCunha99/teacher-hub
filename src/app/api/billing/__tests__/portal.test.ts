import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = {
  getSessionUserId: vi.fn(),
};

const stripeMock = {
  createPortalSession: vi.fn(),
};

const subscriptionsRepoMock = {
  getSubscriptionByUserId: vi.fn(),
};

vi.mock("@/lib/auth/session", () => authMock);
vi.mock("@/lib/stripe", () => stripeMock);
vi.mock("@/lib/db/subscriptions", () => ({
  subscriptionsRepo: subscriptionsRepoMock,
}));

const PORTAL_ROUTE_MODULE = "@/app/api/billing/portal/" + "route";

const loadPortalRoute = async () => import(PORTAL_ROUTE_MODULE);

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

describe("POST /api/billing/portal", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.resetModules();
    authMock.getSessionUserId.mockReset();
    stripeMock.createPortalSession.mockReset();
    subscriptionsRepoMock.getSubscriptionByUserId.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  it("returns 401 when no authenticated session exists", async () => {
    authMock.getSessionUserId.mockResolvedValue(null);
    const { POST } = await loadPortalRoute();

    const response = await POST(
      new Request("http://localhost/api/billing/portal", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(stripeMock.createPortalSession).not.toHaveBeenCalled();
  });

  it("returns 400 when the subscription row has no Stripe customer ID", async () => {
    authMock.getSessionUserId.mockResolvedValue("user-123");
    subscriptionsRepoMock.getSubscriptionByUserId.mockResolvedValue(
      buildSubscription({ stripeCustomerId: null })
    );
    const { POST } = await loadPortalRoute();

    const response = await POST(
      new Request("http://localhost/api/billing/portal", { method: "POST" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: expect.any(String) });
    expect(stripeMock.createPortalSession).not.toHaveBeenCalled();
  });

  it("returns 200 with a Stripe portal URL when the user has a Stripe customer ID", async () => {
    authMock.getSessionUserId.mockResolvedValue("user-123");
    subscriptionsRepoMock.getSubscriptionByUserId.mockResolvedValue(buildSubscription());
    stripeMock.createPortalSession.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test_123",
    });
    const { POST } = await loadPortalRoute();

    const response = await POST(
      new Request("http://localhost/api/billing/portal", { method: "POST" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://billing.stripe.com/p/session/test_123",
    });
    expect(stripeMock.createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cus_123",
      })
    );
  });

  it("returns 500 when creating the Stripe portal session fails", async () => {
    authMock.getSessionUserId.mockResolvedValue("user-123");
    subscriptionsRepoMock.getSubscriptionByUserId.mockResolvedValue(buildSubscription());
    stripeMock.createPortalSession.mockRejectedValue(new Error("Stripe unavailable"));
    const { POST } = await loadPortalRoute();

    const response = await POST(
      new Request("http://localhost/api/billing/portal", { method: "POST" })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: expect.any(String) });
  });
});
