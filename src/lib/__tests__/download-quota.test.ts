import type { DbClient } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helper: build a minimal DbClient mock whose query() resolves to a single row
// with the given count, or to an empty result set when countResult is null.
// ---------------------------------------------------------------------------
function makeDb(countResult: number | null): DbClient {
  const rows = countResult !== null ? [{ count: countResult }] : ([] as unknown[]);
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

// ---------------------------------------------------------------------------
// FREE_TIER_MONTHLY_DOWNLOAD_LIMIT — tested via dynamic import so module-init
// code re-runs with the desired env value.
// ---------------------------------------------------------------------------
describe("FREE_TIER_MONTHLY_DOWNLOAD_LIMIT", () => {
  it("defaults to 50 when env var is absent", async () => {
    const saved = process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT;
    delete process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT;
    vi.resetModules();
    try {
      const mod = await import("@/lib/download-quota");
      expect(mod.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT).toBe(50);
    } finally {
      vi.resetModules();
      if (saved !== undefined) process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT = saved;
    }
  });

  it("reads numeric value from process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT", async () => {
    process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT = "10";
    vi.resetModules();
    try {
      const mod = await import("@/lib/download-quota");
      expect(mod.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT).toBe(10);
    } finally {
      vi.resetModules();
      delete process.env.FREE_TIER_MONTHLY_DOWNLOAD_LIMIT;
    }
  });
});

// ---------------------------------------------------------------------------
// Use a static import for the remaining tests (env var kept at default).
// ---------------------------------------------------------------------------
const {
  checkAndIncrementQuota,
  getQuotaUsage,
  QuotaExceededError,
  FREE_TIER_MONTHLY_DOWNLOAD_LIMIT: LIMIT,
} = await import("@/lib/download-quota");

// ---------------------------------------------------------------------------
// reset_at helper: first moment of the next UTC calendar month
// ---------------------------------------------------------------------------
function nextMonthStart(from: Date): string {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth(); // 0-based
  if (month === 11) {
    return `${year + 1}-01-01T00:00:00Z`;
  }
  const nextMonth = String(month + 2).padStart(2, "0");
  return `${year}-${nextMonth}-01T00:00:00Z`;
}

// ---------------------------------------------------------------------------
// checkAndIncrementQuota
// ---------------------------------------------------------------------------
describe("checkAndIncrementQuota", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows download and returns QuotaCheckResult when below limit", async () => {
    const db = makeDb(1); // first download of the month
    const result = await checkAndIncrementQuota("user-1", "free", "owner-99", db);

    expect(result).toMatchObject({
      used: 1,
      limit: LIMIT,
    });
    // reset_at must be the first moment of the next UTC month
    expect((result as { reset_at: string }).reset_at).toBe("2025-02-01T00:00:00Z");
    // DB was called exactly once
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("increments count by exactly one per authorized download", async () => {
    const db = makeDb(3); // 3rd download in the month
    const result = await checkAndIncrementQuota("user-1", "free", "owner-99", db);

    expect((result as { used: number }).used).toBe(3);
    // The upsert call must have been made exactly once
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("throws QuotaExceededError when count equals the limit (boundary)", async () => {
    const db = makeDb(LIMIT); // count returned == limit
    await expect(checkAndIncrementQuota("user-1", "free", "owner-99", db)).rejects.toBeInstanceOf(
      QuotaExceededError
    );
  });

  it("QuotaExceededError carries limit, reset_at, and upgrade_url", async () => {
    const db = makeDb(LIMIT);
    try {
      await checkAndIncrementQuota("user-1", "free", "owner-99", db);
      expect.fail("Expected QuotaExceededError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(QuotaExceededError);
      const qe = err as InstanceType<typeof QuotaExceededError>;
      expect(qe.code).toBe("QUOTA_EXCEEDED");
      expect(qe.limit).toBe(LIMIT);
      expect(qe.reset_at).toBe("2025-02-01T00:00:00Z");
      expect(qe.upgrade_url.length).toBeGreaterThan(0);
    }
  });

  it("throws QuotaExceededError when count exceeds limit (lowered mid-month)", async () => {
    // Simulate limit being lowered: user already has 55 downloads but limit is 50.
    const db = makeDb(55);
    await expect(checkAndIncrementQuota("user-1", "free", "owner-99", db)).rejects.toBeInstanceOf(
      QuotaExceededError
    );
  });

  it("owner bypass: returns { ownerBypass: true } without calling DB", async () => {
    const db = makeDb(0);
    const result = await checkAndIncrementQuota(
      "same-user",
      "free",
      "same-user", // userId === resourceOwnerId
      db
    );

    expect(result).toEqual({ ownerBypass: true });
    // DB must not be touched
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("premium bypass: returns { premiumBypass: true } without calling DB", async () => {
    const db = makeDb(0);
    const result = await checkAndIncrementQuota("user-1", "premium", "owner-99", db);

    expect(result).toEqual({ premiumBypass: true });
    // DB must not be touched
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("lazy month reset: prior-month row does not affect current month (returns used: 1)", async () => {
    // The atomic upsert ignores old-month rows by keying on (userId, year, month).
    // Stub returns 1 — meaning the current-month row was freshly created.
    const db = makeDb(1);
    const result = await checkAndIncrementQuota("user-1", "free", "owner-99", db);

    expect((result as { used: number }).used).toBe(1);

    // Verify the DB call uses the current UTC year and month
    const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    const params = call[1]; // second arg is params array
    const now = new Date("2025-01-15T12:00:00Z");
    expect(params).toContain(now.getUTCFullYear()); // 2025
    expect(params).toContain(now.getUTCMonth() + 1); // 1 (January, 1-based)
  });

  it("reset_at is the first moment of next UTC month — January → February (no year rollover)", async () => {
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    const db = makeDb(1);
    const result = await checkAndIncrementQuota("user-1", "free", "owner-99", db);

    expect((result as { reset_at: string }).reset_at).toBe("2025-02-01T00:00:00Z");
  });

  it("reset_at is the first moment of next UTC month — December → January (year rolls over)", async () => {
    vi.setSystemTime(new Date("2025-12-15T12:00:00Z"));
    const db = makeDb(1);
    const result = await checkAndIncrementQuota("user-1", "free", "owner-99", db);

    expect((result as { reset_at: string }).reset_at).toBe("2026-01-01T00:00:00Z");
  });

  it("second concurrent call with used >= limit throws QuotaExceededError", async () => {
    // Simulate two concurrent requests: the first succeeds (count = LIMIT - 1 → LIMIT),
    // the second sees count = LIMIT (already exhausted) and must throw.
    const dbFirst = makeDb(LIMIT - 1); // first call: below limit, succeeds
    const dbSecond = makeDb(LIMIT); // second call: at limit, must throw

    const first = checkAndIncrementQuota("user-1", "free", "owner-99", dbFirst);
    const second = checkAndIncrementQuota("user-1", "free", "owner-99", dbSecond);

    await expect(first).resolves.toMatchObject({ used: LIMIT - 1 });
    await expect(second).rejects.toBeInstanceOf(QuotaExceededError);
  });
});

// ---------------------------------------------------------------------------
// getQuotaUsage
// ---------------------------------------------------------------------------
describe("getQuotaUsage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns used count, limit, and reset_at when a row exists", async () => {
    const db = makeDb(7);
    const usage = await getQuotaUsage("user-1", db);

    expect(usage.used).toBe(7);
    expect(usage.limit).toBe(LIMIT);
    expect(usage.reset_at).toBe("2025-02-01T00:00:00Z");
  });

  it("returns used: 0 when no row exists for the current month", async () => {
    const db = makeDb(null); // empty result set
    const usage = await getQuotaUsage("user-1", db);

    expect(usage.used).toBe(0);
    expect(usage.limit).toBe(LIMIT);
  });

  it("does not write to DB — query is a SELECT only (no upsert side-effect)", async () => {
    const db = makeDb(3);
    await getQuotaUsage("user-1", db);

    // Only one query should be issued (SELECT, not upsert)
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    // The SQL should not contain INSERT or UPDATE keywords
    const sql = ((db.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0].toUpperCase();
    expect(sql).not.toMatch(/\bINSERT\b/);
    expect(sql).not.toMatch(/\bUPDATE\b/);
  });

  it("reset_at is an ISO-8601 UTC string (ends with Z)", async () => {
    const db = makeDb(5);
    const usage = await getQuotaUsage("user-1", db);

    expect(usage.reset_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/);
  });
});
