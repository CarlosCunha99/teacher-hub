// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import ResourceCard from "@/components/ResourceCard";

describe("ResourceCard", () => {
  const resource = {
    id: "r1",
    name: "Test Sheet",
    ownerId: "owner-1",
    downloadCount: 42,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  it("renders the resource name", () => {
    render(<ResourceCard {...resource} />);
    expect(screen.getByText("Test Sheet")).toBeTruthy();
  });

  it("renders the download count", () => {
    render(<ResourceCard {...resource} />);
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  it("renders both name and count without error", () => {
    const { container } = render(<ResourceCard {...resource} />);
    expect(container).toBeTruthy();
    expect(container.textContent).toContain("Test Sheet");
    expect(container.textContent).toContain("42");
  });
});
