// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ResourcePage from "@/app/resources/[id]/page";

vi.mock("@/lib/store/resource-store", () => ({
  getResourceById: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { getResourceById } from "@/lib/store/resource-store";

const mockGetResourceById = vi.mocked(getResourceById);

describe("ResourcePage", () => {
  const resource = {
    id: "res-1",
    name: "Algebra Worksheet",
    ownerId: "owner-1",
    filePath: "algebra.pdf",
    downloadCount: 7,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the download count for a resource", async () => {
    mockGetResourceById.mockResolvedValue(resource);

    const page = await ResourcePage({ params: Promise.resolve({ id: "res-1" }) });
    render(page);

    expect(screen.getByText(/7/)).toBeTruthy();
  });

  it("renders a download link pointing to /api/resources/{id}/download", async () => {
    mockGetResourceById.mockResolvedValue(resource);

    const page = await ResourcePage({ params: Promise.resolve({ id: "res-1" }) });
    render(page);

    const link = screen.getByRole("link", { name: /download/i });
    expect(link.getAttribute("href")).toBe("/api/resources/res-1/download");
  });

  it("calls notFound when resource does not exist", async () => {
    mockGetResourceById.mockResolvedValue(null);

    await expect(ResourcePage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });
});
