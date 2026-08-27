import type { DbClient } from "@/lib/db";

function parseMonthlyLimit(value: string | undefined): number {
  if (!value) {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return parsed;
}

export const FREE_TIER_MONTHLY_DOWNLOAD_LIMIT = parseMonthlyLimit(
  process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT
);

const DOWNLOAD_UPGRADE_URL = process.env.DOWNLOAD_UPGRADE_URL || "/upgrade";

export type QuotaStatus =
  | { tier: "free"; used: number; limit: number; reset_at: string; upgrade_url: string }
  | { tier: "premium"; unlimited: true };

export type QuotaExceededBody = {
  code: "QUOTA_EXCEEDED";
  limit: number;
  reset_at: string;
  upgrade_url: string;
};

export type QuotaCheckResult =
  | { ownerBypass: true }
  | { premiumBypass: true }
  | { used: number; limit: number; reset_at: string };

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED" as const;

  constructor(
    readonly limit: number,
    readonly reset_at: string,
    readonly upgrade_url: string
  ) {
    super("Monthly free-tier download quota exceeded.");
    this.name = "QuotaExceededError";
  }
}

export function getCurrentMonth(now = new Date()): { year: number; month: number } {
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

export function getMonthResetAt(now = new Date()): string {
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const reset = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

  return reset.toISOString().replace(".000Z", "Z");
}

export async function checkAndIncrementQuota(
  userId: string,
  tier: "free" | "premium",
  resourceOwnerId: string,
  db: DbClient
): Promise<QuotaCheckResult> {
  if (userId === resourceOwnerId) {
    return { ownerBypass: true };
  }

  if (tier === "premium") {
    return { premiumBypass: true };
  }

  const { year, month } = getCurrentMonth();
  const reset_at = getMonthResetAt();

  const result = await db.query<{ count: number }>(
    `
      INSERT INTO monthly_download_counts (user_id, year, month, count)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (user_id, year, month)
      DO UPDATE SET count = monthly_download_counts.count + 1
      RETURNING count
    `,
    [userId, year, month]
  );

  const used = Number(result.rows[0]?.count ?? 0);

  if (used > FREE_TIER_MONTHLY_DOWNLOAD_LIMIT) {
    throw new QuotaExceededError(FREE_TIER_MONTHLY_DOWNLOAD_LIMIT, reset_at, DOWNLOAD_UPGRADE_URL);
  }

  return {
    used,
    limit: FREE_TIER_MONTHLY_DOWNLOAD_LIMIT,
    reset_at,
  };
}

export async function getQuotaUsage(
  userId: string,
  db: DbClient
): Promise<{ used: number; limit: number; reset_at: string; upgrade_url: string }> {
  const { year, month } = getCurrentMonth();
  const reset_at = getMonthResetAt();

  const result = await db.query<{ count: number }>(
    `
      SELECT count
      FROM monthly_download_counts
      WHERE user_id = $1 AND year = $2 AND month = $3
      LIMIT 1
    `,
    [userId, year, month]
  );

  const used = Number(result.rows[0]?.count ?? 0);

  return {
    used,
    limit: FREE_TIER_MONTHLY_DOWNLOAD_LIMIT,
    reset_at,
    upgrade_url: DOWNLOAD_UPGRADE_URL,
  };
}
