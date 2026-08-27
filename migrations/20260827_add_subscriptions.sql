-- Migration: add subscriptions table (issue #15 — premium membership)
--
-- FORWARD-LOOKING: this file is NOT run by issue #15. The runtime uses an
-- in-memory SubscriptionsRepository. Issue #3 (PostgreSQL schema) owns the
-- migration runner and will apply this DDL behind the same repository
-- interface. Kept here so the schema is reviewed alongside the feature code.

CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id        TEXT,
    status                 TEXT NOT NULL DEFAULT 'none',
    current_period_end     TIMESTAMPTZ,
    stripe_event_id        TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx
    ON subscriptions (user_id);
