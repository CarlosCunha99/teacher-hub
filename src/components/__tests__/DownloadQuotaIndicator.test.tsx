// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DownloadQuotaIndicator from "@/components/DownloadQuotaIndicator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockFetch(body: unknown, status = 200): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

function mockFetchNetworkError(): void {
  global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
}

// ---------------------------------------------------------------------------
// DownloadQuotaIndicator
// ---------------------------------------------------------------------------
describe("DownloadQuotaIndicator", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Remaining count (limit - used)
  // -------------------------------------------------------------------------
  it("displays remaining count as limit minus used for a free user", async () => {
    mockFetch({
      tier: "free",
      used: 12,
      limit: 50,
      reset_at: "2025-02-01T00:00:00Z",
      upgrade_url: "/upgrade",
    });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/38 downloads remaining/i)).toBeInTheDocument();
    });
  });

  it("displays 0 remaining when used equals limit", async () => {
    mockFetch({
      tier: "free",
      used: 50,
      limit: 50,
      reset_at: "2025-02-01T00:00:00Z",
      upgrade_url: "/upgrade",
    });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/0 downloads remaining/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Upgrade CTA — shown only when used === limit
  // -------------------------------------------------------------------------
  it("shows upgrade CTA when free user has reached the limit (used === limit)", async () => {
    mockFetch({
      tier: "free",
      used: 50,
      limit: 50,
      reset_at: "2025-02-01T00:00:00Z",
      upgrade_url: "/upgrade",
    });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /upgrade to premium/i })).toBeInTheDocument();
    });
  });

  it("does not show upgrade CTA when free user is below the limit", async () => {
    mockFetch({
      tier: "free",
      used: 10,
      limit: 50,
      reset_at: "2025-02-01T00:00:00Z",
      upgrade_url: "/upgrade",
    });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /upgrade to premium/i })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Premium — Unlimited label
  // -------------------------------------------------------------------------
  it("shows 'Unlimited' label for a premium user", async () => {
    mockFetch({ tier: "premium", unlimited: true });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/unlimited downloads/i)).toBeInTheDocument();
    });
  });

  it("does not show remaining-count text for a premium user", async () => {
    mockFetch({ tier: "premium", unlimited: true });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(screen.queryByText(/downloads remaining/i)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Null render on 401 / non-ok / fetch failure
  // -------------------------------------------------------------------------
  it("renders null (nothing) when the API returns 401", async () => {
    mockFetch({ error: "Unauthorized" }, 401);

    const { container } = render(<DownloadQuotaIndicator />);

    // Give the effect time to run
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/me/download-quota", { method: "GET" });
    });

    // After the effect resolves, nothing should be rendered
    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it("renders null when the API returns a non-ok status (e.g. 500)", async () => {
    mockFetch({ error: "Server error" }, 500);

    const { container } = render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/me/download-quota", { method: "GET" });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it("renders null when fetch throws a network error", async () => {
    mockFetchNetworkError();

    const { container } = render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Accessibility — non-color-only text
  // -------------------------------------------------------------------------
  it("exposes remaining count as accessible text (aria-live region)", async () => {
    mockFetch({
      tier: "free",
      used: 5,
      limit: 50,
      reset_at: "2025-02-01T00:00:00Z",
      upgrade_url: "/upgrade",
    });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      const region = screen.getByRole("complementary");
      expect(region).toHaveAttribute("aria-live", "polite");
      expect(region).toHaveTextContent(/45 downloads remaining/i);
    });
  });

  it("upgrade CTA has an accessible label for screen readers", async () => {
    mockFetch({
      tier: "free",
      used: 50,
      limit: 50,
      reset_at: "2025-02-01T00:00:00Z",
      upgrade_url: "/upgrade",
    });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      const link = screen.getByRole("link", {
        name: /upgrade to premium for unlimited downloads/i,
      });
      expect(link).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // reset_at visible in text
  // -------------------------------------------------------------------------
  it("includes reset_at timestamp in the rendered text", async () => {
    mockFetch({
      tier: "free",
      used: 3,
      limit: 50,
      reset_at: "2025-02-01T00:00:00Z",
      upgrade_url: "/upgrade",
    });

    render(<DownloadQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/resets at/i)).toBeInTheDocument();
    });
  });
});
