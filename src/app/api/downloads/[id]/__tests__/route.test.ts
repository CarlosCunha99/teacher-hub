import { vi } from "vitest";
import { GET } from "@/app/api/downloads/[id]/route";
import * as auth from "@/lib/auth";
import * as quotaLib from "@/lib/download-quota";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock the quota library so DB writes are never triggered in these tests.
// QuotaExceededError is re-exported so the route handler's catch clause works.
vi.mock("@/lib/download-quota", () => {
  class MockQuotaExceededError extends Error {
    readonly code = "QUOTA_EXCEEDED" as const;
    constructor(
      readonly limit: number,
      readonly reset_at: string,
      readonly upgrade_url: string
    ) {
      super("Monthly download quota exceeded");
      this.name = "QuotaExceededError";
    }
  }

  return {
    checkAndIncrementQuota: vi.fn(),
    QuotaExceededError: MockQuotaExceededError,
    FREE_TIER_MONTHLY_DOWNLOAD_LIMIT: 50,
  };
});

// Mock the DB so resource lookups can be controlled per test.
vi.mock("@/lib/db", () => ({
  default: { query: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Typed references to mocked functions
// ---------------------------------------------------------------------------
const mockGetSession = vi.mocked(auth.getSession);
const mockCheckAndIncrementQuota = vi.mocked(quotaLib.checkAndIncrementQuota);
const { QuotaExceededError } = await import("@/lib/download-quota");

// Import db default export for per-test control.
const { default: db } = await import("@/lib/db");
const mockDbQuery = vi.mocked(db.query);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const RESOURCE_ID = "resource-abc";
const OWNER_ID = "owner-user-1";
const FREE_USER_ID = "free-user-2";
const PREMIUM_USER_ID = "premium-user-3";
const RESET_AT = "2025-02-01T00:00:00.000Z";

/** A resource row as returned by the DB lookup inside the route. */
const existingResource = {
  id: RESOURCE_ID,
  owner_id: OWNER_ID,
  storage_url: "https://storage.example.com/files/resource-abc.pdf",
};

function makeRequest(id: string = RESOURCE_ID): [Request, { params: Promise<{ id: string }> }] {
  return [new Request(`http://localhost/api/downloads/${id}`), { params: Promise.resolve({ id }) }];
}

describe("GET /api/downloads/[id]", () => {
  beforeEach(() => {
    // resetAllMocks clears call history AND removes any mockReturnValue/mockRejectedValue
    // implementations set in previous tests, preventing pollution between tests.
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

    // Default: resource found in DB; override per test as needed.
    mockDbQuery.mockResolvedValue({ rows: [existingResource] });

    // Default: stub global fetch for file-streaming side of the route
    // (avoids network calls when the handler fetches a storage URL).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("file-data", {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        })
      )
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // 401 — unauthenticated
  // -----------------------------------------------------------------------
  it("returns 401 for unauthenticated request", async () => {
    mockGetSession.mockResolvedValue(null);

    const [req, ctx] = makeRequest();
    const response = await GET(req, ctx);

    expect(response.status).toBe(401);
    expect(mockCheckAndIncrementQuota).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 404 — resource not found (must not increment counter)
  // -----------------------------------------------------------------------
  it("returns 404 for nonexistent resource without calling checkAndIncrementQuota", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: FREE_USER_ID, tier: "free" },
    });
    // DB returns no rows → resource does not exist
    mockDbQuery.mockResolvedValue({ rows: [] });

    const [req, ctx] = makeRequest("nonexistent-id");
    const response = await GET(req, ctx);

    expect(response.status).toBe(404);
    // Counter must not be touched when resource is not found (AC8)
    expect(mockCheckAndIncrementQuota).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 200 — free non-owner user below quota
  // -----------------------------------------------------------------------
  it("returns 200 and increments quota for free non-owner user below limit", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: FREE_USER_ID, tier: "free" },
    });
    mockCheckAndIncrementQuota.mockResolvedValue({
      used: 1,
      limit: 50,
      reset_at: RESET_AT,
    });

    const [req, ctx] = makeRequest();
    const response = await GET(req, ctx);

    expect(response.status).toBe(200);
    // checkAndIncrementQuota called exactly once with the correct arguments
    expect(mockCheckAndIncrementQuota).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrementQuota).toHaveBeenCalledWith(
      FREE_USER_ID,
      "free",
      OWNER_ID,
      expect.anything() // db instance
    );
  });

  // -----------------------------------------------------------------------
  // 402 — free user at limit (QuotaExceededError thrown)
  // -----------------------------------------------------------------------
  it("returns 402 with QuotaExceededBody when quota is exceeded", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: FREE_USER_ID, tier: "free" },
    });
    mockCheckAndIncrementQuota.mockRejectedValue(new QuotaExceededError(50, RESET_AT, "/upgrade"));

    const [req, ctx] = makeRequest();
    const response = await GET(req, ctx);

    expect(response.status).toBe(402);

    const body = await response.json();
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(typeof body.limit).toBe("number");
    expect(body.reset_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.upgrade_url.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 200 — owner bypass
  // Per contract: the route calls checkAndIncrementQuota with all args;
  // the bypass (ownerBypass: true) is returned by the function itself.
  // The DB upsert is never triggered (handled inside the function mock).
  // -----------------------------------------------------------------------
  it("returns 200 for resource owner (checkAndIncrementQuota returns ownerBypass)", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: OWNER_ID, tier: "free" },
    });
    // Resource owner matches session user ID
    mockDbQuery.mockResolvedValue({
      rows: [{ ...existingResource, owner_id: OWNER_ID }],
    });
    // Contract: when userId === resourceOwnerId, checkAndIncrementQuota returns { ownerBypass: true }
    mockCheckAndIncrementQuota.mockResolvedValue({ ownerBypass: true });

    const [req, ctx] = makeRequest();
    const response = await GET(req, ctx);

    expect(response.status).toBe(200);
    // checkAndIncrementQuota was called with the owner's id as both userId and resourceOwnerId
    expect(mockCheckAndIncrementQuota).toHaveBeenCalledWith(
      OWNER_ID,
      "free",
      OWNER_ID,
      expect.anything()
    );
  });

  // -----------------------------------------------------------------------
  // 200 — premium user bypass
  // Per contract: the route calls checkAndIncrementQuota with all args;
  // the bypass (premiumBypass: true) is returned by the function itself.
  // -----------------------------------------------------------------------
  it("returns 200 for premium user (checkAndIncrementQuota returns premiumBypass)", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: PREMIUM_USER_ID, tier: "premium" },
    });
    // Contract: when tier === 'premium', checkAndIncrementQuota returns { premiumBypass: true }
    mockCheckAndIncrementQuota.mockResolvedValue({ premiumBypass: true });

    const [req, ctx] = makeRequest();
    const response = await GET(req, ctx);

    expect(response.status).toBe(200);
    expect(mockCheckAndIncrementQuota).toHaveBeenCalledWith(
      PREMIUM_USER_ID,
      "premium",
      OWNER_ID,
      expect.anything()
    );
  });
});
