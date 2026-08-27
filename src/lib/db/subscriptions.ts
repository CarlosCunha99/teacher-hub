// NOTE: In-memory implementation — intentional for this ticket (issue #15).
// Replace with Postgres implementation in issue #3. In-memory state does not
// persist across restarts or serverless invocations. See migrations/20260827_add_subscriptions.sql.
import { type Subscription, type SubscriptionStatus } from "@/lib/db/subscriptions.types";

export interface UpsertSubscriptionData {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  stripeEventId?: string | null;
}

export interface SubscriptionsRepository {
  upsertSubscription(data: UpsertSubscriptionData): Promise<Subscription>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | null>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  markEventProcessed(stripeEventId: string): Promise<void>;
  isEventProcessed(stripeEventId: string): Promise<boolean>;
}

function generateId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

class InMemorySubscriptionsRepository implements SubscriptionsRepository {
  private subscriptions: Subscription[] = [];
  private processedEvents = new Set<string>();

  async upsertSubscription(data: UpsertSubscriptionData): Promise<Subscription> {
    const now = new Date();

    let existing: Subscription | undefined;
    if (data.stripeSubscriptionId) {
      existing = this.subscriptions.find(
        (s) => s.stripeSubscriptionId === data.stripeSubscriptionId
      );
    }

    if (existing) {
      existing.stripeCustomerId =
        data.stripeCustomerId !== undefined ? data.stripeCustomerId : existing.stripeCustomerId;
      existing.stripeSubscriptionId =
        data.stripeSubscriptionId !== undefined
          ? data.stripeSubscriptionId
          : existing.stripeSubscriptionId;
      existing.stripePriceId =
        data.stripePriceId !== undefined ? data.stripePriceId : existing.stripePriceId;
      existing.status = data.status;
      existing.currentPeriodEnd =
        data.currentPeriodEnd !== undefined ? data.currentPeriodEnd : existing.currentPeriodEnd;
      existing.stripeEventId =
        data.stripeEventId !== undefined ? data.stripeEventId : existing.stripeEventId;
      existing.updatedAt = now;
      return { ...existing };
    }

    const created: Subscription = {
      id: generateId(),
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      stripePriceId: data.stripePriceId ?? null,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      stripeEventId: data.stripeEventId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.push(created);
    return { ...created };
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const matches = this.subscriptions.filter((s) => s.userId === userId);
    if (matches.length === 0) {
      return null;
    }
    const latest = matches.reduce((a, b) =>
      b.updatedAt.getTime() >= a.updatedAt.getTime() ? b : a
    );
    return { ...latest };
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const match = this.subscriptions.find((s) => s.stripeSubscriptionId === stripeSubscriptionId);
    return match ? { ...match } : null;
  }

  async markEventProcessed(stripeEventId: string): Promise<void> {
    this.processedEvents.add(stripeEventId);
  }

  async isEventProcessed(stripeEventId: string): Promise<boolean> {
    return this.processedEvents.has(stripeEventId);
  }

  reset(): void {
    this.subscriptions = [];
    this.processedEvents = new Set<string>();
  }
}

const inMemoryRepo = new InMemorySubscriptionsRepository();

/** Module-level singleton (in-memory impl for dev/test). */
export const subscriptionsRepo: SubscriptionsRepository = inMemoryRepo;

/** Reset internal state between tests. Only call from test files. */
export function __resetForTests(): void {
  inMemoryRepo.reset();
}
