// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ResourceCard } from "@/components/ResourceCard";

describe("ResourceCard", () => {
  it("renders the provided downloadCount", () => {
    render(<ResourceCard id="1" title="Test Resource" downloadCount={42} />);

    const countEl = screen.getByText("42");
    expect(countEl).not.toBeNull();
  });

  it("renders zero downloadCount as '0' without error", () => {
    render(<ResourceCard id="1" title="Test Resource" downloadCount={0} />);

    const countEl = screen.getByText("0");
    expect(countEl).not.toBeNull();
  });
});
