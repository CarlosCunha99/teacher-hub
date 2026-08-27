import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = {
  getSessionUserId: vi.fn(),
};

const stripeMock = {
  createCheckoutSession: vi.fn(),
};

vi.mock("@/lib/auth/session", () => authMock);
vi.mock("@/lib/stripe", () => stripeMock);

const CHECKOUT_ROUTE_MODULE = "@/app/api/billing/checkout/" + "route";

const loadCheckoutRoute = async () => import(CHECKOUT_ROUTE_MODULE);

describe("POST /api/billing/checkout", () => {
  const originalPriceId = process.env.STRIPE_PRICE_ID;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.resetModules();
    authMock.getSessionUserId.mockReset();
    stripeMock.createCheckoutSession.mockReset();
    process.env.STRIPE_PRICE_ID = "price_premium_monthly";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalPriceId === undefined) {
      delete process.env.STRIPE_PRICE_ID;
    } else {
      process.env.STRIPE_PRICE_ID = originalPriceId;
    }

    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  it("returns 401 when no authenticated session exists", async () => {
    authMock.getSessionUserId.mockResolvedValue(null);
    const { POST } = await loadCheckoutRoute();

    const response = await POST(
      new Request("http://localhost/api/billing/checkout", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 200 with a Stripe checkout URL for authenticated users", async () => {
    authMock.getSessionUserId.mockResolvedValue("user-123");
    stripeMock.createCheckoutSession.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    const { POST } = await loadCheckoutRoute();

    const response = await POST(
      new Request("http://localhost/api/billing/checkout", { method: "POST" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        priceId: "price_premium_monthly",
      })
    );
  });

  it("returns 500 when creating the Stripe checkout session fails", async () => {
    authMock.getSessionUserId.mockResolvedValue("user-123");
    stripeMock.createCheckoutSession.mockRejectedValue(new Error("Stripe unavailable"));
    const { POST } = await loadCheckoutRoute();

    const response = await POST(
      new Request("http://localhost/api/billing/checkout", { method: "POST" })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: expect.any(String) });
  });
});
