"use client";

import { useEffect, useState } from "react";

interface SubscriptionResponse {
  status: string;
  currentPeriodEnd: string | null;
  priceId: string | null;
  isPremium: boolean;
}

export default function SettingsPage() {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/billing/subscription");
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as SubscriptionResponse;
        if (!cancelled) {
          setSubscription(data);
        }
      } catch {
        if (!cancelled) {
          setError("We couldn't load your subscription details. Please refresh to try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startBillingAction(endpoint: string) {
    setActionPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error("No redirect URL returned");
      }
      window.location.href = data.url;
    } catch {
      setError("We couldn't start that action. Please try again.");
      setActionPending(false);
    }
  }

  return (
    <main>
      <h1>Account settings</h1>
      <section>
        <h2>Membership</h2>

        {loading && <p>Loading your subscription…</p>}

        {!loading && error && <p role="alert">{error}</p>}

        {!loading && !error && subscription && (
          <div>
            <p>
              Plan status: <strong>{subscription.status}</strong>
            </p>
            {subscription.currentPeriodEnd && (
              <p>
                Renews / ends on: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}

            {subscription.isPremium ? (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => startBillingAction("/api/billing/portal")}
              >
                Manage subscription
              </button>
            ) : (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => startBillingAction("/api/billing/checkout")}
              >
                Upgrade to premium
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
