import { vi } from "vitest";
import { GET } from "@/app/api/me/download-quota/route";
import * as auth from "@/lib/auth";
import * as quotaLib from "@/lib/download-quota";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/download-quota", () => ({
  getQuotaUsage: vi.fn(),
  FREE_TIER_MONTHLY_DOWNLOAD_LIMIT: 50,
}));

// @/lib/db is not called directly by the route handler (it passes db to getQuotaUsage
// which is mocked above), so no mock needed for db here.

const mockGetSession = vi.mocked(auth.getSession);
const mockGetQuotaUsage = vi.mocked(quotaLib.getQuotaUsage);

const BASE_URL = "http://localhost/api/me/download-quota";

function makeRequest(): Request {
  return new Request(BASE_URL);
}

describe("GET /api/me/download-quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // 401 — unauthenticated
  // -----------------------------------------------------------------------
  it("returns 401 when session is null (unauthenticated)", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    // getQuotaUsage must NOT be called for unauthenticated requests
    expect(mockGetQuotaUsage).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 200 — free user below limit
  // -----------------------------------------------------------------------
  it("returns 200 with QuotaStatus for authenticated free user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", tier: "free" },
    });
    mockGetQuotaUsage.mockResolvedValue({
      used: 12,
      limit: 50,
      reset_at: "2025-02-01T00:00:00.000Z",
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.tier).toBe("free");
    expect(body.used).toBe(12);
    expect(body.limit).toBe(50);
    expect(body.reset_at).toBe("2025-02-01T00:00:00.000Z");
  });

  // -----------------------------------------------------------------------
  // 200 — free user at limit (used === limit)
  // -----------------------------------------------------------------------
  it("returns 200 with used === limit when free user has reached quota", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-2", tier: "free" },
    });
    mockGetQuotaUsage.mockResolvedValue({
      used: 50,
      limit: 50,
      reset_at: "2025-02-01T00:00:00.000Z",
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.used).toBe(body.limit);

    // reset_at must be a future UTC timestamp
    const resetAt = new Date(body.reset_at);
    expect(resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  // -----------------------------------------------------------------------
  // 200 — premium user gets unlimited indicator
  // -----------------------------------------------------------------------
  it("returns 200 with unlimited indicator for premium user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-3", tier: "premium" },
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);

    const body = await response.json();
    // Premium response: tier: 'premium' and unlimited: true — no restrictive numeric limit
    expect(body.tier).toBe("premium");
    expect(body.unlimited).toBe(true);
    // getQuotaUsage must NOT be called for premium users
    expect(mockGetQuotaUsage).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // reset_at is the first moment of next UTC calendar month
  // -----------------------------------------------------------------------
  it("reset_at in response is the first moment of next UTC calendar month", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-4", tier: "free" },
    });
    mockGetQuotaUsage.mockResolvedValue({
      used: 5,
      limit: 50,
      reset_at: "2025-02-01T00:00:00.000Z",
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    // The value is threaded through from getQuotaUsage to the response body
    expect(body.reset_at).toBe("2025-02-01T00:00:00.000Z");
    // Must be a valid ISO-8601 UTC string
    expect(body.reset_at).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00/);
  });
});
