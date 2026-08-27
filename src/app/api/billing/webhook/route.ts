import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { subscriptionsRepo } from "@/lib/db/subscriptions";
import type { UpsertSubscriptionData } from "@/lib/db/subscriptions";
import type { SubscriptionStatus } from "@/lib/db/subscriptions.types";
import { constructWebhookEvent } from "@/lib/stripe";

export const runtime = "nodejs";

function toIdString(value: string | { id: string } | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "none";
  }
}

function periodEndFromSubscription(subscription: Stripe.Subscription): Date | null {
  const end = subscription.current_period_end;
  return typeof end === "number" ? new Date(end * 1000) : null;
}

function priceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

async function upsertFromStripeSubscription(
  subscription: Stripe.Subscription,
  status: SubscriptionStatus,
  eventId: string
): Promise<void> {
  const existing = await subscriptionsRepo.getSubscriptionByStripeId(subscription.id);
  const userId = existing?.userId ?? subscription.metadata?.userId ?? null;

  if (!userId) {
    // No local user to attach this subscription to (e.g. created out of band).
    return;
  }

  const data: UpsertSubscriptionData = {
    userId,
    stripeCustomerId: toIdString(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceIdFromSubscription(subscription),
    status,
    currentPeriodEnd: periodEndFromSubscription(subscription),
    stripeEventId: eventId,
  };
  await subscriptionsRepo.upsertSubscription(data);
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
      if (!userId) {
        return;
      }
      await subscriptionsRepo.upsertSubscription({
        userId,
        stripeCustomerId: toIdString(session.customer),
        stripeSubscriptionId: toIdString(session.subscription),
        status: "active",
        stripeEventId: event.id,
      });
      return;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertFromStripeSubscription(
        subscription,
        mapStripeStatus(subscription.status),
        event.id
      );
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertFromStripeSubscription(subscription, "canceled", event.id);
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = toIdString(
        (invoice as unknown as { subscription?: string | { id: string } | null }).subscription
      );
      if (!subscriptionId) {
        return;
      }
      const existing = await subscriptionsRepo.getSubscriptionByStripeId(subscriptionId);
      if (!existing) {
        return;
      }
      await subscriptionsRepo.upsertSubscription({
        userId: existing.userId,
        stripeSubscriptionId: subscriptionId,
        status: "past_due",
        stripeEventId: event.id,
      });
      return;
    }
    default:
      // Unknown event types are intentionally ignored.
      return;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    if (await subscriptionsRepo.isEventProcessed(event.id)) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await handleEvent(event);
    await subscriptionsRepo.markEventProcessed(event.id);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "webhook handler failure" }, { status: 500 });
  }
}
