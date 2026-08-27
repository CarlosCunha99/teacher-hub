import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stripeMock = {
  constructWebhookEvent: vi.fn(),
};

const subscriptionsRepoMock = {
  upsertSubscription: vi.fn(),
  getSubscriptionByStripeId: vi.fn(),
  isEventProcessed: vi.fn(),
  markEventProcessed: vi.fn(),
};

vi.mock("@/lib/stripe", () => stripeMock);
vi.mock("@/lib/db/subscriptions", () => ({
  subscriptionsRepo: subscriptionsRepoMock,
}));

const WEBHOOK_ROUTE_MODULE = "@/app/api/billing/webhook/" + "route";

const loadWebhookRoute = async () => import(WEBHOOK_ROUTE_MODULE);

const createWebhookRequest = (body = "{}", signature = "t=1,v1=test-signature") =>
  new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });

const toUnixSeconds = (value: string) => Math.floor(new Date(value).getTime() / 1000);

const checkoutCompletedEvent = {
  id: "evt_checkout_completed",
  type: "checkout.session.completed",
  data: {
    object: {
      customer: "cus_123",
      subscription: "sub_123",
      client_reference_id: "user-123",
      metadata: {
        userId: "user-123",
      },
    },
  },
};

const subscriptionUpdatedEvent = {
  id: "evt_subscription_updated",
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_123",
      customer: "cus_123",
      status: "past_due",
      current_period_end: toUnixSeconds("2026-09-27T12:00:00.000Z"),
      metadata: {
        userId: "user-123",
      },
      items: {
        data: [
          {
            price: {
              id: "price_123",
            },
          },
        ],
      },
    },
  },
};

const subscriptionDeletedEvent = {
  id: "evt_subscription_deleted",
  type: "customer.subscription.deleted",
  data: {
    object: {
      id: "sub_123",
      customer: "cus_123",
      status: "canceled",
      current_period_end: toUnixSeconds("2026-09-27T12:00:00.000Z"),
      metadata: {
        userId: "user-123",
      },
      items: {
        data: [
          {
            price: {
              id: "price_123",
            },
          },
        ],
      },
    },
  },
};

describe("POST /api/billing/webhook", () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetModules();
    stripeMock.constructWebhookEvent.mockReset();
    subscriptionsRepoMock.upsertSubscription.mockReset();
    subscriptionsRepoMock.getSubscriptionByStripeId.mockReset();
    subscriptionsRepoMock.isEventProcessed.mockReset();
    subscriptionsRepoMock.markEventProcessed.mockReset();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it("returns 400 when webhook signature verification fails", async () => {
    stripeMock.constructWebhookEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });
    const { POST } = await loadWebhookRoute();

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(subscriptionsRepoMock.upsertSubscription).not.toHaveBeenCalled();
    expect(subscriptionsRepoMock.markEventProcessed).not.toHaveBeenCalled();
  });

  it("returns 200 and upserts an active subscription for checkout.session.completed", async () => {
    stripeMock.constructWebhookEvent.mockReturnValue(checkoutCompletedEvent);
    subscriptionsRepoMock.isEventProcessed.mockResolvedValue(false);
    const { POST } = await loadWebhookRoute();

    const response = await POST(createWebhookRequest(JSON.stringify({ ok: true })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(subscriptionsRepoMock.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        status: "active",
      })
    );
    expect(subscriptionsRepoMock.markEventProcessed).toHaveBeenCalledWith("evt_checkout_completed");
  });

  it("returns 200 and upserts the mapped status for customer.subscription.updated", async () => {
    stripeMock.constructWebhookEvent.mockReturnValue(subscriptionUpdatedEvent);
    subscriptionsRepoMock.getSubscriptionByStripeId.mockResolvedValue(null);
    subscriptionsRepoMock.isEventProcessed.mockResolvedValue(false);
    const { POST } = await loadWebhookRoute();

    const response = await POST(createWebhookRequest(JSON.stringify({ ok: true })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(subscriptionsRepoMock.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_123",
        status: "past_due",
        currentPeriodEnd: new Date("2026-09-27T12:00:00.000Z"),
      })
    );
  });

  it("returns 200 and upserts a canceled subscription for customer.subscription.deleted", async () => {
    stripeMock.constructWebhookEvent.mockReturnValue(subscriptionDeletedEvent);
    subscriptionsRepoMock.getSubscriptionByStripeId.mockResolvedValue(null);
    subscriptionsRepoMock.isEventProcessed.mockResolvedValue(false);
    const { POST } = await loadWebhookRoute();

    const response = await POST(createWebhookRequest(JSON.stringify({ ok: true })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(subscriptionsRepoMock.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_123",
        status: "canceled",
        currentPeriodEnd: new Date("2026-09-27T12:00:00.000Z"),
      })
    );
  });

  it("returns 200 and skips the second upsert for a replayed event ID", async () => {
    stripeMock.constructWebhookEvent.mockReturnValue(checkoutCompletedEvent);
    subscriptionsRepoMock.isEventProcessed.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { POST } = await loadWebhookRoute();

    const firstResponse = await POST(createWebhookRequest(JSON.stringify({ first: true })));
    const secondResponse = await POST(createWebhookRequest(JSON.stringify({ second: true })));

    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.json()).toEqual({ received: true });
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toEqual({ received: true });
    expect(subscriptionsRepoMock.upsertSubscription).toHaveBeenCalledTimes(1);
  });

  it("returns 200 and ignores unknown event types", async () => {
    stripeMock.constructWebhookEvent.mockReturnValue({
      id: "evt_unknown",
      type: "customer.created",
      data: { object: {} },
    });
    subscriptionsRepoMock.isEventProcessed.mockResolvedValue(false);
    const { POST } = await loadWebhookRoute();

    const response = await POST(createWebhookRequest(JSON.stringify({ ok: true })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(subscriptionsRepoMock.upsertSubscription).not.toHaveBeenCalled();
  });
});
